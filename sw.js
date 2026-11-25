const C='summit-v7', ASSETS=['./','index.html','app.js','coach.js','manifest.json','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request)));});
/* Push notifications + app-icon badge */
self.addEventListener('push',e=>{
  let m={}; try{ m=e.data?e.data.json():{}; }catch(x){ m={title:'Summit',body:e.data&&e.data.text()}; }
  const jobs=[self.registration.showNotification(m.title||'⛰ Summit',{body:m.body||'',tag:m.tag||'summit',icon:'icon-512.png',badge:'icon-512.png',data:{go:m.go||''}})];
  if(typeof m.badge==='number'&&self.navigator.setAppBadge) jobs.push(m.badge>0?self.navigator.setAppBadge(m.badge):self.navigator.clearAppBadge());
  e.waitUntil(Promise.all(jobs).catch(()=>{}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close(); const url=new URL('./'+(e.notification.data&&e.notification.data.go?'?go='+e.notification.data.go:''),self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){ if('focus' in w){ w.postMessage({go:e.notification.data&&e.notification.data.go}); return w.focus(); } }
    return clients.openWindow(url); }));
});
