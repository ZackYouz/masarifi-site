import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as api} from '../lib/nfc-api.js';
import {onRequest as page} from '../functions/k/[[path]].js';
import {digest,now} from '../lib/security.js';
import {vcard} from '../public/nfc/vcard.js';

const token='x9K4mP2qR7vL', claim='a'.repeat(24), backup='b'.repeat(24);
const schema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
async function fixture() {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
  sqlite.prepare('INSERT INTO cards(token,claim_code_hash,backup_code_hash) VALUES (?,?,?)').run(token,await digest(claim),await digest(backup));
  const DB={prepare:sql=>({bind:(...args)=>({
    first:async()=>sqlite.prepare(sql).get(...args),
    run:async()=>({meta:{changes:sqlite.prepare(sql).run(...args).changes}})
  })})};
  const env={DB,SESSION_SECRET:'e'.repeat(64)};
  async function call(method='GET',action,body,cookie,origin='https://example.com',id=token) {
    const path=['card',id,...(action?[action]:[])];
    const waits=[];
    const response=await api({params:{path},env,waitUntil:p=>waits.push(p),request:new Request('https://example.com/api/'+path.join('/'),{
      method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    })});
    await Promise.all(waits);
    const session=response.headers.get('Set-Cookie')?.split(';')[0];
    return {response,session,status:response.status,data:await response.json()};
  }
  return {call,sqlite};
}
const details={code:claim,pin:'918273',full_name:'زكريا يوسف',phone:'+961 70 123 456',email:'owner@example.com',recovery_email:'private@example.com'};
test('claim, public allowlist, no-store, updates and lost mode',async()=>{
  const {call,sqlite}=await fixture();
  assert.deepEqual((await call()).data.status,'unclaimed');
  assert.equal((await call('GET',null,null,null,undefined,'123456789012')).status,404);
  assert.equal((await call('POST','activate',{...details,website:'javascript:alert(1)'})).status,400);
  assert.equal((await call('POST','activate',{...details,code:backup})).status,401);
  const activation=await Promise.all([call('POST','activate',details),call('POST','activate',details)]);
  const winner=activation.find(a=>a.status===200);
  assert.equal(activation.filter(a=>a.status===200).length,1);
  assert.match(winner.response.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);
  const publicCard=await call();
  assert.equal(publicCard.data.card.full_name,details.full_name);
  assert.ok(!JSON.stringify(publicCard.data).includes('private@example.com'));
  assert.equal(publicCard.response.headers.get('Cache-Control'),'no-store');
  assert.equal(publicCard.response.headers.get('X-Robots-Tag'),'noindex, nofollow');
  assert.equal(sqlite.prepare('SELECT scan_count FROM cards').get().scan_count,1);
  assert.notEqual(sqlite.prepare('SELECT pin_hash FROM cards').get().pin_hash,details.pin);
  assert.equal((await call('PUT',null,{phone:'+961 70 222 333'})).status,401);
  assert.equal((await call('PUT',null,{phone:'+961 70 222 333'},winner.session,'https://other.example')).status,403);
  assert.equal((await call('PUT',null,{phone:'+961 70 222 333'},winner.session)).status,200);
  assert.equal((await call()).data.card.phone,'+961 70 222 333');
  assert.equal((await call('PUT',null,{status:'paused',lost_mode_message:'At reception'},winner.session)).status,200);
  const paused=await call();
  assert.equal(paused.data.status,'paused');
  assert.equal(paused.data.lost_mode_message,'At reception');
  assert.ok(!('card' in paused.data));
});
test('concurrent PIN limit, expiry, PIN rotation and one-time backup',async()=>{
  const {call,sqlite}=await fixture();
  const initial=await call('POST','activate',details);
  assert.equal(initial.status,200);
  const failures=await Promise.all(Array.from({length:10},()=>call('POST','verify',{pin:'0000'})));
  assert.equal(failures.filter(a=>a.status===401).length,4);
  assert.equal(failures.filter(a=>a.status===429).length,6);
  assert.equal((await call('POST','verify',{pin:details.pin})).status,429);
  sqlite.prepare('UPDATE cards SET locked_until=?').run(now()-1);
  assert.equal((await call('POST','verify',{pin:details.pin})).status,200);
  const recovery=await call('POST','recover',{code:backup,pin:'123987'});
  assert.match(recovery.data.backup_code,/^[a-f0-9]{24}$/);
  assert.equal((await call('POST','recover',{code:backup,pin:'123987'})).status,401);
  assert.equal((await call('GET','owner',null,initial.session)).status,401);
  assert.equal((await call('GET','owner',null,recovery.session)).status,200);
  const changed=await call('PUT',null,{pin:'987123'},recovery.session);
  assert.equal(changed.status,200);
  assert.equal((await call('GET','owner',null,recovery.session)).status,401);
  assert.equal((await call('GET','owner',null,changed.session)).status,200);
});
test('robots policy on card HTML and invalid token',async()=>{
  const env={ASSETS:{fetch:async()=>new Response(readFileSync(new URL('../public/nfc/card.html',import.meta.url)))}};
  const request=new Request('https://example.com/k/'+token);
  for(const [id,status] of [[token,200],['000000000001',404]]) {
    const response=await page({request,env,params:{path:[id]}});
    assert.equal(response.status,status);
    assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
    if(status===200) assert.match(await response.text(),/name="robots" content="noindex, nofollow"/);
  }
});
test('UTF-8 and vCard injection boundaries',()=>{
  const data=vcard({full_name:'زكريا يوسف',company:'شركة; بيروت',job_title:'مهندس',bio:'a\nTEL:11'+'م'.repeat(80)});
  assert.ok(data.includes('FN;CHARSET=UTF-8:زكريا يوسف\r\n'));
  assert.ok(data.includes('ORG;CHARSET=UTF-8:شركة\\; بيروت\r\n'));
  assert.ok(data.includes('a\\nTEL:11'));
  assert.ok(!data.replaceAll('\r\n','').includes('\n'));
  for(const line of data.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
});
test('batch SQL and printed secrets match, including existing URLs',()=>{
  const root=mkdtempSync(join(tmpdir(),'pm-batch-'));
  const script=new URL('../scripts/generate-batch.mjs',import.meta.url);
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
  try {
    execFileSync(process.execPath,[script.pathname,'--origin','https://example.com','--count','8','--out','new'],{cwd:root});
    const rows=readFileSync(join(root,'private-batches/new/print-private.csv'),'utf8').trim().split('\r\n').slice(1);
    sqlite.exec(readFileSync(join(root,'private-batches/new/seed.sql'),'utf8'));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM cards').get().count,8);
    assert.equal(new Set(rows.map(row=>row.split(',')[0])).size,8);
    const known=rows[0].split(',')[1];
    writeFileSync(join(root,"known.txt"),known+"\n");
    execFileSync(process.execPath,[script.pathname,'--origin','https://example.com','--existing-urls','known.txt','--out','mapped'],{cwd:root});
    assert.match(readFileSync(join(root,'private-batches/mapped/print-private.csv'),'utf8'),new RegExp(known));
  } finally {rmSync(root,{recursive:true,force:true});}
});
