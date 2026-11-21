export const fields = {
  full_name: 100, job_title: 90, company: 90, phone: 30, whatsapp: 30,
  email: 160, website: 300, social_link: 300, bio: 320, theme_color: 7, lost_mode_message: 220
};
export const keys = Object.keys(fields);
const email = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/u;
const phone = /^\+?[0-9][0-9 .()-]{5,29}$/;

export function validate(data, {partial = false} = {}) {
  const output = {};
  for (const [key, limit] of Object.entries({...fields,recovery_email:160})) {
    if (partial && !Object.hasOwn(data,key)) continue;
    const raw = Object.hasOwn(data,key) ? data[key] : key === 'theme_color' ? '#0D6E4F' : '';
    if (typeof raw !== 'string' || raw.length > limit || /[\x00-\x1f\x7f]/u.test(raw)) throw Error('Invalid '+key+'.');
    const value = raw.trim();
    if (key === 'full_name' && !value) throw Error('Full name is required.');
    if (key === 'theme_color' && !/^#[a-f0-9]{6}$/i.test(value)) throw Error('Invalid accent color.');
    if (value && ['phone','whatsapp'].includes(key) && (!phone.test(value) || value.replace(/\D/g,'').length < 7)) throw Error('Invalid '+key+'.');
    if (value && key === 'whatsapp' && !/^\+[1-9]\d{6,14}$/.test(value.replace(/[ .()-]/g,''))) throw Error('Use international format for WhatsApp.');
    if (value && ['email','recovery_email'].includes(key) && !email.test(value)) throw Error('Invalid '+key+'.');
    if (value && ['website','social_link'].includes(key) && !webURL(value)) throw Error('Use an http:// or https:// URL.');
    output[key] = value || null;
  }
  return output;
}

export function webURL(value) {
  if (!/^https?:\/\//i.test(value) || /[\s\\]/u.test(value)) return '';
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.hostname ? url.href : '';
  } catch { return ''; }
}
