import {randomBytes, createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import path from 'node:path';
import {tokenPattern} from '../lib/shared.js';

const {values} = parseArgs({options:{
  origin:{type:'string'}, count:{type:'string'}, 'existing-urls':{type:'string'}, out:{type:'string'}
}});
const origin = new URL(values.origin || '');
if (origin.protocol !== 'https:' || origin.href !== origin.origin+'/' || origin.username || origin.password)
  throw Error('--origin must be the exact HTTPS origin encoded on the tags.');
if (!values.out || path.isAbsolute(values.out) || !/^[a-zA-Z0-9_-]+$/.test(values.out))
  throw Error('--out must be a new batch name with letters, numbers, hyphens or underscores.');
if (values.count && values['existing-urls']) throw Error('Choose --count or --existing-urls.');
const count = Number(values.count || 0);
const urls = values['existing-urls']
  ? (await readFile(values['existing-urls'],'utf8')).split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  : [];
if (!values['existing-urls'] && (!Number.isInteger(count) || count<1 || count>5000))
  throw Error('Use --count 1 to 5000.');
if (values['existing-urls'] && !urls.length) throw Error('The existing URL file is empty.');
const seen = new Set();
const csv = ['token,nfc_url,claim_code,backup_code'];
const sql = [];
const hash = value => createHash('sha256').update(value).digest('hex');
for (let index=0; index<(values['existing-urls'] ? urls.length : count); index++) {
  let token;
  if (values['existing-urls']) {
    const url = new URL(urls[index]);
    token = url.pathname.split('/').at(-1);
    if (urls[index] !== origin.origin+'/k/'+token || !tokenPattern.test(token) || seen.has(token))
      throw Error('Unexpected, invalid or duplicate URL on line '+(index+1)+'.');
  } else {
    do { token = randomBytes(9).toString('base64url'); } while (!tokenPattern.test(token) || seen.has(token));
  }
  seen.add(token);
  const claim = randomBytes(12).toString('hex');
  const backup = randomBytes(12).toString('hex');
  csv.push([token,origin.origin+'/k/'+token,claim,backup].join(','));
  sql.push("INSERT INTO cards (token, claim_code_hash, backup_code_hash) VALUES ('"+token+"','"+hash(claim)+"','"+hash(backup)+"');");
}
const dir = path.join('private-batches',values.out);
await mkdir('private-batches',{recursive:true,mode:0o700});
await mkdir(dir,{mode:0o700});
await writeFile(path.join(dir,'print-private.csv'),csv.join('\r\n')+'\r\n',{mode:0o600});
await writeFile(path.join(dir,'seed.sql'),sql.join('\n')+'\n',{mode:0o600});
console.log('Prepared '+seen.size+' cards in '+dir+'. Encode only nfc_url on writable tags.');
