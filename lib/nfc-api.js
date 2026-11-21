import {json, missing, tokenPattern} from './shared.js';
import {keys, validate, webURL} from './fields.js';
import {codePattern, digest, equal, hashPin, hasSession, now, pinPattern, random, sessionCookie, cookieName} from './security.js';

const rejected = () => json({error:'The credentials could not be verified.'}, 401);
const limited = seconds => json({error:'Too many attempts. Try again later.'}, 429, {'Retry-After':String(Math.max(1,seconds))});
const pick = (row, columns) => Object.fromEntries(columns.map(key => [key,row[key]]));

function brand(raw, includePerk = false) {
  try {
    const config = JSON.parse(raw);
    const links = (Array.isArray(config.links) ? config.links : []).slice(0,2)
      .filter(item => item && typeof item.label === 'string' && typeof item.url === 'string' &&
        (/^\/(?!\/)[^\\\s]*$/.test(item.url) || webURL(item.url)));
    return {mode:config.mode === 'live' ? 'live' : 'prelaunch', links:links.length ? links : [{label:'Learn about Pokmira',url:'/'}],
      perk:includePerk && config.mode === 'live' && typeof config.perk === 'string' ? config.perk.slice(0,180) : ''};
  } catch {
    return {mode:'prelaunch',links:[{label:'Learn about Pokmira',url:'/'}],perk:''};
  }
}

async function input(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '') || !request.body) throw Error('Expected a JSON request.');
  const reader = request.body.getReader();
  let size = 0;
  let text = '';
  const decoder = new TextDecoder('utf-8',{fatal:true});
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw Error('Request is too large.');
      text += decoder.decode(value,{stream:true});
    }
    const data = JSON.parse(text+decoder.decode());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Expected a JSON object.');
    return data;
  } catch {
    await reader.cancel().catch(()=>{});
    throw Error('Invalid or oversized JSON request.');
  } finally { reader.releaseLock(); }
}

export async function onRequest(context) {
  try { return await route(context); }
  catch { return json({error:'Card service is temporarily unavailable.'},503); }
}

async function route(context) {
  const {params,request,env} = context;
  const [resource,token,action,...rest] = params.path || [];
  if (resource !== 'card' || !tokenPattern.test(token || '') || rest.length) return missing();
  const method = request.method;
  const publicRead = method === 'GET' && !action;
  const ownerRead = method === 'GET' && action === 'owner';
  const write = (method === 'PUT' && !action) || (method === 'POST' && ['activate','verify','recover','logout'].includes(action));
  if (!publicRead && !ownerRead && !write) return missing();
  if (write && request.headers.get('Origin') !== new URL(request.url).origin) return json({error:'Origin rejected.'},403);

  const db = env.DB;
  const query = (sql,...args) => db.prepare(sql).bind(...args);
  const row = await query('SELECT * FROM cards WHERE token = ?',token).first();
  if (!row) return missing();
  if (publicRead) {
    const response = {status:row.status,brand:brand(env.BRAND_CONFIG)};
    if (row.status === 'active') {
      response.card = pick(row,keys.filter(key=>key!=='lost_mode_message'));
      context.waitUntil(query("UPDATE cards SET scan_count = scan_count + 1 WHERE token = ? AND status = 'active'",token).run().catch(()=>{}));
    }
    if (row.status === 'paused') response.lost_mode_message = row.lost_mode_message;
    return json(response);
  }

  const secret = env.SESSION_SECRET;
  if (typeof secret !== 'string' || !/^[a-f0-9]{64,}$/i.test(secret)) return json({error:'Owner service is temporarily unavailable.'},503);
  if (action === 'logout') return json({ok:true},200,{'Set-Cookie':cookieName(token)+'=; Path=/api/card/'+token+'; Max-Age=0; Secure; HttpOnly; SameSite=Strict'});
  if (ownerRead || method === 'PUT') {
    if (row.status === 'unclaimed' || !(await hasSession(request,secret,row))) return rejected();
    if (ownerRead) return json({status:row.status, card:pick(row,[...keys,'recovery_email']),scan_count:row.scan_count,perk:brand(env.BRAND_CONFIG,true).perk || ''});
    let data, changes;
    try {
      data = await input(request);
      changes = validate(data,{partial:true});
      if (Object.hasOwn(data,'status')) {
        if (!['paused','active'].includes(data.status)) throw Error('Invalid status.');
        changes.status = data.status;
      }
      if (Object.hasOwn(data,'pin')) {
        if (typeof data.pin !== 'string' || !pinPattern.test(data.pin)) throw Error('Use a 4–6 digit PIN.');
        changes.pin_salt = random(16);
        changes.pin_hash = await hashPin(data.pin,changes.pin_salt);
        changes.auth_version = row.auth_version+1;
        changes.failed_attempts = 0;
        changes.locked_until = 0;
      }
    } catch(error) { return json({error:error.message},400); }
    if (!Object.keys(changes).length) return json({ok:true});
    const updated = await query('UPDATE cards SET '+Object.keys(changes).map(key=>key+' = ?').join(',')+
      ' , updated_at = ? WHERE token = ? AND auth_version = ?',...Object.values(changes),now(),token,row.auth_version).run();
    if (!updated.meta.changes) return rejected();
    return data.pin ? json({ok:true},200,{'Set-Cookie':await sessionCookie(secret,token,changes.auth_version)}) : json({ok:true});
  }

  if ((action === 'activate') !== (row.status === 'unclaimed')) return rejected();
  let data, changes;
  try {
    data = await input(request);
    if (action === 'activate') changes = validate(data);
    if (action === 'recover' || action === 'activate') {
      if (typeof data.pin !== 'string' || !pinPattern.test(data.pin)) throw Error('Use a 4–6 digit PIN.');
      if (typeof data.code !== 'string' || !codePattern.test(data.code.toLowerCase().trim())) throw Error('Enter the 24-character code.');
    } else if (typeof data.pin !== 'string' || !pinPattern.test(data.pin)) throw Error('Use a 4–6 digit PIN.');
  } catch(error) { return json({error:error.message},400); }

  const time = now();
  if (row.locked_until > time) return limited(row.locked_until-time);
  // Reserve an attempt before any credential work so parallel requests share the same limit.
  const attempt = await query(`UPDATE cards SET
    locked_until = CASE WHEN locked_until = 0 AND failed_attempts >= 4 THEN ? ELSE 0 END,
    failed_attempts = CASE WHEN locked_until > 0 THEN 1 ELSE failed_attempts + 1 END
    WHERE token = ? AND locked_until <= ? AND auth_version = ?
    RETURNING failed_attempts, locked_until`,time+900,token,time,row.auth_version).first();
  if (!attempt) return limited(900);
  const verified = action === 'verify'
    ? equal(row.pin_hash,await hashPin(data.pin,row.pin_salt))
    : equal(action === 'activate' ? row.claim_code_hash : row.backup_code_hash,await digest(data.code.trim().toLowerCase()));
  if (!verified) return attempt.locked_until ? limited(900) : rejected();

  let version = row.auth_version;
  let backup_code;
  if (action === 'verify') {
    await query('UPDATE cards SET failed_attempts = 0, locked_until = 0 WHERE token = ? AND auth_version = ? AND failed_attempts = ? AND locked_until = ?',
      token,version,attempt.failed_attempts,attempt.locked_until).run();
  } else {
    const salt = random(16);
    const updates = {
      ...changes, auth_version:++version,pin_salt:salt,pin_hash:await hashPin(data.pin,salt),
      failed_attempts:0,locked_until:0,updated_at:now()
    };
    if (action === 'activate') {
      updates.status = 'active';
      updates.claim_code_hash = null;
    } else {
      backup_code = random(12);
      updates.backup_code_hash = await digest(backup_code);
    }
    const result = await query('UPDATE cards SET '+Object.keys(updates).map(key=>key+' = ?').join(',')+
      ' WHERE token = ? AND auth_version = ?',...Object.values(updates),token,row.auth_version).run();
    if (!result.meta.changes) return rejected();
  }
  return json({ok:true,...(backup_code ? {backup_code} : {})},200,{'Set-Cookie':await sessionCookie(secret,token,version)});
}
