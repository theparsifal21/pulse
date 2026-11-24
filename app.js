'use strict';
/* PULSE – app shell. Pure logic lives in core.js, tag parsing in meta.js. */
const {shuf,parseName,removeFromQueue,insertNext,addToQueue,move,validateQueue,validateBackup,albumKey,hex}=PulseCore;
const $=s=>document.querySelector(s),a=$('#a'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>s!=null&&isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'–:––';
const toast=m=>{const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),4500)};
const prog=m=>{let e=$('#prog');if(!m){e&&e.remove();return}if(!e){e=document.createElement('div');e.id='prog';e.className='toast';e.setAttribute('role','status');document.body.append(e)}e.textContent=m};
addEventListener('unhandledrejection',e=>toast('Error: '+(e.reason?.message||e.reason)));
const S={tracks:[],pls:[],q:[],orig:[],i:-1,shuffle:false,repeat:0,url:null,listened:0,last:0,started:null,cur:null,groups:[],tok:0,rt:0,sq:0,hist:[]};
/* ---- IndexedDB (v2 adds 'covers'; existing stores/data are kept) ---- */
const db=new Promise((ok,no)=>{const r=indexedDB.open('pulse',2);r.onupgradeneeded=()=>{const d=r.result;for(const[n,o]of[['tracks',{keyPath:'id'}],['files'],['playlists',{keyPath:'id'}],['history',{keyPath:'id'}],['covers']])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,o)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>toast('Close other PULSE tabs to finish the database upgrade')});
const run=(st,mode,fn)=>db.then(d=>new Promise((ok,no)=>{const t=d.transaction(st,mode);let r;try{r=fn(t)}catch(e){try{t.abort()}catch{}return no(e)}t.oncomplete=()=>ok(r&&'result'in r?r.result:r);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||new Error('Database transaction aborted'))}));
const all=s=>run(s,'readonly',t=>t.objectStore(s).getAll()),get=(s,k)=>run(s,'readonly',t=>t.objectStore(s).get(k)),put=(s,v,k)=>run(s,'readwrite',t=>t.objectStore(s).put(v,k)),del=(s,k)=>run(s,'readwrite',t=>t.objectStore(s).delete(k));
const putIfExists=t=>run('tracks','readwrite',tr=>{const o=tr.objectStore('tracks'),q=o.get(t.id);q.onsuccess=()=>{if(q.result)o.put(t)};return q});
const saveTrack=(t,f,c)=>run(['tracks','files','covers'],'readwrite',tr=>{tr.objectStore('files').put(f,t.id);if(c)tr.objectStore('covers').put(c.blob,t.coverId);tr.objectStore('tracks').put(t)});
const plSave=p=>{p.updatedAt=new Date().toISOString();return put('playlists',p)};
/* ---- covers ---- */
const cu=new Map(),covUrl=async id=>{if(!id)return null;if(cu.has(id))return cu.get(id);const b=await get('covers',id).catch(()=>null),u=b?URL.createObjectURL(b):null;cu.set(id,u);return u};
const hydrate=(r=document)=>r.querySelectorAll('[data-cov]').forEach(async el=>{const u=await covUrl(el.dataset.cov);if(u){el.style.backgroundImage=`url("${u}")`;el.textContent=''}});
const cov=(id,c='')=>`<div class="cv ${c}"${id?` data-cov="${esc(id)}"`:''}>♪</div>`;
/* ---- dialogs ---- */
function dlg(html,onok){const d=document.createElement('dialog');d.innerHTML=`<form method="dialog">${html}<div class="act"><button value="x">Cancel</button><button value="ok" class="pri">OK</button></div></form>`;document.body.append(d);d.onclose=async()=>{const ok=d.returnValue==='ok',f=d.querySelector('form');d.remove();if(ok)try{await onok(f)}catch(e){toast('Error: '+(e.message||e))}};d.showModal()}
function menu(html){const d=document.createElement('dialog');d.className="sheet";d.innerHTML='<button class="sheet-close" aria-label="Close menu">Close</button>'+html;document.body.append(d);d.onclick=e=>{if(e.target===d||e.target.closest('[data-a],a,.sheet-close'))d.close()};d.onclose=()=>d.remove();d.showModal()}
/* ---- import ---- */
const dur=f=>new Promise(r=>{const u=URL.createObjectURL(f),x=new Audio();const end=v=>{clearTimeout(tm);x.removeAttribute('src');URL.revokeObjectURL(u);r(v)};const tm=setTimeout(()=>end(null),8000);x.preload='metadata';x.onloadedmetadata=()=>end(isFinite(x.duration)?x.duration:null);x.onerror=()=>end(null);x.src=u});
async function imp(files){files=[...files];let ok=0,dup=0;const bad=[];
for(let n=0;n<files.length;n++){const f=files[n];prog(`Importing ${n+1}/${files.length}: ${f.name}`);
 if(!/^audio\//.test(f.type)&&!/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name)){bad.push(f.name+': unsupported type');continue}
 try{const h=hex(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()));
  if(S.tracks.some(x=>x.hash===h)){dup++;if(!confirm(`"${f.name}" is an exact duplicate of a track already in your library. Import it anyway?`))continue}
  const m=await PulseMeta.parse(f),fn=parseName(f.name),d=await dur(f);if(d==null)throw new Error('could not read audio (unsupported codec or corrupt file)');
  const title=m.title||fn.title,artist=m.artist||fn.artist;
  if(!S.tracks.some(x=>x.hash===h)&&S.tracks.some(x=>!x.hash&&x.title===title&&x.artist===artist&&Math.abs((x.duration||0)-d)<1)&&!confirm(`"${title}" looks like a duplicate of an existing track. Import anyway?`))continue;
  let c=null,coverId=null;if(m.cover){coverId='c'+hex(await crypto.subtle.digest('SHA-256',m.cover.data)).slice(0,32);c={blob:new Blob([m.cover.data],{type:m.cover.mime})}}
  const t={id:crypto.randomUUID(),title,artist,albumArtist:m.albumArtist||null,album:m.album||null,trackNo:m.trackNo||null,discNo:m.discNo||null,year:m.year||null,genre:m.genre||null,coverId,hash:h,duration:d,size:f.size,format:f.name.split('.').pop().toLowerCase(),favorite:false,playCount:0,dateAdded:new Date().toISOString(),lastPlayed:null,source:{type:'local'}};
  await saveTrack(t,f,c);S.tracks.push(t);ok++}catch(e){bad.push(f.name+': '+(e.message||e))}}
prog();toast(`Imported ${ok} of ${files.length}${bad.length?` · ${bad.length} failed`:''}`);if(bad.length)console.warn('Import failures:\n'+bad.join('\n'));
if(bad.length)dlg(`<p>${bad.length} file(s) could not be imported:</p><p class="sub">${bad.slice(0,8).map(esc).join('<br>')}</p>`,()=>{});render()}
/* ---- playback ---- */
const savePending=()=>{if(S.cur&&S.listened>=3)try{localStorage['pulse.pending']=JSON.stringify({trackId:S.cur.id,startedAt:S.started,l:S.listened,d:S.cur.duration})}catch{}};
async function flush(){const t=S.cur,l=S.listened,st=S.started;S.listened=0;localStorage.removeItem('pulse.pending');if(!t||l<3)return;
await put('history',{id:crypto.randomUUID(),trackId:t.id,startedAt:st,listenedSeconds:Math.round(l),trackDuration:t.duration,completed:t.duration?l/t.duration>=.9:false});
const live=S.tracks.find(x=>x.id===t.id);if(live&&(l>=30||(t.duration&&l/t.duration>=.5))){live.playCount++;live.lastPlayed=new Date().toISOString();await putIfExists(live)}}
async function load(play=true,pos=0){const tok=++S.tok,t=S.tracks.find(x=>x.id===S.q[S.i]);a.pause();
if(!t){await flush();S.cur=null;a.removeAttribute('src');ui();return}
await flush();if(tok!==S.tok)return;S.cur=t;ui();media();
const f=await get('files',t.id).catch(()=>null);if(tok!==S.tok)return;
if(!f){toast('Audio file missing for "'+t.title+'"');a.removeAttribute('src');ui();return}
if(S.url)URL.revokeObjectURL(S.url);S.url=URL.createObjectURL(f);a.src=S.url;S.started=new Date().toISOString();S.last=pos;
if(pos)a.addEventListener('loadedmetadata',()=>{if(tok===S.tok)a.currentTime=Math.min(pos,Math.max(0,(a.duration||pos)-1))},{once:true});
if(play)try{await a.play()}catch(e){if(tok===S.tok&&e.name!=='AbortError')toast('Cannot play: '+e.message)}
if(tok===S.tok){saveQ();if(location.hash.startsWith('#/queue'))render()}}
function playList(ids,i=0,force=false){ids=ids.filter(id=>S.tracks.some(t=>t.id===id));if(!ids.length)return toast('Nothing to play');i=Math.min(Math.max(i,0),ids.length-1);if(force)S.shuffle=true;S.orig=[...ids];
if(S.shuffle){S.q=force?shuf(ids):[ids[i],...shuf(ids.filter((_,k)=>k!==i))];S.i=0}else{S.q=[...ids];S.i=i}load();saveQ();ui()}
function next(auto){if(!S.q.length)return;if(S.i+1<S.q.length)S.i++;else if(S.repeat==1)S.i=0;else{ui();return}load()}
function prev(){if(a.currentTime>3||S.i<=0){a.currentTime=0;return}S.i--;load()}
const toggle=()=>{if(!S.cur){if(S.tracks.length)playList(S.tracks.map(t=>t.id));return}if(a.paused){if(!a.getAttribute('src'))load();else a.play().catch(e=>toast('Cannot play: '+e.message))}else a.pause()};
function setShuffle(){S.shuffle=!S.shuffle;if(S.i>=0){const id=S.q[S.i];S.q=S.shuffle?[id,...shuf(S.orig.filter(x=>x!==id))]:[...S.orig];S.i=S.q.indexOf(id)}saveQ();ui();if(location.hash.startsWith('#/queue'))render()}
const saveQ=()=>{try{localStorage['pulse.q']=JSON.stringify({q:S.q,orig:S.orig,i:S.i,pos:a.currentTime||0,shuffle:S.shuffle,repeat:S.repeat})}catch{}};
a.onerror=()=>{if(!a.getAttribute('src'))return;toast('Playback failed for "'+(S.cur?.title||'track')+'". Press ⏭ to skip or ▶ to retry.');ui()};
a.onended=async()=>{await flush();if(S.repeat==2&&S.cur){S.started=new Date().toISOString();S.last=0;a.currentTime=0;a.play().catch(()=>{});return}next(true)};
a.onplay=a.onpause=ui;
const sk=$('#sk');
a.ontimeupdate=()=>{const d=a.currentTime-S.last;if(d>0&&d<2&&!a.paused)S.listened+=d;S.last=a.currentTime;$('#cu').textContent=fmt(a.currentTime);if(!sk.dragging&&a.duration)sk.value=a.currentTime/a.duration*1000;if(a.duration)$('#du').textContent=fmt(a.duration);if(Date.now()-S.sq>5000){S.sq=Date.now();saveQ()}};
sk.oninput=()=>{sk.dragging=true};sk.onchange=()=>{if(a.duration)a.currentTime=sk.value/1000*a.duration;sk.dragging=false};
$('#vl').oninput=e=>{a.volume=+e.target.value;a.muted=false;localStorage['pulse.vol']=e.target.value;ui()};$('#mu').onclick=()=>{a.muted=!a.muted;ui()};
$('#pp').onclick=toggle;$('#nx').onclick=()=>next(false);$('#pv').onclick=prev;$('#sh').onclick=setShuffle;$('#rp').onclick=()=>{S.repeat=(S.repeat+1)%3;saveQ();ui()};$('#lk').onclick=()=>S.cur&&like(S.cur.id);
function installNowPlaying(){
 const p=$('#player'), title=p.querySelector('.np .m');
 const button=document.createElement('button');button.id='playeropen';button.className='m';button.setAttribute('aria-label','Open Now Playing');button.innerHTML=title.innerHTML;title.replaceWith(button);
 p.insertAdjacentHTML('afterbegin','<div class="now-top"><button id="playerclose" aria-label="Close Now Playing">⌄</button><span>NOW PLAYING</span><a href="#/queue" id="nowqueue" aria-label="Open queue">☷</a></div>');
 p.insertAdjacentHTML('beforeend','<div class="now-extra"><button data-a="import">＋ Import music</button><a href="#/queue" id="nowqueue2">View queue</a></div>');
 function open(value){p.classList.toggle('expanded',value);$('#app').inert=value;document.body.classList.toggle('player-open',value);(value?$('#playerclose'):button).focus()}
 button.onclick=()=>{if(!p.classList.contains('expanded'))open(true)};
 $('#cv').onclick=()=>{if(!p.classList.contains('expanded'))open(true)};
 $('#playerclose').onclick=()=>open(false);
 for(const id of ['#nowqueue','#nowqueue2'])$(id).onclick=()=>open(false);
 addEventListener('keydown',e=>{if(e.key==='Escape'&&p.classList.contains('expanded')&&!document.querySelector('dialog[open]'))open(false)});
 addEventListener('hashchange',()=>{if(p.classList.contains('expanded'))open(false)});
}
installNowPlaying();
function ui(){const t=S.cur,cv=$('#cv');$('#tt').textContent=t?t.title:'Nothing playing';$('#ta').textContent=t?(t.artist||'Unknown artist'):'Import music to start';$('#pp').textContent=a.paused?'▶':'⏸';$('#pp').setAttribute('aria-label',a.paused?'Play':'Pause');$('#lk').setAttribute('aria-pressed',String(!!t?.favorite));$('#sh').setAttribute('aria-pressed',String(S.shuffle));
if(cv.dataset.cur!==(t?.id||'')){cv.dataset.cur=t?.id||'';cv.style.backgroundImage='';cv.textContent='♪';if(t?.coverId){cv.dataset.cov=t.coverId;hydrate($('.np'))}else delete cv.dataset.cov}
$('#lk').classList.toggle('on',!!t?.favorite);$('#sh').classList.toggle('on',S.shuffle);$('#rp').classList.toggle('on',S.repeat>0);$('#rp').textContent=S.repeat==2?'↻1':'↻';$('#mu').textContent=a.muted||!a.volume?'🔇':'🔊'}
async function media(){if(!('mediaSession'in navigator)||!S.cur)return;const t=S.cur,u=await covUrl(t.coverId);if(t!==S.cur)return;navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist||'',album:t.album||'',artwork:u?[{src:u}]:[{src:new URL('icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]})}
if('mediaSession'in navigator){const m=navigator.mediaSession,h=(n,f)=>{try{m.setActionHandler(n,f)}catch{}};h('play',()=>a.play());h('pause',()=>a.pause());h('previoustrack',prev);h('nexttrack',()=>next(false));h('seekto',e=>{a.currentTime=e.seekTime})}
addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName)){e.preventDefault();toggle()}});
addEventListener('pagehide',()=>{savePending();saveQ()});document.addEventListener('visibilitychange',()=>{if(document.hidden){savePending();saveQ()}});
async function like(id){const t=S.tracks.find(x=>x.id===id);if(!t)return;t.favorite=!t.favorite;await putIfExists(t);ui();render()}
/* ---- actions ---- */
const isQ=()=>location.hash.startsWith('#/queue'),ex=id=>S.tracks.some(t=>t.id===id),tr=id=>S.tracks.find(t=>t.id===id);
const act={
import:()=>$('#fi').click(),
play(el){const g=S.groups[+el.dataset.g];if(g)playList(g,g.indexOf(el.dataset.id))},
playall(el){const g=S.groups[+el.dataset.g];if(g&&g.length)playList(g,0,!!el.dataset.shuf)},
like:el=>like(el.dataset.id),
navmore(){menu(`<div class="mn"><h2>Explore PULSE</h2>${nav.filter(([k])=>!['home','library','playlists','settings'].includes(k)).map(([k,l])=>`<a href="#/${k}">${l}</a>`).join('')}<button data-a="import">Import music</button></div>`)},
more(el){const id=el.dataset.id,p=el.dataset.p;menu(`<div class="mn"><button data-a="qnext" data-id="${id}">Play next</button><button data-a="qadd" data-id="${id}">Add to queue</button><button data-a="add" data-id="${id}">Add to playlist…</button><button data-a="edit" data-id="${id}">Edit info…</button>${p?`<button data-a="unpl" data-id="${id}" data-p="${p}">Remove from this playlist</button>`:''}<button data-a="rm" data-id="${id}">Delete from library…</button></div>`)},
qnext(el){if(S.i<0)return playList([el.dataset.id]);Object.assign(S,insertNext(S,el.dataset.id));saveQ();toast('Playing next');if(isQ())render()},
qadd(el){if(S.i<0)return playList([el.dataset.id]);Object.assign(S,addToQueue(S,el.dataset.id));saveQ();toast('Added to queue');if(isQ())render()},
add(el){if(!S.pls.length)return toast('Create a playlist first');dlg(`<label>Add to playlist</label><select name="p">${S.pls.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>`,async f=>{const p=S.pls.find(x=>x.id===f.p.value);if(p.trackIds.includes(el.dataset.id))return toast('Already in "'+p.name+'"');p.trackIds.push(el.dataset.id);await plSave(p);toast('Added to '+p.name);render()})},
edit(el){const t=tr(el.dataset.id);dlg(['title','artist','album'].map(k=>`<label>${k}</label><input type="text" name="${k}" value="${esc(t[k])}">`).join(''),async f=>{t.title=f.title.value.trim()||t.title;t.artist=f.artist.value.trim()||null;t.album=f.album.value.trim()||null;await putIfExists(t);ui();render()})},
rm(el){const t=tr(el.dataset.id);dlg(`<p>Delete "${esc(t.title)}" and its audio from this device?</p>`,async()=>{const id=t.id,wasCur=S.cur?.id===id,was=!a.paused;
 if(wasCur){a.pause();await flush()}
 const r=removeFromQueue(S,id);S.q=r.q;S.orig=r.orig;S.i=r.i;S.tracks=S.tracks.filter(x=>x.id!==id);
 await run(['tracks','files'],'readwrite',x=>{x.objectStore('tracks').delete(id);x.objectStore('files').delete(id)});
 for(const p of S.pls)if(p.trackIds.includes(id)){p.trackIds=p.trackIds.filter(x=>x!==id);await plSave(p)}
 if(wasCur){S.cur=null;if(S.i>=0)await load(was);else{S.tok++;a.removeAttribute('src');ui()}}saveQ();render()})},
async unpl(el){const p=S.pls.find(x=>x.id===el.dataset.p);p.trackIds=p.trackIds.filter(x=>x!==el.dataset.id);await plSave(p);render()},
async mv(el){const p=S.pls.find(x=>x.id===el.dataset.p),i=+el.dataset.i;p.trackIds=move(p.trackIds.filter(ex),i,i+ +el.dataset.d);await plSave(p);render()},
newpl(){dlg('<label>Playlist name</label><input type="text" name="n" required autofocus>',async f=>{const n=f.n.value.trim();if(!n)return;const p={id:crypto.randomUUID(),name:n,description:'',trackIds:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await put('playlists',p);S.pls.push(p);location.hash='#/playlist/'+p.id})},
editpl(el){const p=S.pls.find(x=>x.id===el.dataset.p);dlg(`<label>Name</label><input type="text" name="n" value="${esc(p.name)}"><label>Description</label><textarea name="d" rows="3" style="width:100%">${esc(p.description)}</textarea>`,async f=>{p.name=f.n.value.trim()||p.name;p.description=f.d.value.trim();await plSave(p);render()})},
delpl(el){const p=S.pls.find(x=>x.id===el.dataset.p);dlg(`<p>Delete playlist "${esc(p.name)}"? Tracks stay in your library.</p>`,async()=>{await del('playlists',p.id);S.pls=S.pls.filter(x=>x!==p);location.hash='#/playlists'})},
qjump(el){S.i=+el.dataset.i;load()},
qrm(el){const r=removeFromQueue(S,S.q[+el.dataset.i]);Object.assign(S,{q:r.q,orig:r.orig,i:r.i});saveQ();render()},
qclear(){if(S.i<0)return;S.q=[S.q[S.i]];S.orig=[...S.q];S.i=0;saveQ();render()},
qsave(){dlg('<label>Playlist name</label><input type="text" name="n" value="Saved queue">',async f=>{const p={id:crypto.randomUUID(),name:f.n.value.trim()||'Saved queue',description:'',trackIds:[...S.q],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await put('playlists',p);S.pls.push(p);toast('Playlist saved');render()})},
async export(){const o={app:'pulse',version:2,exportedAt:new Date().toISOString(),tracks:S.tracks,playlists:S.pls,history:await all('history'),settings:{volume:a.volume}},l=document.createElement('a');l.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));l.download='pulse-backup-'+new Date().toISOString().slice(0,10)+'.json';l.click();setTimeout(()=>URL.revokeObjectURL(l.href),5000);toast('Backup exported (metadata only – audio files are not included)')},
importbk:()=>$('#fb').click(),
clrhist(){dlg('<p>Clear your whole listening history? Play counts are kept.</p>',async()=>{await run('history','readwrite',x=>x.objectStore('history').clear());toast('History cleared');render()})},
async persist(){const ok=await navigator.storage?.persist?.();toast(ok?'Persistent storage granted':'Browser declined persistent storage')}};
document.addEventListener('click',async e=>{const el=e.target.closest('[data-a]');if(!el||!act[el.dataset.a])return;try{await act[el.dataset.a](el)}catch(err){toast('Error: '+(err.message||err))}});
$('#fb').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;let o;try{o=JSON.parse(await f.text())}catch{return toast('Invalid backup: not valid JSON')}if(!validateBackup(o))return toast('Invalid backup file');
dlg(`<p>Replace your library metadata, playlists and history with this backup (${o.tracks.length} tracks, ${o.playlists.length} playlists)? Audio already on this device is kept; tracks whose audio is missing will not play.</p>`,async()=>{
 await run(['tracks','playlists','history'],'readwrite',x=>{for(const[s,k]of[['tracks','tracks'],['playlists','playlists'],['history','history']]){x.objectStore(s).clear();o[k].forEach(v=>x.objectStore(s).put(v))}});
 S.tracks=o.tracks;S.pls=o.playlists;if(typeof o.settings?.volume==='number'&&o.settings.volume>=0&&o.settings.volume<=1){a.volume=o.settings.volume;$('#vl').value=a.volume;localStorage['pulse.vol']=a.volume;}
 S.tok++;a.pause();a.removeAttribute('src');S.cur=null;S.q=[];S.orig=[];S.i=-1;saveQ();ui();
 const keys=new Set(await run('files','readonly',x=>x.objectStore('files').getAllKeys())),miss=o.tracks.filter(t=>!keys.has(t.id)).length;
 toast(`Restored ${o.tracks.length} tracks${miss?` · ${miss} have no audio on this device`:''}`);render()})};
/* ---- views (synchronous; async data is fetched in render) ---- */
const grp=ids=>S.groups.push(ids)-1;
const row=(t,g,pl,k)=>`<div class="row${S.cur?.id===t.id?' cur':''}"><button data-a="play" data-g="${g}" data-id="${t.id}" aria-label="Play ${esc(t.title)}">▶</button>${cov(t.coverId,'sm')}<div class="m"><b>${esc(t.title)}</b><span>${esc(t.artist||'Unknown artist')}${t.album?' · '+esc(t.album):''}</span></div><span class="d">${fmt(t.duration)}</span><button data-a="like" data-id="${t.id}" class="${t.favorite?'on':''}" aria-label="Like">♥</button>${pl?`<button data-a="mv" data-p="${pl}" data-i="${k}" data-d="-1" aria-label="Move up">↑</button><button data-a="mv" data-p="${pl}" data-i="${k}" data-d="1" aria-label="Move down">↓</button>`:''}<button data-a="more" data-id="${t.id}" ${pl?`data-p="${pl}"`:''} aria-label="More actions">⋯</button></div>`;
const list=(ts,pl)=>{if(!ts.length)return'';const g=grp(ts.map(t=>t.id));return`<div class="list">${ts.map((t,k)=>row(t,g,pl,k)).join('')}</div>`};
const empty=(m,btn=1)=>`<div class="empty"><div class="empty-icon" aria-hidden="true">♫</div><p>${m}</p>${btn?'<button class="pri" data-a="import">Import music</button>':''}</div>`;
const card=(href,c,t1,t2)=>`<a class="card" href="${href}">${cov(c)}<b>${esc(t1)}</b><span>${esc(t2)}</span></a>`;
const shelf=(h,cs)=>cs?`<h2>${h}</h2><div class="shelf">${cs}</div>`:'';
const groupBy=(ts,kf)=>{const m=new Map();for(const t of ts){const k=kf(t);if(!k)continue;(m.get(k)||m.set(k,[]).get(k)).push(t)}return m};
const albums=()=>[...groupBy(S.tracks,albumKey)].map(([k,ts])=>({k,title:ts[0].album,artist:ts[0].albumArtist||ts[0].artist,ts,cover:ts.find(t=>t.coverId)?.coverId,added:ts.reduce((m,t)=>t.dateAdded>m?t.dateAdded:m,'')}));
const artists=()=>[...groupBy(S.tracks,t=>t.artist)].map(([k,ts])=>({k,ts,cover:ts.find(t=>t.coverId)?.coverId})).sort((x,y)=>x.k.localeCompare(y.k));
const pcov=p=>p.trackIds.map(i=>tr(i)?.coverId).find(Boolean);
const sorts={recent:(x,y)=>y.dateAdded.localeCompare(x.dateAdded),title:(x,y)=>x.title.localeCompare(y.title),artist:(x,y)=>(x.artist||'').localeCompare(y.artist||''),album:(x,y)=>(x.album||'').localeCompare(y.album||''),duration:(x,y)=>(y.duration||0)-(x.duration||0),plays:(x,y)=>y.playCount-x.playCount,played:(x,y)=>(y.lastPlayed||'').localeCompare(x.lastPlayed||''),year:(x,y)=>(y.year||0)-(x.year||0)};
const heads=(c,sub,h1,st,g)=>`<div class="head">${cov(c,'lg')}<div><p class="sub">${sub}</p><h1>${esc(h1)}</h1><p class="stat">${st}</p></div></div>`+(g!=null?`<div class="bar"><button class="pri" data-a="playall" data-g="${g}">Play</button><button data-a="playall" data-g="${g}" data-shuf="1">Shuffle</button></div>`:'');

const importedOnlineSongs=[["Mizu","Fluor"],["BAKPAKK","DESH, Young Fly, Azahriah"],["VIDÉKI CSAJSZI","T. Danny"],["Átutazó","VALMAR, Hundred Sins"],["BOSZORKÁNY","Mehringer"],["BOTRÁNY","VINI"],["Felednéd","Azahriah, DESH"],["PANNONIA","DESH, Young Fly, Azahriah"],["Jól leszek újra","Nagy Bogi, DESH"],["Nem búcsúzom","Filo, Nagy Bogi"],["NEM ÉRI MEG","KKevin, T. Danny"],["Van Valami (feat. RZMVS)","T. Danny, RZMVS"],["BAD BUNNY","Mehringer"],["SZEPTEMBER VÉGÉN - STRESSZ","Mehringer, sosehol"],["FUEGO","Marics Peti, T. Danny"],["SZEXFANTOM - Bonus Track","BELANO, VINI"],["SUV 2","DESH, Young Fly"],["TRÉFA","BELANO, VINI"],["NEXT N GO","VINI, Nagy Bogi"],["Bulvár","Nagy Bogi"],["Dada","Manuel, Azahriah"],["SZEXI BB - Bruno","Bruno X Spacc, Bereczki Zoltán"],["PRNSTR","KKevin, Bruno X Spacc, VINI"],["TIP TIP","DESH, Young Fly, Azahriah"],["Kiskece","DESH, Young Fly"],["CIA","Marics Peti, KKevin, DZSINDZSER"],["Valencia","Tomi, VALMAR"],["Barbi Baba","Fehér Krisztián"],["NU MĂ LASĂ","Tóth Andi, BELANO"],["TISZAVIRÁG","Mehringer"],["ELSZÁLL AZ IDŐ","Kiss Kevin, Marics Peti"],["FÉLTÉGLÁK","Mehringer"],["Vadmacska","Sofi"],["SZÍVTIPRÓ","T. Danny"],["Kék Hullám Kemping","Carson Coma"],["MAMMA","KRSZ, GUCSI, EG MUSIC"],["SUV","DESH, Young Fly"],["KÉSŐ","KRSZ"],["Megcsalok veled akárkit","Marics Peti"],["Rasta G | Froppi","VINI"],["Hívlak","Szilver, Hibrid"],["Készen Állok","Szilver"],["Táncolj Velem","Szilver, Hibrid"],["Elítéltetek","Szilver"],["Rabszolga","Sofi"],["CSIKK","Marics Peti, Blansch"],["MOKKA","DESH, Young Fly"]];
function onlineSongs(){return '<h2>Spotify collection</h2><p class="sub">'+importedOnlineSongs.length+' songs · Online links · Opens YouTube Music or Spotify to find and play the song.</p><div class="list">'+importedOnlineSongs.map(([title,artist])=>{const q=encodeURIComponent(title+' '+artist);return '<div class="row"><div class="cv sm">♫</div><div class="m"><b>'+esc(title)+'</b><span>'+esc(artist)+'</span></div><a href="https://music.youtube.com/search?q='+q+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+esc(title)+' on YouTube Music">▶</a><a href="https://open.spotify.com/search/'+q+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+esc(title)+' on Spotify">Spotify</a></div>'}).join('')+'</div>'}
const views={
home(){const T=S.tracks,hr=new Date().getHours(),gr=hr<5?'Good night':hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
 if(!T.length)return`<h1>${gr}</h1><p class="sub">Listen. Collect. Discover.</p>`+ '<div class="bar"><a href="#/liked">Open imported Spotify collection</a></div>'+empty('Your local library is empty. Import audio files to begin.');
 const rec=[...T].sort(sorts.recent),al=albums().sort((x,y)=>y.added.localeCompare(x.added)),pls=S.pls.filter(p=>p.trackIds.some(ex)).sort((x,y)=>y.updatedAt.localeCompare(x.updatedAt)),fp=pls[0],fa=al[0];
 const F=fp?{n:fp.name,s:'Featured playlist',c:pcov(fp),ids:fp.trackIds.filter(ex)}:fa?{n:fa.title,s:'Featured album',c:fa.cover,ids:fa.ts.map(t=>t.id)}:{n:'Your library',s:'Recently added',c:rec[0].coverId,ids:rec.map(t=>t.id)},g=grp(F.ids),min=Math.round(S.hist.reduce((s,x)=>s+x.listenedSeconds,0)/60);
 return`<h1>${gr}</h1><p class="stat">${T.length} tracks · ${al.length} albums · ${min} min listened</p><div class="hero">${cov(F.c,'lg')}<div><p class="sub">${F.s}</p><h1>${esc(F.n)}</h1><button class="pri" data-a="playall" data-g="${g}">Play</button></div></div>`
 +shelf('Recently added albums',al.slice(0,12).map(x=>card('#/album/'+encodeURIComponent(x.k),x.cover,x.title,x.artist||'Unknown artist')).join(''))
 +shelf('Your playlists',pls.slice(0,12).map(p=>card('#/playlist/'+p.id,pcov(p),p.name,p.trackIds.length+' tracks')).join(''))
 +shelf('Artists',artists().slice(0,12).map(x=>card('#/artist/'+encodeURIComponent(x.k),x.cover,x.k,x.ts.length+' tracks')).join(''))
 +(T.some(t=>t.lastPlayed)?`<h2>Continue listening</h2>${list([...T].filter(t=>t.lastPlayed).sort(sorts.played).slice(0,5))}`:'')
 +(T.some(t=>t.playCount)?`<h2>Most played</h2>${list(T.filter(t=>t.playCount).sort(sorts.plays).slice(0,5))}`:'')+`<h2>Recently added</h2>${list(rec.slice(0,5))}`},
library(){const q=sessionStorage.q||'',s=sessionStorage.s||'recent';return`<h1>Your Library</h1><div class="bar"><input type="search" id="q" placeholder="Search title, artist, album" value="${esc(q)}" aria-label="Search library"><select id="s" aria-label="Sort">${Object.keys(sorts).map(k=>`<option ${k==s?'selected':''}>${k}</option>`).join('')}</select><button data-a="import">Import files</button><button id="imf">Import folder</button></div><div id="lst"></div>`},
albums(){const al=albums().sort((x,y)=>x.title.localeCompare(y.title));return`<h1>Albums</h1>`+(al.length?`<div class="grid">${al.map(x=>card('#/album/'+encodeURIComponent(x.k),x.cover,x.title,x.artist||'Unknown artist')).join('')}</div>`:empty('Albums appear when imported tracks have album tags (or after you edit a track\'s album).'))},
artists(){const ar=artists();return`<h1>Artists</h1>`+(ar.length?`<div class="grid">${ar.map(x=>card('#/artist/'+encodeURIComponent(x.k),x.cover,x.k,x.ts.length+' tracks')).join('')}</div>`:empty('No artists yet.'))},
album(k){const al=albums().find(x=>x.k===k);if(!al)return empty('Album not found.',0);const ts=[...al.ts].sort((x,y)=>(x.discNo||1)-(y.discNo||1)||(x.trackNo||999)-(y.trackNo||999)||x.title.localeCompare(y.title)),g=S.groups.length,yr=ts.find(t=>t.year)?.year;
 return heads(al.cover,'Album',al.title,`${esc(al.artist||'Unknown artist')}${yr?' · '+yr:''} · ${ts.length} tracks · ${fmt(ts.reduce((s,t)=>s+(t.duration||0),0))}`,g)+list(ts)},
artist(k){const ts=S.tracks.filter(t=>t.artist===k);if(!ts.length)return empty('Artist not found.',0);const al=albums().filter(x=>x.ts.some(t=>t.artist===k)),g=S.groups.length;
 return heads(ts.find(t=>t.coverId)?.coverId,'Artist',k,`${ts.length} tracks in your library · ${ts.reduce((s,t)=>s+t.playCount,0)} plays`,g)+shelf('Albums',al.map(x=>card('#/album/'+encodeURIComponent(x.k),x.cover,x.title,x.ts.length+' tracks')).join(''))+`<h2>Tracks</h2>`+list([...ts].sort(sorts.plays))},
playlists(){return`<h1>Playlists</h1><div class="bar"><button class="pri" data-a="newpl">New playlist</button></div>`+(S.pls.length?`<div class="grid">${S.pls.map(p=>card('#/playlist/'+p.id,pcov(p),p.name,p.trackIds.length+' tracks')).join('')}</div>`:empty('No playlists yet. Create one to start collecting.',0))},
playlist(id){const p=S.pls.find(x=>x.id===id);if(!p)return empty('Playlist not found.',0);const ids=p.trackIds.filter(ex),ts=ids.map(tr),g=S.groups.length;
 return heads(pcov(p),'Playlist',p.name,`${esc(p.description)||'No description'} · ${ts.length} tracks · ${fmt(ts.reduce((s,t)=>s+(t.duration||0),0))}`,ts.length?g:null)+`<div class="bar"><button data-a="editpl" data-p="${p.id}">Rename / describe</button><button data-a="delpl" data-p="${p.id}">Delete playlist</button></div>`+(ts.length?list(ts,p.id):empty('Empty playlist. Use ⋯ → Add to playlist on any track.',0))},
liked(){const t=S.tracks.filter(x=>x.favorite);return`<h1>Liked Songs</h1>`+(t.length?list(t):'')+onlineSongs()},
history(){const t=S.tracks.filter(x=>x.lastPlayed).sort(sorts.played);return`<h1>Recently Played</h1>`+(t.length?list(t):empty('Nothing played yet.',0))},
queue(){if(!S.q.length)return`<h1>Queue</h1>`+empty('The queue is empty. Play a track to fill it.',0);
 return`<h1>Queue</h1><div class="bar"><button data-a="qsave">Save as playlist</button><button data-a="qclear">Clear upcoming</button></div><div class="list">${S.q.map((id,i)=>{const t=tr(id);return t?`<div class="row${i===S.i?' cur':''}"><button data-a="qjump" data-i="${i}" aria-label="Play">▶</button><div class="m"><b>${esc(t.title)}</b><span>${i<S.i?'Played':i===S.i?'Now playing':'Next'} · ${esc(t.artist||'Unknown artist')}</span></div>${i!==S.i?`<button data-a="qrm" data-i="${i}" aria-label="Remove from queue">✕</button>`:''}</div>`:''}).join('')}</div>`},
settings(){return`<h1>Settings</h1><h2>Appearance</h2><div id="pulseAppearance"></div><h2>Storage</h2><p class="stat" id="stor">Calculating…</p><div class="bar"><button data-a="persist">Request persistent storage</button></div><p class="sub">Browsers can evict site data. Export backups regularly – they contain metadata, playlists and history, but not audio files.</p><h2>Backup</h2><div class="bar"><button data-a="export">Export backup</button><button data-a="importbk">Restore backup…</button><button data-a="clrhist">Clear listening history</button></div>`}};
const nav=[['home','Home'],['library','Library'],['albums','Albums'],['artists','Artists'],['playlists','Playlists'],['liked','Liked'],['history','Recent'],['queue','Queue'],['settings','Settings']],parent={album:'albums',artist:'artists',playlist:'playlists'};
function navIcon(k){
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({home:'<path d="M3 10 12 3l9 7v10h-6v-6H9v6H3z"/>',library:'<path d="M4 4v16M9 4v16M14 4l6 15"/>',playlists:'<path d="M3 5h14M3 10h14M3 15h8M19 10v9"/><circle cx="16" cy="19" r="3"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',back:'<path d="m15 5-7 7 7 7"/>'}[k]||'')+'</svg>'
}
function mobileNav(key){
 const page=parent[key]||key;
 return nav.map(([k,l])=>`<a href="#/${k}" data-page="${k}" class="${k===page?'act':''}" ${k===page?'aria-current="page"':''}><span class="navicon">${navIcon(k)}</span><span>${l}</span></a>`).join('')+'<button data-a="import">＋ Import</button>'+`<button class="mobile-more ${!['home','library','playlists','settings'].includes(page)?'act':''}" data-a="navmore"><span class="navicon">${navIcon('more')}</span><span>More</span></button>`;
}
function mobileShell(key,html){
 const back=parent[key];
 const head=`<header class="mobile-head">${back?`<a class="mobile-icon" href="#/${back}" aria-label="Back">${navIcon('back')}</a>`:'<a class="mobile-brand" href="#/home">PULSE<span class="brand-dot">.</span></a>'}<div class="mobile-head-actions"><a class="mobile-icon" href="#/library" aria-label="Search library">${navIcon('search')}</a></div></header>`;
 const tabs=['library','albums','artists','liked','history','playlists'].includes(key)?`<nav class="page-tabs" aria-label="Collection">${[['library','Tracks'],['albums','Albums'],['artists','Artists'],['playlists','Playlists'],['liked','Liked'],['history','Recent']].map(([id,l])=>`<a href="#/${id}" class="${id===key?'selected':''}" ${id===key?'aria-current="page"':''}>${l}</a>`).join('')}</nav>`:'';
 const quick=key==='home'?'<div class="mobile-quick"><a href="#/library"><b>♫</b>All tracks</a><a href="#/liked"><b>♥</b>Liked songs</a><a href="#/albums"><b>▣</b>Albums</a><a href="#/history"><b>◷</b>Recent</a></div>':'';
 return head+tabs+quick+html;
}
async function render(){const rt=++S.rt,[v,ra]=(location.hash.slice(2)||'home').split('/'),key=Object.hasOwn(views,v)?v:'home';let html;
 try{if(key==='home')S.hist=await all('history').catch(()=>[]);if(rt!==S.rt)return;S.groups=[];html=views[key](ra?decodeURIComponent(ra):'')}catch(e){html=`<div class="empty">Could not display this page: ${esc(e.message)}</div>`}
 $('#nav').innerHTML=mobileNav(key);
 $('#pls').innerHTML=S.pls.map(p=>`<a href="#/playlist/${p.id}" class="${ra==p.id?'act':''}">${esc(p.name)}</a>`).join('');
 const main=$('#main');const page=location.hash||'#/home';const moved=main.dataset.route!==page;main.dataset.route=page;main.dataset.page=key;main.innerHTML=mobileShell(key,html);if(moved)main.scrollTop=0;
 if(key==='library'){const draw=()=>{sessionStorage.q=$('#q').value;sessionStorage.s=$('#s').value;const q=$('#q').value.toLowerCase();S.groups=[];const ts=S.tracks.filter(t=>[t.title,t.artist,t.album].join(' ').toLowerCase().includes(q)).sort(sorts[$('#s').value]);$('#lst').innerHTML=ts.length?list(ts):empty(S.tracks.length?'No tracks match your search.':'Your library is empty.',!S.tracks.length);hydrate($('#lst'))};$('#q').oninput=draw;$('#s').onchange=draw;$('#imf').onclick=()=>$('#fd').click();draw()}
 if(key==='settings'){pulseAppearance();navigator.storage?.estimate?.().then(s=>{const m=n=>(n/1048576).toFixed(1)+' MB',e=$('#stor');if(e)e.textContent=`${m(s.usage)} used of ${m(s.quota)} (${(s.usage/s.quota*100).toFixed(1)}%)`+(s.usage/s.quota>.8?' – almost full!':'')});
 }
 hydrate($('#main'))}
addEventListener('hashchange',render);
/* ---- init ---- */
$('#fi').onchange=e=>{imp(e.target.files);e.target.value=''};$('#fd').onchange=e=>{imp(e.target.files);e.target.value=''};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer.files.length)imp(e.dataTransfer.files)});
(async()=>{try{[S.tracks,S.pls]=await Promise.all([all('tracks'),all('playlists')])}catch(e){toast('Storage unavailable: '+e.message)}
try{const p=JSON.parse(localStorage['pulse.pending']||'null');localStorage.removeItem('pulse.pending');if(p&&p.trackId&&p.l>=3)await put('history',{id:crypto.randomUUID(),trackId:p.trackId,startedAt:p.startedAt,listenedSeconds:Math.round(p.l),trackDuration:p.d,completed:p.d?p.l/p.d>=.9:false})}catch{}
const vol=parseFloat(localStorage['pulse.vol']);a.volume=vol>=0&&vol<=1?vol:.8;$('#vl').value=a.volume;
try{const s=validateQueue(JSON.parse(localStorage['pulse.q']||'null'),S.tracks.map(t=>t.id));if(s){Object.assign(S,{q:s.q,orig:s.orig,i:s.i,shuffle:s.shuffle,repeat:s.repeat});await load(false,s.pos)}}catch{}
ui();render()})();

function pulseAppearance(){const el=document.getElementById("pulseAppearance");if(!el)return;const t=window.pulseColors;el.innerHTML='<div class="appearance-row"><span>Accent color</span><div class="swatches"></div></div><div class="appearance-row"><span>Background style</span><select aria-label="Background style"></select></div><div class="appearance-row"><span>Reset to default colors</span><button class="reset-colors">Reset colors</button></div>';const w=el.querySelector(".swatches"),s=el.querySelector("select");function sync(){w.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.color.toLowerCase()===t.state.acc.toLowerCase())));p.value=t.state.acc;s.value=t.state.bg}t.accents.forEach(c=>{const b=document.createElement("button");b.className="swatch";b.dataset.color=c;b.style.background=c;b.setAttribute("aria-label","Accent color "+c);b.onclick=()=>{t.state.acc=c;t.apply();sync()};w.append(b)});const p=document.createElement("input");p.type="color";p.setAttribute("aria-label","Custom accent color");p.oninput=()=>{t.state.acc=p.value;t.apply();sync()};w.append(p);Object.entries(t.labels).forEach(([k,v])=>s.add(new Option(v,k)));s.onchange=()=>{t.state.bg=s.value;t.apply()};el.querySelector(".reset-colors").onclick=()=>{t.state.acc=t.accents[0];t.state.bg="default";t.apply();sync()};sync()}
