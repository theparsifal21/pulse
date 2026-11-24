/* Minimal tag reader: ID3v2.2/2.3/2.4 (MP3) and FLAC (Vorbis comments + picture). */
(function(g){
const dec=(b,e)=>{if(e===1&&b.length>1&&(b[0]===0xFE||b[0]===0xFF)){if(b[0]===0xFE)e=2;b=b.subarray(2)}
 try{return new TextDecoder(['windows-1252','utf-16le','utf-16be','utf-8'][e]||'utf-8').decode(b).replace(/\0+$/,'')}catch{return''}};
const ss=a=>(a[0]<<21)|(a[1]<<14)|(a[2]<<7)|a[3];
const T={TIT2:'title',TT2:'title',TPE1:'artist',TP1:'artist',TPE2:'albumArtist',TP2:'albumArtist',TALB:'album',TAL:'album',TRCK:'trackNo',TRK:'trackNo',TPOS:'discNo',TPA:'discNo',TYER:'year',TYE:'year',TDRC:'year',TCON:'genre',TCO:'genre'};
function id3(u){if(u.length<10||u[0]!==73||u[1]!==68||u[2]!==51)return null;const v=u[3],end=Math.min(u.length,10+ss(u.subarray(6,10))),o={},L=v===2?3:4,H=v===2?6:10;let p=10;
 if(u[5]&0x40){p+=v===4?ss(u.subarray(p,p+4)):(((u[p]<<24)|(u[p+1]<<16)|(u[p+2]<<8)|u[p+3])>>>0)+4}
 while(p+H<=end){const id=String.fromCharCode(...u.subarray(p,p+L));if(!/^[A-Z0-9]+$/.test(id))break;
  const sz=v===2?(u[p+3]<<16)|(u[p+4]<<8)|u[p+5]:v===4?ss(u.subarray(p+4,p+8)):(((u[p+4]<<24)|(u[p+5]<<16)|(u[p+6]<<8)|u[p+7])>>>0);
  if(p+H+sz>end)break;const d=u.subarray(p+H,p+H+sz);p+=H+sz;if(!d.length)continue;
  if(T[id]){const s=dec(d.subarray(1),d[0]).split('\0')[0].trim();if(s&&o[T[id]]==null)o[T[id]]=s}
  else if(id==='APIC'||id==='PIC'){const e=d[0];let q,mime;if(id==='PIC'){mime=String.fromCharCode(...d.subarray(1,4)).toUpperCase()==='PNG'?'image/png':'image/jpeg';q=4}else{const z=d.indexOf(0,1);if(z<0)continue;mime=String.fromCharCode(...d.subarray(1,z));q=z+1}
   q++;if(e===1||e===2){while(q+1<d.length&&!(d[q]===0&&d[q+1]===0))q+=2;q+=2}else{while(q<d.length&&d[q]!==0)q++;q++}
   if(!o.cover&&q<d.length)o.cover={mime:mime.startsWith('image/')?mime:'image/jpeg',data:d.slice(q)}}}
 return o}
function flac(u){if(String.fromCharCode(...u.subarray(0,4))!=='fLaC')return null;const o={},M={TITLE:'title',ARTIST:'artist',ALBUMARTIST:'albumArtist',ALBUM:'album',TRACKNUMBER:'trackNo',DISCNUMBER:'discNo',DATE:'year',GENRE:'genre'};let p=4,last=false;
 while(!last&&p+4<=u.length){const h=u[p],t=h&127,sz=(u[p+1]<<16)|(u[p+2]<<8)|u[p+3];last=!!(h&128);p+=4;if(p+sz>u.length)break;const d=u.subarray(p,p+sz);p+=sz;const v=new DataView(d.buffer,d.byteOffset,d.byteLength);
  if(t===4){let q=4+v.getUint32(0,true);const n=v.getUint32(q,true);q+=4;for(let k=0;k<n&&q+4<=d.length;k++){const l=v.getUint32(q,true);q+=4;const s=dec(d.subarray(q,q+l),3);q+=l;const i=s.indexOf('=');if(i<0)continue;const m=M[s.slice(0,i).toUpperCase()];if(m&&o[m]==null)o[m]=s.slice(i+1).trim()}}
  else if(t===6){let q=4;const ml=v.getUint32(q);q+=4;const mime=dec(d.subarray(q,q+ml),0);q+=ml;const dl=v.getUint32(q);q+=4+dl+16;const n=v.getUint32(q);q+=4;if(!o.cover&&q+n<=d.length)o.cover={mime:mime||'image/jpeg',data:d.slice(q,q+n)}}}
 return o}
const num=x=>{const n=parseInt(x,10);return n>0?n:null};
function norm(o){if(!o)return null;o.trackNo=num(o.trackNo);o.discNo=num(o.discNo);const y=String(o.year||'').match(/\d{4}/);o.year=y?+y[0]:null;if(o.genre){o.genre=o.genre.replace(/^\(\d+\)/,'').trim();if(!o.genre||/^\d+$/.test(o.genre))o.genre=null}return o}
const parseBuf=u=>norm(id3(u)||flac(u))||{};
async function parse(f){try{const h=new Uint8Array(await f.slice(0,16).arrayBuffer());
 if(h[0]===73&&h[1]===68&&h[2]===51)return parseBuf(new Uint8Array(await f.slice(0,Math.min(10+ss(h.subarray(6,10)),32<<20)).arrayBuffer()));
 if(h[0]===102&&h[1]===76&&h[2]===97&&h[3]===67)return parseBuf(new Uint8Array(await f.slice(0,Math.min(f.size,16<<20)).arrayBuffer()))}catch{}return{}}
const api={parse,parseBuf};if(typeof module!=='undefined')module.exports=api;else g.PulseMeta=api;
})(typeof window!=='undefined'?window:globalThis);
