/* Pure logic (no DOM) – shared by the app and the Node tests. */
(function(g){
const shuf=r=>{r=[...r];for(let i=r.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[r[i],r[j]]=[r[j],r[i]]}return r};
const parseName=n=>{const b=n.replace(/\.[^.]+$/,''),m=b.match(/^(.+?)\s+-\s+(.+)$/);return m?{artist:m[1].trim(),title:m[2].trim()}:{artist:null,title:b.trim()}};
const removeFromQueue=(s,id)=>{const cur=s.q[s.i],q=s.q.filter(x=>x!==id),orig=s.orig.filter(x=>x!==id);
 if(cur===id){const before=s.q.slice(0,s.i).filter(x=>x!==id).length;return{q,orig,i:before<q.length?before:-1,removedCurrent:true}}
 return{q,orig,i:q.indexOf(cur),removedCurrent:false}};
const insertNext=(s,id)=>{const cur=s.q[s.i],q=[...s.q],orig=[...s.orig];q.splice(s.i+1,0,id);const k=orig.indexOf(cur);orig.splice(k<0?orig.length:k+1,0,id);return{q,orig}};
const addToQueue=(s,id)=>({q:[...s.q,id],orig:[...s.orig,id]});
const move=(a,i,j)=>{if(i<0||j<0||i>=a.length||j>=a.length)return[...a];const r=[...a],[x]=r.splice(i,1);r.splice(j,0,x);return r};
const validateQueue=(raw,ids)=>{if(!raw||typeof raw!=='object'||!Array.isArray(raw.q))return null;const ok=new Set(ids),q=raw.q.filter(x=>typeof x==='string'&&ok.has(x));if(!q.length)return null;
 const o=(Array.isArray(raw.orig)?raw.orig:q).filter(x=>q.includes(x)),i=Number.isInteger(raw.i)&&raw.i>=0&&raw.i<raw.q.length?q.indexOf(raw.q[raw.i]):-1;
 return{q,orig:o.length?o:q,i:i<0?0:i,pos:i>=0&&Number.isFinite(raw.pos)&&raw.pos>0?raw.pos:0,shuffle:raw.shuffle===true,repeat:[0,1,2].includes(raw.repeat)?raw.repeat:0}};
const validateBackup=o=>!!(o&&o.app==='pulse'&&Array.isArray(o.tracks)&&Array.isArray(o.playlists)&&Array.isArray(o.history)&&
 o.tracks.every(t=>t&&typeof t.id==='string'&&typeof t.title==='string')&&o.playlists.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.trackIds))&&o.history.every(h=>h&&typeof h.id==='string'));
const albumKey=t=>t.album?(t.albumArtist||t.artist||'')+'|'+t.album:null;
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const api={shuf,parseName,removeFromQueue,insertNext,addToQueue,move,validateQueue,validateBackup,albumKey,hex};
if(typeof module!=='undefined')module.exports=api;else g.PulseCore=api;
})(typeof window!=='undefined'?window:globalThis);
