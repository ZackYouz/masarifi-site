import {vcard} from './vcard.js';

const get=id=>document.getElementById(id);
const view=get('view'), owner=get('owner');
const token=/^\/k\/([A-Za-z0-9_-]{12})\/?$/.exec(location.pathname)?.[1];
const api='/api/card/'+token;
let ar=navigator.language.toLowerCase().startsWith('ar');
let state, panel='public', error='';
try { const choice=localStorage.getItem('pm-nfc-language'); if(choice) ar=choice==='ar'; } catch {}
const tr=(en,arabic)=>ar?arabic:en;
function tag(name,text,classes) {
  const node=document.createElement(name);
  if(text) node.textContent=text;
  if(classes) node.className=classes;
  return node;
}
function link(text,url,classes='action') {
  const anchor=tag('a',text,classes);anchor.href=url;return anchor;
}
function button(text,click,classes='quiet') {
  const node=tag('button',text,classes);node.type='button';node.addEventListener('click',click);return node;
}
function validURL(value,relative=false) {
  if(typeof value!=='string') return '';
  if(relative && /^\/(?!\/)[^\\\s]*$/.test(value)) return value;
  if(!/^https?:\/\//i.test(value) || /[\s\\]/u.test(value)) return '';
  try { const url=new URL(value);return url.hostname&&!url.username&&!url.password?url.href:''; } catch {return '';}
}
function digits(phone) {return phone.replace(/[^+\d]/g,'');}
async function request(suffix='',method='GET',data) {
  const response=await fetch(api+suffix,{method,cache:'no-store',credentials:'same-origin',
    ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw Error(response.status===429 ? tr('Too many attempts. Try again later.','محاولات كثيرة. حاول لاحقًا.') :
    response.status===401 ? tr('Check your PIN or code.','تحقّق من الرقم السري أو الرمز.') :
    result.error||tr('Service unavailable.','الخدمة غير متاحة.'));
  return result;
}
async function refresh() {
  try { state=await request();error=''; }
  catch(e) {state=null;error=e.message;}
  panel='public';render();
}
function showPanel(next) {panel=next;render();view.querySelector('h1')?.focus();}
function heading(section,text) {
  const title=tag('h1',text);title.tabIndex=-1;section.append(title);return title;
}
async function showQR() {
  const url=location.origin+'/k/'+token;
  const dialog=get('qr');
  try {const {qrSVG}=await import('./qr.js');get('qr-image').replaceChildren(qrSVG(url));}
  catch { get('qr-image').textContent=tr('Share this link.','شارك هذا الرابط.'); }
  get('qr-link').replaceChildren(link(url,url,''));
  get('qr-close').textContent=tr('Close','إغلاق');
  dialog.showModal();
}
function save(card) {
  const url=URL.createObjectURL(new Blob([vcard(card)],{type:'text/vcard;charset=utf-8'}));
  const saveLink=link(tr('Save contact','حفظ جهة الاتصال'),url,'action primary');
  saveLink.download=(card.full_name||'contact').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)+'.vcf';
  return {saveLink,url};
}
let contactURL;
const iconPaths={
  phone:'M5 4h4l2 5-2 2a14 14 0 0 0 4 4l2-2 5 2v4c-8 2-17-7-15-15z',
  'brand-whatsapp':'M5 17l-1 4 4-1a9 9 0 1 0-3-3z M9 8c-2 2 3 7 5 7l2-2-3-1-1 1-2-2 1-1-1-3z',
  mail:'M3 5h18v14H3z M3 6l9 7 9-7',
  world:'M3 12h18 M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18',
  link:'M10 13l4-4m-7 6-1 1a3 3 0 0 0 4 4l4-4a3 3 0 0 0 0-4m3-3 1-1a3 3 0 0 0-4-4l-4 4a3 3 0 0 0 0 4',
  'brand-instagram':'M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zm5-1h.01',
  'brand-tiktok':'M14 3v13a4 4 0 1 1-4-4m4-9a6 6 0 0 0 6 6',
  'brand-linkedin':'M4 9v11m0-16h.01M9 20V9m0 5c0-6 10-6 10 0v6',
  'brand-facebook':'M14 21v-8h4l1-4h-5V7c0-2 2-2 5-2V2c-5-1-9 1-9 5v2H6v4h4v8',
  'brand-x':'M4 4h4l12 16h-4z M20 4L4 20',
  qrcode:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M13 13h4v4h-4z M21 13v4m0 4h-4m-4 0v-2'
};
function withIcon(node,name) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('class','contact-icon ti-'+name);
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',iconPaths[name]);
  svg.append(path);
  node.prepend(svg);
  return node;
}
function decorateBio(node,value) {
  const tokens=/\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last=0;
  for(const match of value.matchAll(tokens)) {
    node.append(document.createTextNode(value.slice(last,match.index).replaceAll('*','')));
    node.append(tag(match[1]===undefined?'em':'strong',match[1]??match[2]));
    last=match.index+match[0].length;
  }
  node.append(document.createTextNode(value.slice(last).replaceAll('*','')));
}
function socialDisplay(url) {
  const {hostname,pathname}=new URL(url);
  const domains={
    'instagram.com':'instagram','tiktok.com':'tiktok','linkedin.com':'linkedin',
    'facebook.com':'facebook','x.com':'x','twitter.com':'x'
  };
  const domain=Object.keys(domains).find(key=>hostname===key||hostname.endsWith('.'+key));
  const platform=domains[domain];
  const parts=pathname.split('/').filter(Boolean);
  const profile=(platform==='linkedin'&&['in','company'].includes(parts[0]))?parts[1]:parts[0];
  let handle=profile||'';
  try { handle=decodeURIComponent(handle); } catch {}
  return [platform?'brand-'+platform:'link',platform&&handle?'@'+handle.replace(/^@/,''):hostname.replace(/^www\./,'')+ (pathname==='/'?'':pathname)];
}
function profile(section,card) {
  section.className='profile';
  const initials=(card.full_name||'').trim().split(/\s+/u).slice(0,2).map(word=>Array.from(word)[0]).join('');
  const avatar=tag('div',initials,'avatar');
  avatar.setAttribute('aria-hidden','true');
  section.append(avatar);
  heading(section,card.full_name).dir='auto';
  const identity=[card.job_title,card.company].filter(Boolean).join(' · ');
  if(identity) {
    const line=tag('p',identity);line.dir='auto';section.append(line);
  }
  if(card.bio?.replaceAll('*','').trim()) {
    const bio=tag('p','','bio');bio.dir='auto';decorateBio(bio,card.bio);section.append(bio);
  }
  const actions=tag('div','','actions');
  const info=tag('div','','contact-info');
  const row=(label,url,icon)=>{
    const value=tag('bdi',label);
    const item=link('',url,'contact-row');
    item.append(value);
    info.append(withIcon(item,icon));
  };
  if(card.phone) {
    const url='tel:'+digits(card.phone);
    actions.append(withIcon(link(tr('Call','اتصال'),url),'phone'));
    row(card.phone,url,'phone');
  }
  if(card.whatsapp) actions.append(withIcon(link('WhatsApp','https://wa.me/'+digits(card.whatsapp).replace('+','')),'brand-whatsapp'));
  if(card.email) {
    const url='mailto:'+encodeURIComponent(card.email);
    actions.append(withIcon(link(tr('Email','بريد إلكتروني'),url),'mail'));
    row(card.email,url,'mail');
  }
  const website=validURL(card.website);
  if(website) {
    const {hostname,pathname}=new URL(website);
    row(hostname.replace(/^www\./,'')+(pathname==='/'?'':pathname),website,'world');
  }
  const social=validURL(card.social_link);
  if(social) {
    const [icon,label]=socialDisplay(social);
    row(label,social,icon);
  }
  if(actions.childElementCount) section.append(actions);
  if(info.childElementCount) section.append(info);
  section.append(withIcon(button(tr('Show QR code','عرض رمز QR'),showQR,'contact-qr quiet'),'qrcode'));
  const {saveLink,url}=save(card);contactURL=url;
  saveLink.classList.add('contact-save');
  section.append(saveLink);
}
const fields=[
 ['full_name','Full name','الاسم الكامل','text',100],['job_title','Job title','المسمّى الوظيفي','text',90],
 ['company','Company','الشركة','text',90],['phone','Phone','رقم الهاتف','tel',30],
 ['whatsapp','WhatsApp (+country code)','واتساب مع رمز البلد','tel',30],['email','Public email','البريد الإلكتروني العام','email',160],
 ['website','Website','الموقع','url',300],['social_link','Social profile URL','رابط حساب التواصل','url',300],
 ['bio','Short bio','نبذة قصيرة','text',320],['theme_color','Accent color','لون البطاقة','color',7],
 ['recovery_email','Private recovery email (optional)','بريد خاص للاستعادة (اختياري)','email',160]
];
function field(form,[name,en,arabic,type,max],value='',required=false) {
  const label=tag('label',tr(en,arabic)), input=tag('input');
  input.name=name;input.type=type;input.value=value??'';input.required=required;input.maxLength=max;
  if(name==='pin') {input.inputMode='numeric';input.pattern='[0-9]{4,6}';input.autocomplete='off';}
  if(name==='code') {input.pattern='[A-Fa-f0-9]{24}';input.autocomplete='off';input.spellcheck=false;}
  if(type==='url') input.pattern='[Hh][Tt][Tt][Pp][Ss]?://.+';
  label.append(input);form.append(label);
}
const pin=['pin','PIN (4–6 digits)','الرقم السري (٤–٦ أرقام)','password',6];
function formFor(section,submit,task) {
  const form=tag('form','','fields');
  const status=tag('p','','error');status.setAttribute('role','status');
  const send=tag('button',submit,'primary');send.type='submit';
  form.addEventListener('submit',async event=>{
    event.preventDefault();send.disabled=true;status.textContent='';
    const data=Object.fromEntries(new FormData(form));
    if(data.pin==='') delete data.pin;
    try {
      for(const key of ['website','social_link']) if(data[key]&&!validURL(data[key])) throw Error(tr('Enter an http:// or https:// URL.','أدخل رابطًا يبدأ بـ http:// أو https://.'));
      await task(data);
    } catch(e) { status.textContent=e.message; }
    finally {send.disabled=false;}
  });
  section.append(form);
  return {form,finish:()=>form.append(status,send)};
}
function activation(section) {
  heading(section,tr('Activate your keychain','فعّل ميداليتك'));
  section.append(tag('p',tr('Use the claim code from your package. Contact details you enter will be public. Keep the separate backup code somewhere safe.','استخدم رمز التفعيل المرفق. بيانات الاتصال التي تضيفها ستكون عامة. احتفظ برمز الاستعادة في مكان آمن.')));
  const {form,finish}=formFor(section,tr('Activate card','تفعيل البطاقة'),async data=>{await request('/activate','POST',data);await refresh();});
  field(form,['code','Claim code','رمز التفعيل','password',24],'',true);
  for(const spec of fields) field(form,spec,spec[0]==='theme_color'?'#0D6E4F':'',spec[0]==='full_name');
  field(form,pin,'',true);finish();
}
function signIn(section,recover) {
  heading(section,recover?tr('Recover your card','استعد بطاقتك'):tr('Owner edit','تعديل البطاقة'));
  const {form,finish}=formFor(section,recover?tr('Reset PIN','إعادة تعيين الرقم السري'):tr('Unlock','فتح التعديل'),async data=>{
    const response=await request(recover?'/recover':'/verify','POST',data);
    if(response.backup_code) {
      section.replaceChildren();
      heading(section,tr('Save your new recovery code','احفظ رمز الاستعادة الجديد'));
      const code=tag('p',response.backup_code);code.dir='ltr';section.append(code);
      section.append(tag('p',tr('The old code has been used. Store this new code somewhere safe.','تم استخدام الرمز القديم. احفظ هذا الرمز الجديد في مكان آمن.')));
      section.append(button(tr('Continue','متابعة'),openEditor,'primary'));
    } else await openEditor();
  });
  if(recover) field(form,['code','Backup recovery code','رمز الاستعادة الاحتياطي','password',24],'',true);
  field(form,pin,'',true);finish();
  if(!recover) section.append(button(tr('Forgot PIN?','نسيت الرقم السري؟'),()=>showPanel('recover')));
  section.append(button(tr('Back to card','العودة إلى البطاقة'),()=>showPanel('public')));
}
let ownerData;
async function openEditor() {ownerData=await request('/owner');showPanel('edit');}
function edit(section) {
  heading(section,tr('Edit your card','عدّل بطاقتك'));
  section.append(tag('p',tr('Card views: ','مرات عرض البطاقة: ')+ownerData.scan_count));
  if(ownerData.perk) section.append(tag('p',ownerData.perk,'perk'));
  const {form,finish}=formFor(section,tr('Save changes','حفظ التعديلات'),async data=>{await request('','PUT',data);await refresh();});
  for(const spec of fields) field(form,spec,ownerData.card[spec[0]],spec[0]==='full_name');
  field(form,['lost_mode_message','Public lost-card message','رسالة عامة عند فقدان البطاقة','text',220],ownerData.card.lost_mode_message);
  field(form,['pin','New PIN (leave blank to keep it)','رقم سري جديد (اختياري)','password',6]);
  const label=tag('label',tr('Card visibility','ظهور البطاقة')),select=tag('select');
  select.name='status';
  for(const [key,title] of [['active',tr('Public','عامة')],['paused',tr('Paused / lost','متوقفة / مفقودة')]]) {
    const option=tag('option',title);option.value=key;select.append(option);
  }
  select.value=ownerData.status;label.append(select);form.append(label);finish();
  section.append(button(tr('Sign out','تسجيل الخروج'),async()=>{try{await request('/logout','POST',{});ownerData=null;await refresh();}catch(e){section.append(tag('p',e.message,'error'));}}));
}
function render() {
  if(contactURL) {URL.revokeObjectURL(contactURL);contactURL=null;}
  document.documentElement.lang=tr('en','ar');document.documentElement.dir=tr('ltr','rtl');
  get('language').textContent=tr('العربية','English');
  get('powered').textContent=tr('Powered by Pokmira','بدعم من بوك ميرا');
  get('promise').textContent=tr('Offline & private expense tracking','تتبّع مصاريفك بخصوصية وبدون إنترنت');
  owner.textContent=tr('🔒 Owner edit','🔒 تعديل المالك');owner.hidden=!state||state.status==='unclaimed';
  const links=get('brand-links');links.replaceChildren();
  for(const item of state?.brand?.links||[{label:'Learn more',url:'/'}]) {
    const url=validURL(item.url,true);if(url) links.append(link(ar&&item.label_ar?item.label_ar:item.label,url,''));
  }
  const section=tag('section');view.replaceChildren(section);
  if(!state) {
    heading(section,tr('Could not open this card','تعذّر فتح البطاقة'));
    section.append(tag('p',error),button(tr('Try again','إعادة المحاولة'),refresh));return;
  }
  if(panel==='edit') edit(section);
  else if(panel==='verify'||panel==='recover') signIn(section,panel==='recover');
  else if(state.status==='active') profile(section,state.card);
  else if(state.status==='unclaimed') activation(section);
  else {
    heading(section,tr('Card paused','البطاقة متوقفة'));
    section.append(tag('p',tr('The owner has hidden their contact details.','أخفى مالك البطاقة بيانات الاتصال.')));
    if(state.lost_mode_message) section.append(tag('p',state.lost_mode_message));
  }
}
owner.addEventListener('click',async()=>{try{await openEditor();}catch{showPanel('verify');}});
get('language').addEventListener('click',()=>{ar=!ar;try{localStorage.setItem('pm-nfc-language',tr('en','ar'));}catch{}render();});
if(token) refresh();else {error=tr('Card not found.','البطاقة غير موجودة.');render();}
