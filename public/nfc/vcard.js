const utf8 = new TextEncoder();
const escape = value => String(value ?? '').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[;,]/g,'\\$&');
function fold(line) {
  let output='', length=0;
  for(const char of line) {
    const size=utf8.encode(char).length;
    if(length+size>75) { output+='\r\n ';length=1; }
    output+=char;length+=size;
  }
  return output;
}
export function vcard(card) {
  const lines=['BEGIN:VCARD','VERSION:3.0','N;CHARSET=UTF-8:'+escape(card.full_name)+';;;;','FN;CHARSET=UTF-8:'+escape(card.full_name)];
  for (const [field,property] of Object.entries({company:'ORG;CHARSET=UTF-8',job_title:'TITLE;CHARSET=UTF-8',phone:'TEL;TYPE=CELL',email:'EMAIL;TYPE=INTERNET',website:'URL',bio:'NOTE;CHARSET=UTF-8'}))
    if(card[field]) lines.push(property+':'+escape(card[field]));
  return [...lines,'END:VCARD'].map(fold).join('\r\n')+'\r\n';
}
