const V='pulse-static-v9-spotify',F=['./','index.html','manifest.json','style.css?v=6','core.js','meta.js','app.js?v=9','logo.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('pulse-static-')&&x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin||!r.url.startsWith(self.registration.scope))return;
 e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(k=>k.put(r,c))}return x}).catch(()=>caches.match(r).then(x=>x||(r.mode==='navigate'?caches.match('index.html'):undefined))))});
