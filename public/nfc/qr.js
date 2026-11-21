// QR Model 2, version 6-L, byte mode, mask 0. Capacity: 134 UTF-8 bytes.
export function qrSVG(value) {
  const data=new TextEncoder().encode(value);
  if(data.length>134) throw Error('This address is too long for QR.');
  const bits=[];
  const append=(n,width)=>{ for(let i=width-1;i>=0;i--) bits.push((n>>>i)&1); };
  append(4,4);append(data.length,8);
  for(const byte of data) append(byte,8);
  append(0,4);
  const words=[];
  for(let i=0;i<bits.length;i+=8) words.push(bits.slice(i,i+8).reduce((a,b)=>a*2+b,0));
  while(words.length<136) words.push((words.length-(bits.length/8))%2 ? 17 : 236);

  function mul(a,b) {
    let result=0;
    for(;b;b>>=1) { if(b&1) result^=a; a=(a<<1)^((a&128)?285:0); }
    return result;
  }
  const divisor=Array(18).fill(0);
  divisor[17]=1;
  for(let step=0,root=1;step<18;step++,root=mul(root,2)) {
    for(let i=0;i<18;i++) divisor[i]=mul(divisor[i],root)^(divisor[i+1]||0);
  }
  function correction(block) {
    const remainder=Array(18).fill(0);
    for(const byte of block) {
      const factor=byte^remainder.shift();
      remainder.push(0);
      for(let i=0;i<18;i++) remainder[i]^=mul(divisor[i],factor);
    }
    return remainder;
  }
  const left=words.slice(0,68), right=words.slice(68);
  const stream=left.flatMap((n,i)=>[n,right[i]]);
  const el=correction(left), er=correction(right);
  for(let i=0;i<18;i++) stream.push(el[i],er[i]);

  const size=41;
  const matrix=Array.from({length:size},()=>Array(size).fill(null));
  const put=(x,y,bit)=>{ if(x>=0&&y>=0&&x<size&&y<size) matrix[y][x]=bit; };
  for(let i=0;i<size;i++) { put(6,i,!(i%2));put(i,6,!(i%2)); }
  for(const [cx,cy] of [[3,3],[37,3],[3,37]]) {
    for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) {
      const distance=Math.max(Math.abs(dx),Math.abs(dy));
      put(cx+dx,cy+dy,distance!==2&&distance!==4);
    }
  }
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) put(34+dx,34+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  const format=0x77c4;
  const f=i=>(format>>>i)&1;
  for(let i=0;i<6;i++) put(8,i,f(i));
  put(8,7,f(6));put(8,8,f(7));put(7,8,f(8));
  for(let i=9;i<15;i++) put(14-i,8,f(i));
  for(let i=0;i<8;i++) put(size-1-i,8,f(i));
  for(let i=8;i<15;i++) put(8,size-15+i,f(i));
  put(8,size-8,1);
  let pos=0;
  for(let x=size-1;x>0;x-=2) {
    if(x===6) x--;
    for(let i=0;i<size;i++) for(let offset=0;offset<2;offset++) {
      const px=x-offset, y=((x+1)&2)===0 ? size-1-i : i;
      if(matrix[y][px]!==null) continue;
      const bit=(stream[pos>>3]>>>(7-(pos&7)))&1;
      put(px,y,bit^((px+y)%2===0));
      pos++;
    }
  }
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 49 49');svg.setAttribute('shape-rendering','crispEdges');
  const background=document.createElementNS(svgNS,'rect');
  background.setAttribute('width','49');background.setAttribute('height','49');background.setAttribute('fill','#fff');
  const path=document.createElementNS(svgNS,'path');
  path.setAttribute('d',matrix.flatMap((row,y)=>row.map((bit,x)=>bit?'M'+(x+4)+' '+(y+4)+'h1v1h-1z':'')).join(''));
  svg.replaceChildren(background,path);
  return svg;
}
