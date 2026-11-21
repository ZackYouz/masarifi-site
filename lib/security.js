const encoder = new TextEncoder();
export const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
export const random = count => hex(crypto.getRandomValues(new Uint8Array(count)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export const pinPattern = /^\d{4,6}$/;
export const codePattern = /^[a-f0-9]{24}$/;

export async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000
  }, key, 256));
}

export function equal(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}
export const now = () => Math.floor(Date.now() / 1000);
export const cookieName = token => '__Secure-pm_' + token;

export async function sessionCookie(secret, token, version) {
  const payload = [token, version, now()+900].join('.');
  const value = payload + '.' + await sign(secret, payload);
  return cookieName(token)+'='+value+'; Path=/api/card/'+token+'; Max-Age=900; Secure; HttpOnly; SameSite=Strict';
}

export async function hasSession(request, secret, card) {
  const prefix = cookieName(card.token)+'=';
  const value = request.headers.get('Cookie')?.split(/;\s*/).find(part => part.startsWith(prefix))?.slice(prefix.length);
  if (!value || value.length > 140) return false;
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const [token, version, expires, signature] = parts;
  return token === card.token && version === String(card.auth_version) && /^\d+$/.test(expires) &&
    Number(expires) > now() && equal(signature, await sign(secret, parts.slice(0,3).join('.')));
}
