/* Summit – Peaks Fitness Coach. All data lives in this phone's storage. */
const KEY = 'summit.v1', APP_VERSION = 'v7';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = d => { d = new Date(d); return new Date(d - d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const today = () => iso(new Date());
const addDays = (s,n) => { const d = new Date(s+'T12:00'); d.setDate(d.getDate()+n); return iso(d); };
const daysBetween = (a,b) => Math.round((new Date(b+'T12:00') - new Date(a+'T12:00'))/864e5);
const fmtDate = s => new Date(s+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
const hms = s => { s=Math.round(s); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0'); };
const pace = sPerMi => hms(sPerMi)+'/mi';
const M2MI = 1/1609.344, M2FT = 3.28084;
const r0 = n => Math.round(n||0);
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
function showErr(m){ const e=$('toast'); e.classList.add('err'); e.textContent='⚠ '+m; e.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>{e.style.display='none';e.classList.remove('err');},8000); }
window.addEventListener('error',ev=>showErr(ev.message||'Unknown error'));
window.addEventListener('unhandledrejection',ev=>showErr(String(ev.reason&&ev.reason.message||ev.reason)));
function toast(t){ $('toast').classList.remove('err');  const e=$('toast'); e.textContent=t; e.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>e.style.display='none',2600); }

/* ---------- STATE ---------- */
const DEFAULT = {
  settings:{maxHr:207,maxHrOtf:192,restHr:55,weight:179.3,gPerLb:1.0,ratio:{p:30,c:40,f:30},macroMode:'both',sleepGoal:7.5,waterGoal:128,pushUrl:'',reminders:{sleep:'07:00',food1:'12:30',food2:'19:30',w1:'10:00',w2:'14:00',w3:'17:30',bp:'08:00',week:'18:00'},
    clientId:'',secret:'',deviceId:'',deviceToken:'',api:'https://www.strava.com/api/v3',theme:'dark',splatCal:1},
  strava:{}, activities:[],
  races:[
    {id:'beast26',name:'Spartan Beast – Arizona',type:'spartan-beast',date:'2026-11-21',done:true,
     result:{time:10037,dist:12.99,elevFt:2106,avgHr:165,kcal:1951,gap:661,note:'Avondale, AZ · Garmin Forerunner 265'}},
    {id:'hyrox27',name:'Hyrox Solo',type:'hyrox-open',date:'2027-02-27',done:false,goal:null}],
  food:{}, favorites:[], recentFoods:[], myFoods:[],
  plan:{phase:'build',step:100,ceil:2500,floor:1600,auto:true,history:[]},
  bodycomp:[{date:'2026-07-10',bf:14.8,wt:179.3,smm:88.2,bfm:26.5,bmr:2240.4,seg:{tr:66.8,la:8.8,ra:8.9,ll:22.4,rl:22.3}}],
  labs:[], bp:[], sleep:[], water:{}, otfEmails:[]
};
let S = load();
function load(){ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s){ const m=Object.assign(structuredClone(DEFAULT),s); m.settings=Object.assign({},DEFAULT.settings,s.settings); return m; } }catch(e){} return structuredClone(DEFAULT); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); afterSave(); }catch(e){ showErr('Could not save ('+e.name+'). Phone storage may be full or blocked.'); } }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ---------- TOPO BACKGROUND (San Francisco Peaks) ---------- */
function drawTopo(){
  const svg=$('topo'), W=400, H=800; svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const peaks=[[230,300,1],[275,330,.9],[300,390,.8],[250,420,.7]]; // Humphreys, Agassiz, Fremont, Doyle
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const ph=[...Array(6)].map(()=>rnd()*6.28);
  const elev=(x,y)=>{ let z=0; for(const[px,py,h]of peaks){ const d=Math.hypot(x-px,(y-py)*.9); z+=h*Math.exp(-d*d/(2*95*95)); }
    return z+.06*Math.sin(x/37+ph[0])*Math.cos(y/53+ph[1])+.04*Math.sin((x+y)/29+ph[2]); };
  const N=60, gx=W/N, gy=H/(N*2), grid=[];
  for(let j=0;j<=N*2;j++){grid[j]=[];for(let i=0;i<=N;i++)grid[j][i]=elev(i*gx,j*gy);}
  let out=''; const gold=getComputedStyle(document.body).getPropertyValue('--gold');
  for(let k=1;k<=22;k++){ const lv=k*.07; let d='';
    for(let j=0;j<N*2;j++)for(let i=0;i<N;i++){
      const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],e=grid[j+1][i], pts=[];
      const ed=(v1,v2,x1,y1,x2,y2)=>{ if((v1-lv)*(v2-lv)<0){const t=(lv-v1)/(v2-v1);pts.push([(x1+(x2-x1)*t)*gx,(y1+(y2-y1)*t)*gy]);} };
      ed(a,b,i,j,i+1,j);ed(b,c,i+1,j,i+1,j+1);ed(c,e,i+1,j+1,i,j+1);ed(e,a,i,j+1,i,j);
      if(pts.length>=2) d+=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`;
    }
    const idx=k%5===0; out+=`<path d="${d}" fill="none" stroke="${idx?gold:'#7fa58e'}" stroke-opacity="${idx?.35:.18}" stroke-width="${idx?1.1:.6}"/>`;
  }
  out+=`<text x="236" y="296" fill="${gold}" fill-opacity=".5" font-size="9" font-family="sans-serif">▲ Humphreys 12,633′</text>`;
  svg.innerHTML=out;
}

/* ---------- NAV / SHEETS ---------- */
const TITLES={today:['Today','Fuel the climb'],train:['Train','Strava · Garmin · OTF'],race:['Race','Base camp → summit'],health:['Health','Sleep · Labs · BP · Body comp'],set:['Setup','Settings']};
document.querySelectorAll('nav button[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
function go(v){ document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  document.querySelectorAll('nav button[data-v]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
  $('hdrTitle').textContent=TITLES[v][0]; $('hdrSub').textContent=TITLES[v][1]; render(); scrollTo(0,0); }
function openSheet(id){ $(id).classList.add('on'); const d=today(); ['otf_date','bc_date','bp_date','lab_date'].forEach(x=>{if($(x)&&!$(x).value)$(x).value=d;}); }
function closeSheet(id){ $(id).classList.remove('on'); if(id==='foodSheet') stopScan(); }
function setSeg(id,attr,val){ document.querySelectorAll('#'+id+' button').forEach(b=>b.classList.toggle('on',b.dataset[attr]===val)); }

/* ---------- CALORIE PLAN (load/cut weeks) ---------- */
function weekStart(d){ const x=new Date(d+'T12:00'); x.setDate(x.getDate()-((x.getDay()+6)%7)); return iso(x); }
function advancePlan(){
  const P=S.plan, ws=weekStart(today());
  if(!P.history.length){ P.history.push({week:ws,kcal:2000,phase:P.phase}); save(); return; }
  let last=P.history[P.history.length-1];
  while(daysBetween(last.week,ws)>=7){
    let k=last.kcal;
    if(P.phase==='build'){ if(k>=P.ceil&&P.auto){P.phase='cut';k=Math.max(P.floor,k-P.step);} else k=Math.min(P.ceil,k+P.step); }
    else if(P.phase==='cut'){ if(k<=P.floor&&P.auto){P.phase='build';k=Math.min(P.ceil,k+P.step);} else k=Math.max(P.floor,k-P.step); }
    last={week:addDays(last.week,7),kcal:k,phase:P.phase}; P.history.push(last);
  }
  save();
}
const curKcal = () => S.plan.history[S.plan.history.length-1].kcal;
function targets(){
  const s=S.settings, k=curKcal(), r=s.ratio, sum=(+r.p)+(+r.c)+(+r.f)||100;
  if(s.macroMode==='ratio') return {k,p:k*r.p/sum/4,c:k*r.c/sum/4,f:k*r.f/sum/9};
  const p=s.gPerLb*s.weight, rem=Math.max(0,k-p*4), cf=(+r.c)+(+r.f)||1;
  return {k,p,c:rem*r.c/cf/4,f:rem*r.f/cf/9};
}

/* ---------- FOOD ---------- */
let day=today(), meal='Breakfast';
function shiftDay(n){ day=addDays(day,n); render(); }
const dayFood = d => S.food[d] || (S.food[d]=[]);
function totals(d){ return (S.food[d]||[]).reduce((a,x)=>{a.k+=x.k*x.q;a.p+=x.p*x.q;a.c+=x.c*x.q;a.f+=x.f*x.q;a.fi+=(x.fi||0)*x.q;a.na+=(x.na||0)*x.q;return a;},{k:0,p:0,c:0,f:0,fi:0,na:0}); }
function renderToday(){
  $('dayLbl').textContent = day===today()?'Today':fmtDate(day);
  const T=targets(), t=totals(day), left=T.k-t.k;
  $('kcalLeft').textContent=r0(left); $('kcalEaten').textContent=r0(t.k); $('kcalGoal').textContent=r0(T.k);
  $('kcalLeft').style.color = left<0?'var(--red)':'';
  const pct=Math.min(1,t.k/T.k), C=2*Math.PI*50;
  $('ring').innerHTML=`<circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/>
   <circle cx="60" cy="60" r="50" fill="none" stroke="${left<0?'var(--red)':'var(--gold)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C*pct} ${C}" transform="rotate(-90 60 60)" style="transition:stroke-dasharray .7s"/>
   <path d="M38 78 L52 52 L60 64 L68 50 L84 78Z" fill="var(--snow)" opacity=".85"/><path d="M52 52 L56 58 L60 64 L62 58 L68 50 L64 56Z" fill="var(--gold)"/>`;
  const ph=S.plan.phase; $('phasePill').innerHTML=`<span class="pill ${ph==='cut'?'red':ph==='hold'?'blue':''}">${ph==='build'?'⛰ Load week':ph==='cut'?'⬇ Cut week':'⛺ Hold week'}</span>`;
  $('macroBars').innerHTML=[['Protein','p','--p'],['Carbs','c','--c'],['Fat','f','--f']].map(([n,k,v])=>
    `<div class="macro"><div class="row between small"><b>${n}</b><span>${r0(t[k])} / ${r0(T[k])} g</span></div><div class="bar"><i style="width:${Math.min(100,t[k]/T[k]*100)}%;background:var(${v})"></i></div></div>`).join('');
  $('meals').innerHTML=['Breakfast','Lunch','Dinner','Snacks'].map(m=>{
    const items=dayFood(day).map((x,i)=>[x,i]).filter(([x])=>x.meal===m), mk=items.reduce((a,[x])=>a+x.k*x.q,0);
    return `<div style="margin-bottom:10px"><div class="row between"><b>${m}</b><span class="small mute">${r0(mk)} kcal <button class="sm ghost" onclick="meal='${m}';openFood()">+</button></span></div>
    ${items.map(([x,i])=>`<div class="row between small" style="padding:4px 0"><span>${esc(x.name)} <span class="mute">×${+x.q.toFixed(2)}</span></span><span>${r0(x.k*x.q)} <button class="sm ghost" onclick="delFood(${i})">✕</button></span></div>`).join('')}</div>`; }).join('');
  const ls=S.sleep.find(x=>x.date===today());
  $('sleepPrompt').innerHTML=day!==today()?'':ls
    ?`<div class="card"><div class="row between"><span>🌙 Last night: <b>${ls.hrs} h</b> · restful <b>${ls.rest}/10</b></span><button class="sm ghost" onclick="openSleep('${ls.date}')">Edit</button></div></div>`
    :`<div class="card" style="border-color:var(--violet)"><div class="row between"><span>🌙 How did you sleep last night?</span><button class="sm" style="background:var(--violet)" onclick="openSleep()">Log</button></div></div>`;
  const lastBp=S.bp[S.bp.length-1];
  $('bpPrompt').innerHTML=(!lastBp||daysBetween(lastBp.date,today())>=30)?`<div class="card" style="border-color:var(--gold)"><div class="row between"><span>🩺 Monthly blood pressure check is due</span><button class="sm" onclick="openSheet('bpSheet')">Log</button></div></div>`:'';
  renderWater(); renderChecklist();
  if(typeof renderCoachCard==='function') renderCoachCard();
}
/* ---------- WATER ---------- */
function addWater(oz){ if(!oz) return; const d=day, before=S.water[d]||0; S.water[d]=Math.max(0,Math.round((before+oz)*10)/10); save();
  const g=S.settings.waterGoal; if(before<g&&S.water[d]>=g) toast('💧 Water goal hit! Summit hydrated.'); renderWater(); }
function renderWater(){ const oz=S.water[day]||0, g=S.settings.waterGoal||128, p=Math.min(1,oz/g);
  $('waterOz').textContent=r0(oz); $('waterGoal').textContent=g; $('waterBar').style.width=(p*100)+'%';
  $('waterPct').innerHTML=p>=1?'<span class="pill green">✓ Goal</span>':`${r0(g-oz)} oz to go`;
  const h=new Date().getHours(), expected=day===today()?g*Math.max(0,Math.min(1,(h-7)/14)):g;
  $('waterBottles').innerHTML=day===today()&&oz<expected-16?`<span style="color:var(--gold)">Behind pace (~${r0(expected)} oz by now)</span>`:`${(oz/8).toFixed(0)} cups`; }
function delFood(i){ dayFood(day).splice(i,1); save(); render(); }
function copyYesterday(){ const y=S.food[addDays(day,-1)]||[]; if(!y.length) return toast('Nothing logged yesterday'); y.forEach(x=>dayFood(day).push({...x})); save(); render(); toast('Copied '+y.length+' items'); }
function openFood(){ openSheet('foodSheet'); setSeg('mealSeg','m',meal); renderRecent(); }
document.querySelectorAll('#mealSeg button').forEach(b=>b.onclick=()=>{meal=b.dataset.m;setSeg('mealSeg','m',meal);});
function logFood(f,q){ dayFood(day).push({meal,name:f.name,k:f.k,p:f.p,c:f.c,f:f.f,fi:f.fi||0,na:f.na||0,q,serv:f.serv,t:Date.now()});
  S.recentFoods=[f,...S.recentFoods.filter(x=>x.name!==f.name)].slice(0,40); save(); render(); renderRecent(); toast('Logged '+f.name); }
function renderRecent(){
  const fav=new Set(S.favorites.map(x=>x.name)), seen=new Set(), list=[];
  [...S.favorites,...S.myFoods,...S.recentFoods].forEach(f=>{ if(!seen.has(f.name)){seen.add(f.name);list.push(f);} });
  window._recent=list.slice(0,40);
  $('recent').innerHTML=_recent.length?_recent.map((f,i)=>`<div class="row between"><span onclick="servingSheet(_recent[${i}])"><b>${fav.has(f.name)?'★ ':f.custom?'📷 ':''}${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · ${esc(f.serv||'1 serving')}</span></span><button class="sm" onclick="logFood(_recent[${i}],1)">+</button></div>`).join(''):'<div class="small mute">Foods you log show up here.</div>';
}
function quickAdd(){ const f={name:$('qa_name').value||'Quick add',k:+$('qa_k').value||0,p:+$('qa_p').value||0,c:+$('qa_c').value||0,f:+$('qa_f').value||0,serv:'1 serving'};
  logFood(f,1); ['qa_name','qa_k','qa_p','qa_c','qa_f'].forEach(x=>$(x).value=''); }
function offToFood(p){
  const n=p.nutriments||{}, hasServ=n['energy-kcal_serving']!=null, g=k=>hasServ?(n[k+'_serving']||0):(n[k+'_100g']||0);
  return {name:[p.brands&&p.brands.split(',')[0],p.product_name].filter(Boolean).join(' – ')||'Unknown',
    k:hasServ?n['energy-kcal_serving']:(n['energy-kcal_100g']||0),p:g('proteins'),c:g('carbohydrates'),f:g('fat'),fi:g('fiber'),na:g('sodium')*1000,
    serv:hasServ?(p.serving_size||'1 serving'):'100 g',code:p.code};
}
async function searchFood(){
  const q=$('q').value.trim(); if(!q) return;
  const mine=S.myFoods.filter(f=>f.name.toLowerCase().includes(q.toLowerCase()));
  $('results').innerHTML='<div class="small mute">Searching…</div>';
  let items=[...mine];
  try{ const r=await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20&fields=product_name,brands,nutriments,serving_size,code&search_terms='+encodeURIComponent(q));
    const j=await r.json(); items=items.concat((j.products||[]).filter(p=>p.product_name).map(offToFood)); }catch(e){}
  window._res=items;
  $('results').innerHTML=items.length?items.map((f,i)=>`<div class="row between" onclick="servingSheet(_res[${i}])"><span><b>${f.custom?'📷 ':''}${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)} per ${esc(f.serv)}</span></span><span>›</span></div>`).join('')
    :'<div class="small mute">No matches. <a style="color:var(--gold)" onclick="openLabel()">Scan the label</a> or use Quick add.</div>';
}
function servingSheet(f){
  window._sf=f; const isFav=S.favorites.some(x=>x.name===f.name);
  $('servBody').innerHTML=`<h3 style="margin-top:0">${esc(f.name)}</h3><div class="small mute">Per ${esc(f.serv)}: ${r0(f.k)} kcal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)}</div>
   <label>Number of servings${f.serv==='100 g'?' (×100 g)':''}</label><input id="sv_q" type="text" inputmode="decimal" value="1">
   <div class="row" style="margin-top:12px"><button class="ghost" onclick="toggleFav()">${isFav?'★ Unfavorite':'☆ Favorite'}</button><button style="flex:1" onclick="logFood(_sf,parseFloat($('sv_q').value)||1);closeSheet('servSheet')">Add to ${meal}</button></div>`;
  openSheet('servSheet');
}
function toggleFav(){ const f=_sf, i=S.favorites.findIndex(x=>x.name===f.name); i>=0?S.favorites.splice(i,1):S.favorites.push(f); save(); servingSheet(f); renderRecent(); }

/* Barcode */
let scanner=null, pendingCode=null;
async function startScan(){
  if(!window.Html5Qrcode) return toast('Scanner needs internet the first time');
  stopScan(); const F=Html5QrcodeSupportedFormats;
  scanner=new Html5Qrcode('reader',{formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E]});
  try{ await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:120}},code=>{ stopScan(); lookupBarcode(code); }); }
  catch(e){ toast('Camera unavailable – allow camera access'); }
}
function stopScan(){ if(scanner){ const s=scanner; scanner=null; s.stop().catch(()=>{}).finally(()=>{try{s.clear()}catch(e){}}); } }
async function lookupBarcode(code){
  const mine=S.myFoods.find(f=>f.code===code); if(mine) return servingSheet(mine);
  toast('Looking up '+code);
  try{ const j=await (await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size,code`)).json();
    if(j.status===1&&j.product&&j.product.nutriments&&(j.product.nutriments['energy-kcal_serving']!=null||j.product.nutriments['energy-kcal_100g']!=null)) return servingSheet(offToFood(j.product));
  }catch(e){}
  openLabel(code); $('lbStatus').innerHTML=`Barcode <b>${esc(code)}</b> isn't in the database. Snap the label once and it'll be remembered next time you scan it.`;
}

/* Nutrition-label scanner (on-device OCR) */
function openLabel(code){ ['lb_name','lb_serv','lb_k','lb_p','lb_c','lb_f','lb_fi','lb_su','lb_na'].forEach(x=>$(x).value=''); $('lb_q').value=1;
  $('lb_img').style.display='none'; $('lbStatus').textContent=''; $('lbCheck').textContent=''; pendingCode=typeof code==='string'?code:null; openSheet('labelSheet'); }
let tesseractLoading=null;
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function loadTesseract(){ return tesseractLoading||(tesseractLoading=(window.Tesseract?Promise.resolve():loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')).catch(e=>{tesseractLoading=null;throw e;})); }
function prepCanvas(src,maxW=1800){ // grayscale + contrast for better OCR
  const sc=Math.min(1,maxW/src.width), c=document.createElement('canvas'); c.width=src.width*sc; c.height=src.height*sc;
  const x=c.getContext('2d'); x.drawImage(src,0,0,c.width,c.height); const d=x.getImageData(0,0,c.width,c.height), p=d.data;
  for(let i=0;i<p.length;i+=4){ let g=.299*p[i]+.587*p[i+1]+.114*p[i+2]; g=Math.max(0,Math.min(255,(g-128)*1.6+128)); p[i]=p[i+1]=p[i+2]=g; }
  x.putImageData(d,0,0); return c;
}
function fileToImage(file){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=URL.createObjectURL(file); }); }
async function ocrSource(src,status){ $(status).textContent='Reading on your phone… (first time downloads the reader)'; await loadTesseract();
  const r=await Tesseract.recognize(prepCanvas(src),'eng'); return r.data.text; }
async function ocr(file,status){ const t=await ocrSource(await fileToImage(file),status); $(status).textContent=''; return t; }
function parseLabelText(raw){
  let t=raw.replace(/[|]/g,' ').replace(/(\d),(\d{3})/g,'$1$2');
  for(let i=0;i<3;i++) t=t.replace(/(\d)[Oo]/g,'$10');
  t=t.replace(/\b[Oo](\s*m?g)\b/g,'0$1').replace(/(\d)\s*[q9](?=\s|$)/gm,'$1g');
  const num=re=>{ const m=t.match(re); return m?parseFloat(m[1]):null; };
  return { serv:(t.match(/serving\s*size\s*[:\-]?\s*([^\n]{1,40})/i)||[])[1]?.trim()||'',
    k:num(/calories(?!\s*from)[^\d\n]{0,12}\n?\s*(\d{1,4})/i), f:num(/total\s*fat\s*(\d+(?:\.\d+)?)\s*g/i), c:num(/total\s*carb\w*\.?\s*(\d+(?:\.\d+)?)\s*g/i),
    p:num(/protein\s*(\d+(?:\.\d+)?)\s*g/i), fi:num(/(?:dietary\s*)?fiber\s*(\d+(?:\.\d+)?)\s*g/i),
    su:num(/total\s*sugars?\s*(\d+(?:\.\d+)?)\s*g/i)??num(/sugars?\s*(\d+(?:\.\d+)?)\s*g/i), na:num(/sodium\s*(\d+(?:\.\d+)?)\s*mg/i) };
}
async function ocrLabel(file){
  if(!file) return; $('lb_img').src=URL.createObjectURL(file); $('lb_img').style.display='block';
  let txt; try{ txt=await ocr(file,'lbStatus'); }catch(e){ $('lbStatus').textContent='Could not read the photo – type the numbers in.'; return; }
  const L=parseLabelText(txt), set=(id,v)=>{ if(v!=null&&v!=='') $(id).value=v; };
  set('lb_serv',L.serv); set('lb_k',L.k); set('lb_p',L.p); set('lb_c',L.c); set('lb_f',L.f); set('lb_fi',L.fi); set('lb_su',L.su); set('lb_na',L.na);
  const found=['k','p','c','f'].filter(k=>L[k]!=null).length;
  $('lbStatus').textContent=found===4?'Found all the main numbers — give them a quick check.':`Found ${found}/4 main numbers. Fill in the rest, or retake the photo flatter and closer.`;
  labelCheck();
}
function labelCheck(){ const k=+$('lb_k').value, est=(+$('lb_p').value)*4+(+$('lb_c').value)*4+(+$('lb_f').value)*9;
  if(!k||!est){ $('lbCheck').textContent=''; return; } const off=Math.abs(est-k)/k;
  $('lbCheck').innerHTML=off>.2?`<span class="flag">⚠ Macros add up to ~${r0(est)} kcal but label says ${k}. One number may be misread.</span>`:`<span style="color:var(--green)">✓ Macros add up (~${r0(est)} kcal)</span>`; }
document.addEventListener('input',e=>{ if(['lb_k','lb_p','lb_c','lb_f'].includes(e.target.id)) labelCheck(); });
function saveLabel(){
  const f={name:$('lb_name').value.trim()||'Scanned food',serv:$('lb_serv').value.trim()||'1 serving',k:+$('lb_k').value||0,p:+$('lb_p').value||0,c:+$('lb_c').value||0,f:+$('lb_f').value||0,
    fi:+$('lb_fi').value||0,su:+$('lb_su').value||0,na:+$('lb_na').value||0,custom:true,code:pendingCode||null};
  if(!f.k&&!f.p&&!f.c&&!f.f) return toast('Enter at least calories');
  S.myFoods=[f,...S.myFoods.filter(x=>x.name!==f.name&&(!f.code||x.code!==f.code))]; pendingCode=null;
  logFood(f,parseFloat($('lb_q').value)||1); closeSheet('labelSheet');
}

/* ---------- SLEEP ---------- */
let slRest=null;
function parseHours(v){ v=String(v||'').trim().replace(',','.'); if(!v) return null;
  let m=v.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})\s*m?$/i); if(m) return +m[1]+ +m[2]/60;   // 7:30, 7h30
  m=v.match(/^(\d{1,2}(?:\.\d+)?)\s*h?$/i); return m?+m[1]:null; }
function stepSleep(d){ const cur=parseHours($('sl_h').value)??S.settings.sleepGoal; $('sl_h').value=Math.max(0,Math.min(16,Math.round((cur+d)*4)/4)); }
function normSleep(){ const h=parseHours($('sl_h').value); if(h!=null) $('sl_h').value=Math.round(h*4)/4; }
function setRest(n){ slRest=n; $('sl_rv').textContent=n; document.querySelectorAll('#sl_rate button').forEach(b=>b.classList.toggle('on',+b.dataset.r===n)); }
function loadSleepFor(d){ const e=S.sleep.find(x=>x.date===d); $('sl_h').value=e?e.hrs:''; setRest(e?e.rest:null); if(!e) $('sl_rv').textContent='–'; $('sl_del').style.display=e?'block':'none'; }
function openSleep(d){
  if(!$('sl_rate').children.length) $('sl_rate').innerHTML=[...Array(10)].map((_,i)=>`<button type="button" data-r="${i+1}" onclick="setRest(${i+1})">${i+1}</button>`).join('');
  d=typeof d==='string'?d:today(); $('sl_date').value=d; loadSleepFor(d); openSheet('sleepSheet'); }
function saveSleep(){ const d=$('sl_date').value||today(), h=parseHours($('sl_h').value);
  if(h==null||h<=0||h>16) return toast('Enter hours slept (e.g. 7.5 or 7:30)');
  if(!slRest) return toast('Tap a restfulness number 1–10');
  S.sleep=S.sleep.filter(x=>x.date!==d); S.sleep.push({date:d,hrs:Math.round(h*100)/100,rest:slRest}); S.sleep.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeSheet('sleepSheet'); render(); toast(h>=S.settings.sleepGoal?'Well rested 🌙':'Logged – go easy if you feel it'); }
function deleteSleep(){ const d=$('sl_date').value; if(!confirm('Delete sleep for '+fmtDate(d)+'?')) return; S.sleep=S.sleep.filter(x=>x.date!==d); save(); closeSheet('sleepSheet'); render(); }
function sleepWindow(n){ const c=addDays(today(),-n); return S.sleep.filter(x=>x.date>c); }
function renderSleep(){
  const w=sleepWindow(7), w30=sleepWindow(30), g=S.settings.sleepGoal;
  if(!S.sleep.length){ $('sleep').innerHTML='<div class="mute small">Log hours + how restful you felt each morning. The coach uses it to tune training and recovery advice.</div>'; return; }
  const ah=avg(w.map(x=>x.hrs)), ar=avg(w.map(x=>x.rest)), debt=w.reduce((a,x)=>a+Math.max(0,g-x.hrs),0);
  const days=[...Array(14)].map((_,i)=>addDays(today(),i-13)), mx=Math.max(g+1.5,...S.sleep.map(x=>x.hrs));
  const bars=days.map((d,i)=>{ const e=S.sleep.find(x=>x.date===d), H=e?70*e.hrs/mx:0, col=!e?'transparent':e.rest>=7?'var(--green)':e.rest>=4?'var(--gold)':'var(--red)';
    return `<g onclick="openSleep('${d}')"><rect x="${i*22}" y="0" width="22" height="96" fill="transparent"/><rect x="${i*22+3}" y="${78-H}" width="16" rx="4" height="${H}" fill="${col}" opacity=".85"/><text x="${i*22+11}" y="92" font-size="8" fill="var(--mute)" text-anchor="middle">${new Date(d+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'})}</text></g>`; }).join('');
  $('sleep').innerHTML=`<div class="grid3"><div><div class="big" style="font-size:24px">${ah?ah.toFixed(1):'–'}</div><div class="small mute">avg hrs (7d)</div></div>
    <div><div class="big" style="font-size:24px">${ar?ar.toFixed(1):'–'}</div><div class="small mute">restful /10</div></div>
    <div><div class="big" style="font-size:24px;color:${debt>3?'var(--red)':'var(--ink)'}">${debt.toFixed(1)}</div><div class="small mute">hrs sleep debt</div></div></div>
    <svg viewBox="0 0 308 96" width="100%" style="margin-top:10px"><line x1="0" x2="308" y1="${78-70*g/mx}" y2="${78-70*g/mx}" stroke="var(--violet)" stroke-dasharray="3 4"/>${bars}</svg>
    <div class="small mute">Tap any bar to edit that night. Color = restfulness (green 7+, gold 4–6, red ≤3). Dashed line = ${g} h goal.</div>
    <div class="list" style="margin-top:8px">${S.sleep.slice(-5).reverse().map(x=>`<div class="row between small" onclick="openSleep('${x.date}')"><span>${fmtDate(x.date)}</span><b>${x.hrs} h · ${x.rest}/10</b><span class="mute">Edit ›</span></div>`).join('')}</div>`;
}

/* ---------- STRAVA ---------- */
function stravaConnect(){
  saveSettings(true); const s=S.settings; if(!s.clientId) return toast('Enter your Client ID first');
  location.href=`https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(s.clientId)}&redirect_uri=${encodeURIComponent(location.origin+location.pathname)}&response_type=code&approval_prompt=auto&scope=read,activity:read_all`;
}
async function tokenCall(params){
  const s=S.settings, body=new URLSearchParams({client_id:s.clientId,client_secret:s.secret,...params});
  const j=await (await fetch('https://www.strava.com/oauth/token',{method:'POST',body})).json();
  if(!j.access_token) throw new Error(j.message||'Token error');
  S.strava={...S.strava,access:j.access_token,refresh:j.refresh_token,expires:j.expires_at,athlete:(j.athlete&&j.athlete.firstname)||S.strava.athlete}; save(); return j;
}
async function exchangeCode(code){ try{ await tokenCall({code,grant_type:'authorization_code'}); toast('Strava connected!'); stravaSync(); }catch(e){ toast('Strava: '+e.message); } render(); }
function pasteCode(){ const c=prompt('Paste the Strava code shown after you approved access:'); if(c) exchangeCode(c.trim()); }
async function stravaToken(){
  if(!S.strava.refresh) throw new Error('Not connected – see Setup');
  if(Date.now()/1000 > (S.strava.expires||0)-120) await tokenCall({grant_type:'refresh_token',refresh_token:S.strava.refresh});
  return S.strava.access;
}
const isOtf = a => /orange|otf|\b2g\b|\b3g\b|tread|strength 50/i.test(a.name||'') || ['HighIntensityIntervalTraining','Workout','WeightTraining','Crossfit'].includes(a.sport_type||a.type);
async function stravaSync(){
  const s=S.settings; $('syncState').textContent='Syncing…';
  try{
    const H={Authorization:'Bearer '+await stravaToken()};
    const after=S.strava.lastSync?Math.floor(S.strava.lastSync/1000)-86400*2:Math.floor(Date.now()/1000)-86400*180;
    let page=1, got=[];
    while(page<10){ const r=await fetch(`${s.api}/athlete/activities?after=${after}&per_page=100&page=${page}`,{headers:H});
      if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json(); got=got.concat(j); if(j.length<100)break; page++; }
    let streamsLeft=60;
    for(const a of got){
      const otf=isOtf(a), max=otf?s.maxHrOtf:s.maxHr, ex=S.activities.find(x=>x.id===a.id);
      const rec={id:a.id,name:a.name,type:a.sport_type||a.type,otf,date:a.start_date_local.slice(0,10),hour:+a.start_date_local.slice(11,13),dist:a.distance||0,moving:a.moving_time||0,elapsed:a.elapsed_time||0,
        elev:a.total_elevation_gain||0,avgHr:a.average_heartrate||null,maxHr:a.max_heartrate||null,kcal:a.calories||(a.kilojoules?a.kilojoules*1.1:null),
        zones:ex&&ex.zones, splatEst:ex&&ex.splatEst, splatActual:ex&&ex.splatActual};
      if(a.has_heartrate&&!rec.zones&&streamsLeft-->0){
        try{ const sr=await fetch(`${s.api}/activities/${a.id}/streams?keys=heartrate,time&key_by_type=true`,{headers:H});
          if(sr.ok){ const st=await sr.json(), hr=st.heartrate&&st.heartrate.data, tm=st.time&&st.time.data;
            if(hr&&tm){ const z=[0,0,0,0,0]; for(let i=1;i<hr.length;i++) z[zoneOf(hr[i],max)]+=Math.min(30,tm[i]-tm[i-1]);
              rec.zones=z.map(x=>x/60); rec.splatEst=Math.round(rec.zones[3]+rec.zones[4]); } } }catch(e){}
      }
      ex?Object.assign(ex,rec):S.activities.push(rec);
    }
    S.activities.sort((a,b)=>b.date.localeCompare(a.date)); S.strava.lastSync=Date.now(); save();
    $('syncState').textContent=''; toast(`Synced ${got.length} activities`);
  }catch(e){ $('syncState').textContent=''; toast('Sync: '+e.message); }
  render();
}
function zoneOf(hr,max){ const p=hr/max; return p<.61?0:p<.71?1:p<.84?2:p<.92?3:4; } // OTF grey/blue/green/orange/red
const ZC=['#8a9590','#4f9bd9','#5fbf6f','#f08a24','#e0453a'];

/* ---------- OTF EMAIL ---------- */
function parseOtf(){
  const t=$('otf_txt').value, num=re=>{const m=t.match(re);return m?+m[1].replace(/,/g,''):null;};
  const sp=num(/splat\s*points?\D{0,20}(\d+)/i)??num(/(\d+)\s*splat/i);
  const k=num(/calories?(?:\s*burned)?\D{0,20}([\d,]+)/i)??num(/([\d,]+)\s*(?:cal|calories)/i);
  const h=num(/(?:avg|average)\.?\s*(?:heart\s*rate|hr)\D{0,20}(\d+)/i);
  const dm=t.match(/(\w+day,?\s+)?(\w+\s+\d{1,2},?\s+\d{4})/); if(dm){const d=new Date(dm[2]); if(!isNaN(d)) $('otf_date').value=iso(d);}
  if(sp!=null)$('otf_s').value=sp; if(k!=null)$('otf_k').value=k; if(h!=null)$('otf_h').value=h;
  toast(sp!=null?'Found '+sp+' splats':"Couldn't find splats – type them in");
}
function saveOtf(){
  const d=$('otf_date').value, sp=+$('otf_s').value; if(!d||!$('otf_s').value) return toast('Need date and splats');
  S.otfEmails.push({date:d,splats:sp,kcal:+$('otf_k').value||null,avgHr:+$('otf_h').value||null});
  const a=S.activities.find(x=>x.otf&&x.date===d);
  if(a){ a.splatActual=sp; const pairs=S.activities.filter(x=>x.splatActual!=null&&x.splatEst>0);
    if(pairs.length) S.settings.splatCal=+(pairs.reduce((s,x)=>s+x.splatActual,0)/pairs.reduce((s,x)=>s+x.splatEst,0)).toFixed(2); }
  save(); closeSheet('otfSheet'); $('otf_txt').value=''; toast(a?'Matched to '+a.name:'Saved (no Strava match yet)'); render();
}
const splats = a => a.splatActual ?? (a.splatEst!=null?Math.round(a.splatEst*S.settings.splatCal):null);

/* ---------- TRAINING LOAD ---------- */
function trimp(a){ const s=S.settings, max=a.otf?s.maxHrOtf:s.maxHr, min=a.moving/60;
  if(!a.avgHr) return min*0.6; const x=Math.max(0,Math.min(1,(a.avgHr-s.restHr)/(max-s.restHr))); return min*x*0.64*Math.exp(1.92*x); }
function loadSeries(days=90){
  const by={}; S.activities.forEach(a=>by[a.date]=(by[a.date]||0)+trimp(a));
  let ctl=0,atl=0; const out=[], start=addDays(today(),-days-42);
  for(let i=0;i<=days+42;i++){ const d=addDays(start,i), l=by[d]||0; ctl+=(l-ctl)/42; atl+=(l-atl)/7; if(i>=42) out.push({d,ctl,atl,tsb:ctl-atl,l}); }
  return out;
}
function lastN(n){ const c=addDays(today(),-n); return S.activities.filter(a=>a.date>c); }
const isRun = a => /Run/.test(a.type);

/* ---------- RACES & PREDICTION ---------- */
function nextRace(){ return S.races.filter(r=>!r.done&&r.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0]; }
const daysToRace=()=>{ const r=nextRace(); return r?daysBetween(today(),r.date):999; };
function recentRunPace(){
  const runs=lastN(42).filter(a=>isRun(a)&&a.dist*M2MI>=2.5&&a.moving>0);
  if(runs.length){ const p=runs.map(a=>a.moving/(a.dist*M2MI)).sort((a,b)=>a-b); return {pace:p[Math.min(1,p.length-1)],src:`your best recent runs (${runs.length} runs ≥2.5 mi, last 6 wks)`}; }
  const b=S.races.find(r=>r.type==='spartan-beast'&&r.result); if(b) return {pace:b.result.gap*0.85,src:'your Spartan Beast grade-adjusted pace (no recent Strava runs yet)'};
  return null;
}
function predictHyrox(){
  const rp=recentRunPace(); if(!rp) return null;
  const otfWk=lastN(28).filter(a=>a.otf).length/4;
  const runS=8/1.609344*rp.pace*1.14, stations=otfWk>=3?40*60:otfWk>=2?43*60:47*60, rox=7*60, mid=runS+stations+rox;
  return {lo:mid*0.94,mid,hi:mid*1.07,runS,stations,rox,src:rp.src,otfWk};
}
function renderRace(){
  const r=nextRace();
  if(!r) $('summitCard').innerHTML='<h2>Next summit</h2><div class="mute">Add a goal race to start your climb.</div>';
  else{
    const left=daysBetween(today(),r.date), prog=Math.max(0,Math.min(1,1-left/Math.max(left,84)));
    const camps=['Base Camp','Snowbowl','Agassiz Saddle','False Summit','Humphreys Summit'], ci=Math.min(4,Math.floor(prog*4.999));
    const pts=[[10,106],[60,80],[110,88],[170,40],[205,52],[240,14]], L=[]; let tot=0;
    for(let i=1;i<pts.length;i++){L.push(Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));tot+=L[i-1];}
    let t=prog*tot,i=0; while(i<L.length-1&&t>L[i]){t-=L[i];i++;} const f=Math.min(1,t/L[i]);
    const x=pts[i][0]+(pts[i+1][0]-pts[i][0])*f, y=pts[i][1]+(pts[i+1][1]-pts[i][1])*f;
    $('summitCard').innerHTML=`<h2><span>${esc(r.name)}</span><span>${fmtDate(r.date)}</span></h2>
     <div class="row between"><div><div class="big">${left}</div><div class="small mute">days to race</div></div><div style="text-align:right"><span class="pill">${camps[ci]}</span><div class="small mute" style="margin-top:4px">Goal: ${r.goal?hms(r.goal):`<a style="color:var(--gold)" onclick="editRace('${r.id}')">set goal</a>`}</div></div></div>
     <svg viewBox="0 0 300 110" width="100%" style="margin-top:10px"><path d="M0 110 L60 80 L110 88 L170 40 L205 52 L240 14 L300 110Z" fill="rgba(127,165,142,.25)" stroke="#7fa58e"/>
      <path d="M225 28 L240 14 L255 32 L247 28 L240 33 L232 27Z" fill="var(--snow)"/>
      <path d="M10 106 L60 80 L110 88 L170 40 L205 52 L240 14" fill="none" stroke="var(--gold)" stroke-width="3" stroke-dasharray="4 5" opacity=".5"/>
      <circle cx="${x}" cy="${y}" r="7" fill="var(--gold)"/><text x="${x}" y="${y+4}" font-size="9" text-anchor="middle">🥾</text></svg>`;
  }
  const P=predictHyrox(), hy=S.races.find(x=>/hyrox/.test(x.type)&&!x.done);
  if(P&&hy){ const g=hy.goal;
    $('predict').innerHTML=`<div class="big">${hms(P.mid)}</div><div class="small mute">realistic Hyrox Open today (range ${hms(P.lo)}–${hms(P.hi)})</div>
     <table style="margin-top:8px"><tr><td>8 km running (fatigued)</td><td>${hms(P.runS)}</td></tr><tr><td>8 stations</td><td>${hms(P.stations)}</td></tr><tr><td>Roxzone transitions</td><td>${hms(P.rox)}</td></tr></table>
     <div class="small mute" style="margin-top:8px">Based on ${P.src} and ${P.otfWk.toFixed(1)} OTF classes/week. Rough estimate — tightens as more data syncs.</div>
     ${g?`<div class="tip">${g<P.lo?`Your goal ${hms(g)} is a stretch — ~${r0((P.mid-g)/60)} min faster than predicted. Doable with focused run volume + compromised-run sessions.`:g>P.hi?`Your goal ${hms(g)} looks comfortable — consider aiming for ${hms(P.mid*0.97)}.`:`Your goal ${hms(g)} is right on target. 🎯`}</div>`:`<button class="sm" style="margin-top:8px" onclick="setGoalPrompt('${hy.id}',${r0(P.mid*0.97)})">Set a goal time</button>`}`;
  } else $('predict').innerHTML='<div class="mute">Connect Strava and sync to get a prediction.</div>';
  $('plan').innerHTML=weeklyPlan().map(x=>`<div class="tip">${x}</div>`).join('')+(typeof getInsights==='function'?insightsHTML(getInsights().filter(i=>i.cat==='Training'||i.cat==='Race')):'');
  $('races').innerHTML=S.races.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<div class="row between" onclick="editRace('${r.id}')"><span><b>${esc(r.name)}</b><br><span class="small mute">${fmtDate(r.date)} ${r.date.slice(0,4)}${r.result?` · ${hms(r.result.time)}${r.result.dist?` · ${r.result.dist} mi`:''}${r.result.elevFt?` · ${r.result.elevFt.toLocaleString()} ft`:''}`:''}</span></span><span class="pill ${r.done?'green':''}">${r.done?'✓ Summited':'Goal'}</span></div>`).join('');
}
function setGoalPrompt(id,sugg){ const v=prompt('Goal time (h:mm:ss)',hms(sugg)); if(!v)return; S.races.find(r=>r.id===id).goal=v.split(':').map(Number).reduce((a,x)=>a*60+x,0); save(); render(); }
function editRace(id){
  const r=S.races.find(x=>x.id===id)||{id:'r'+Date.now(),name:'',type:'hyrox-open',date:'',done:false}; window._er=r;
  $('raceBody').innerHTML=`<h3 style="margin-top:0">${id?'Edit':'Add'} race</h3><label>Name</label><input id="re_n" value="${esc(r.name)}">
   <label>Type</label><select id="re_t">${[['hyrox-open','Hyrox Solo (Open)'],['hyrox-pro','Hyrox Pro'],['hyrox-doubles','Hyrox Doubles'],['spartan-sprint','Spartan Sprint'],['spartan-super','Spartan Super'],['spartan-beast','Spartan Beast'],['spartan-ultra','Spartan Ultra'],['dritri','OTF DriTri'],['road','Road race']].map(([v,n])=>`<option value="${v}" ${r.type===v?'selected':''}>${n}</option>`).join('')}</select>
   <label>Date</label><input id="re_d" type="date" value="${r.date}"><label>Goal time (h:mm:ss)</label><input id="re_g" value="${r.goal?hms(r.goal):''}">
   <label>Result time if finished (h:mm:ss)</label><input id="re_res" value="${r.result?hms(r.result.time):''}">
   <div class="row" style="margin-top:12px">${id?`<button class="danger" onclick="S.races=S.races.filter(x=>x.id!=='${r.id}');save();closeSheet('raceSheet');render()">Delete</button>`:''}<button style="flex:1" onclick="saveRace()">Save</button></div>`;
  openSheet('raceSheet');
}
function saveRace(){ const r=_er, t=s=>s?s.split(':').map(Number).reduce((a,x)=>a*60+x,0):null;
  Object.assign(r,{name:$('re_n').value||'Race',type:$('re_t').value,date:$('re_d').value,goal:t($('re_g').value)});
  const res=t($('re_res').value); if(res){ r.done=true; r.result=Object.assign({dist:0,elevFt:0},r.result||{},{time:res}); }
  if(!S.races.includes(r)) S.races.push(r); save(); closeSheet('raceSheet'); render(); }
function weeklyPlan(){
  const r=nextRace(); if(!r) return ['Pick your next summit to get a weekly plan.'];
  const w=Math.ceil(daysBetween(today(),r.date)/7), hy=/hyrox/.test(r.type);
  const phase=w<=1?'Race week':w<=2?'Taper':w<=6?'Build':'Base';
  const plan={ Base:hy?'3 OTF classes · 1 easy run 4–6 mi · 1 tempo run (20 min comfortably hard) · 1 long walk/hike':'3 OTF · 1 trail run with hills · 1 long hike with pack',
    Build:hy?'3 OTF (15–20 splats) · 1 compromised run: 8×(1 km run + 2–3 min hard effort) · 1 easy 5 mi · 1 full rest day':'3 OTF · hill repeats · long trail run · grip/carry work',
    Taper:'2 OTF (moderate, ~10–12 splats) · 1 short run with 4×1 km at race pace · extra sleep',
    'Race week':'1 light OTF early in the week · 20-min shakeout 2 days out · carbs up 2 days out · rest the day before' }[phase];
  return [`<b>${phase} · ${w} week${w===1?'':'s'} out</b><br>${plan}`];
}

/* ---------- TRAIN VIEW ---------- */
function spark(svg,vals,colors){
  const el=$(svg), W=el.clientWidth||320, H=90, all=vals.flat(), mx=Math.max(1,...all), mn=Math.min(0,...all);
  el.innerHTML=vals.map((v,k)=>`<polyline fill="none" stroke="${colors[k]}" stroke-width="2" points="${v.map((y,i)=>`${(i/(v.length-1)*W).toFixed(1)},${(H-4-(y-mn)/(mx-mn)*(H-8)).toFixed(1)}`).join(' ')}"/>`).join('');
}
function renderTrain(){
  const s=loadSeries(90), L=s[s.length-1];
  $('lastSync').textContent=S.strava.lastSync?'Last sync '+new Date(S.strava.lastSync).toLocaleString():'Not synced yet — connect Strava in Setup.';
  $('ffm').innerHTML=[['Fitness',L.ctl,'var(--sky)'],['Fatigue',L.atl,'var(--f)'],['Form',L.tsb,'var(--gold)']].map(([n,v,c])=>`<div><div class="big" style="font-size:26px;color:${c}">${r0(v)}</div><div class="small mute">${n}</div></div>`).join('');
  setTimeout(()=>spark('loadChart',[s.map(x=>x.ctl),s.map(x=>x.atl)],['var(--sky)','var(--f)']),0);
  const totFt=S.activities.reduce((a,x)=>a+x.elev*M2FT,0), humps=totFt/4400;
  $('elev').innerHTML=`<div class="row between"><div><div class="big">${r0(totFt).toLocaleString()} ft</div><div class="small mute">climbed (synced activities)</div></div><div style="text-align:right"><div class="big" style="font-size:26px">${humps.toFixed(1)}×</div><div class="small mute">Humphreys climbs</div></div></div>
    <div class="bar" style="margin-top:8px"><i style="width:${(humps%1)*100}%;background:linear-gradient(90deg,#7fa58e,var(--snow))"></i></div><div class="small mute">${r0((1-humps%1)*4400)} ft to your next summit</div>`;
  const sum=lastN(7).reduce((a,x)=>{a.n++;a.mi+=isRun(x)||/Walk|Hike/.test(x.type)?x.dist*M2MI:0;a.sp+=x.otf?(splats(x)||0):0;a.otf+=x.otf?1:0;return a;},{n:0,mi:0,sp:0,otf:0});
  $('week').innerHTML=`<div class="grid3"><div><div class="big" style="font-size:24px">${sum.n}</div><div class="small mute">workouts</div></div><div><div class="big" style="font-size:24px">${sum.mi.toFixed(1)}</div><div class="small mute">run/walk mi</div></div><div><div class="big" style="font-size:24px;color:#f08a24">${sum.sp}</div><div class="small mute">splats (${sum.otf} OTF)</div></div></div>`;
  $('acts').innerHTML=S.activities.slice(0,25).map(a=>{ const z=a.zones, zt=z?z.reduce((x,y)=>x+y,0):0, sp=splats(a);
    return `<div><div class="row between"><b>${a.otf?'🟠 ':isRun(a)?'🏃 ':/Walk|Hike/.test(a.type)?'🥾 ':'⛰ '}${esc(a.name)}</b><span class="small mute">${fmtDate(a.date)}</span></div>
    <div class="small mute">${hms(a.moving)}${a.dist?` · ${(a.dist*M2MI).toFixed(2)} mi`:''}${a.dist&&isRun(a)?` · ${pace(a.moving/(a.dist*M2MI))}`:''}${a.avgHr?` · ${r0(a.avgHr)} bpm`:''}${a.otf&&sp!=null?` · <span style="color:#f08a24">${sp} splats${a.splatActual!=null?' ✓':' est'}</span>`:''}</div>
    ${z&&zt?`<div class="zones">${z.map((m,i)=>`<i style="width:${m/zt*100}%;background:${ZC[i]}"></i>`).join('')}</div>`:''}</div>`; }).join('')||'<div class="mute small">No activities yet.</div>';
  const B=[['🏔','Beast Slayer',S.races.some(r=>r.type==='spartan-beast'&&r.done)],['🟠','Splat 100',S.activities.filter(a=>a.otf).reduce((a,x)=>a+(splats(x)||0),0)>=100],
    ['🥾','Humphreys ×1',humps>=1],['⛰','Humphreys ×5',humps>=5],['🔥','4 OTF Week',sum.otf>=4],['🏃','15 mi Week',sum.mi>=15],['🍽','7-day Log Streak',streak()>=7],
    ['🌙','7 Nights Logged',sleepWindow(7).length>=7],['🩺','Health Check',S.labs.length>0&&S.bp.length>0]];
  $('badges').innerHTML=B.map(([i,n,g])=>`<span class="badge ${g?'got':''}"><b>${i}</b>${n}</span>`).join('');
}
function streak(){ let n=0,d=today(); if(!(S.food[d]||[]).length)d=addDays(d,-1); while((S.food[d]||[]).length){n++;d=addDays(d,-1);} return n; }

/* ---------- HEALTH: BODY COMP / BP ---------- */
async function ocrBC(files){
  let txt=''; try{ for(const f of files) txt+='\n'+await ocr(f,'bcStatus'); }catch(e){ $('bcStatus').textContent='Could not read image – enter values manually.'; return; }
  const t=txt.replace(/,(\d{3})/g,'$1'), g=re=>{const m=t.match(re);return m?m[1]:null;}, set=(id,v)=>{ if(v!=null) $(id).value=v; };
  set('bc_bf',g(/(\d{1,2}\.\d)\s*%?\s*BODY\s*FAT/i)); set('bc_wt',g(/WEIGHT[\s\S]{0,40}?(\d{2,3}\.\d)\s*lb/i));
  set('bc_smm',g(/SKELETAL\s*MUSCLE\s*MASS[\s\S]{0,40}?(\d{2,3}\.\d)\s*lb/i)); set('bc_bfm',g(/BODY\s*FAT\s*MASS[\s\S]{0,40}?(\d{1,3}\.\d)\s*lb/i));
  set('bc_bmr',g(/METABOLIC\s*RATE[\s\S]{0,20}?(\d{3,4}(?:\.\d)?)/i));
  const dm=t.match(/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+\s+\d{1,2},?\s+\d{4})/i); if(dm){const d=new Date(dm[1]); if(!isNaN(d)) $('bc_date').value=iso(d);}
  const segs=[...t.matchAll(/(\d{1,2}\.\d)\s*lb\s*\n?\s*\d{2,3}\.\d\s*%/gi)].map(m=>+m[1]);
  if(segs.length>=5) ['bc_tr','bc_la','bc_ra','bc_ll','bc_rl'].forEach((id,i)=>$(id).value=segs[i]);
  $('bcStatus').textContent='Done – please double-check every value.';
}
function saveBC(){ const v=id=>+$(id).value||null;
  S.bodycomp.push({date:$('bc_date').value||today(),bf:v('bc_bf'),wt:v('bc_wt'),smm:v('bc_smm'),bfm:v('bc_bfm'),bmr:v('bc_bmr'),seg:{tr:v('bc_tr'),la:v('bc_la'),ra:v('bc_ra'),ll:v('bc_ll'),rl:v('bc_rl')}});
  S.bodycomp.sort((a,b)=>a.date.localeCompare(b.date)); if(v('bc_wt')) S.settings.weight=v('bc_wt'); save(); closeSheet('bcSheet'); render(); toast('Scan saved'); }
function saveBP(){ const s=+$('bp_s').value,d=+$('bp_d').value; if(!s||!d) return toast('Enter both numbers');
  S.bp.push({date:$('bp_date').value||today(),sys:s,dia:d,pulse:+$('bp_p').value||null}); S.bp.sort((a,b)=>a.date.localeCompare(b.date)); save(); closeSheet('bpSheet'); render(); }
function bpCat(s,d){ return s>=140||d>=90?['Stage 2','red']:s>=130||d>=80?['Stage 1','red']:s>=120?['Elevated','']:['Normal','green']; }

/* ---------- HEALTH: LABS (PDF / image / text) ----------
   PDFs are read by COLUMN POSITION: find the "TEST | RESULTS | REFERENCE | UNITS" header, then only accept rows whose
   test name starts in the TEST column and whose RESULTS cell is a number. Indented reference-range notes, comments,
   page headers/footers and the "Values Outside of Reference Range" summary are ignored. */
let labRows=[], pdfMod=null;
async function loadPdf(){ if(!pdfMod){ pdfMod=await import('./pdfjs.js'); pdfMod.GlobalWorkerOptions.workerSrc=new URL('pdfjs.worker.js',location.href).href; } return pdfMod; }
async function pdfPages(file){
  const lib=await loadPdf(), pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise, pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    $('labStatus').textContent=`Reading page ${p} of ${pdf.numPages}…`;
    const tc=await (await pdf.getPage(p)).getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({x:i.transform[4],y:i.transform[5],w:i.width||0,s:i.str.replace(/\s+/g,' ').trim()}))
      .sort((a,b)=>b.y-a.y||a.x-b.x);
    const lines=[]; items.forEach(it=>{ const L=lines[lines.length-1]; if(L&&Math.abs(L.y-it.y)<=2.5) L.items.push(it); else lines.push({y:it.y,items:[it]}); });
    lines.forEach(L=>{ L.items.sort((a,b)=>a.x-b.x); L.text=L.items.map(i=>i.s).join(' '); });
    pages.push(lines);
  }
  return {pages,pdf};
}
function findCols(line){
  const g=re=>line.items.find(i=>re.test(i.s.toUpperCase()));
  const test=g(/^(TEST|TESTS|TEST NAME|COMPONENT|ANALYTE)\b/), res=g(/^(RESULTS?|YOUR VALUE|VALUE)\b/), ref=g(/^(REF|REFERENCE|NORMAL|STANDARD RANGE|RANGE)/), un=g(/^UNITS?\b/), pl=g(/^(PL|LAB|SITE)$/);
  if(!test||!res||!(ref||un)) return null;
  const resL=res.x-Math.min(45,(res.x-test.x)*0.25);
  const resR=ref?(res.x+res.w+ref.x)/2:un.x-4;
  const refR=ref&&un?(ref.x+ref.w+un.x)/2:Infinity;
  const unR=pl?pl.x-4:Infinity;
  return {testX:test.x,resL,resR,refR,unR};
}
const LAB_JUNK=/^(account|id\/?mr|patient|order|collected|received|reported|route|report status|page|dob|age|sex|fasting|distribution|tests ordered|values (outside|listed)|end of report|unless otherwise|testing (noted|performed)|parent site|l=low|this test|reference|no reference)/i;
const REF_LABEL=/^(follicular|ovulation|luteal|midcycle|post-?menopausal|pregnan|first trimester|second trimester|third trimester|adult|male|female|non-pregnant|severe|mild|optimum|collection time)/i;
const RES_RE=/^([<>≤≥]=?\s*)?(\d+(?:\.\d+)?)\s*\*?\s*(CH|CL|H|L|C|A|HIGH|LOW)?\b\s*\*?/i;
function cleanRange(s){ return String(s||'').replace(/\s+/g,'').replace(/<=/g,'≤').replace(/>=/g,'≥').replace(/–/g,'-'); }
function parsePdfLabs(pages){
  const rows=[], seen=new Set(); let cols=null, panel='', inSummary=false;
  pages.forEach(lines=>{
   const hdr=lines.filter(L=>/(collected|reported|received|patient phone|dob)\s*:/i.test(L.text)), cut=hdr.length?Math.min(...hdr.map(L=>L.y)):Infinity;
   lines.forEach(L=>{
    if(L.y>=cut-1&&!findCols(L)) return;                                  // repeated page header block
    const c=findCols(L); if(c){ cols=c; return; }
    if(/values outside of reference range/i.test(L.text)){ inSummary=true; return; }
    if(!cols||inSummary) return;
    const cell={name:[],res:[],ref:[],unit:[]};
    L.items.forEach(it=>{ const cx=it.x+it.w/2;
      if(it.x<cols.resL) cell.name.push(it); else if(cx<cols.resR) cell.res.push(it); else if(cx<cols.refR) cell.ref.push(it); else if(cx<cols.unR) cell.unit.push(it); });
    if(!cell.name.length) return;
    const nameX=cell.name[0].x, name=cell.name.map(i=>i.s).join(' ').trim(), res=cell.res.map(i=>i.s).join(' ').trim();
    if(nameX>cols.testX+28) return;                                    // indented = reference-range notes / comments
    if(/^[*(]/.test(name)||name.includes(':')||LAB_JUNK.test(name)||REF_LABEL.test(name)) return;
    if(!res){ if(!cell.ref.length&&!cell.unit.length&&name.length<60&&!/[;.]$/.test(name)) panel=name; return; } // section heading
    const m=res.match(RES_RE); if(!m) return;                          // "None", "Adequate", "See Comment"
    const key=name.toLowerCase(); if(seen.has(key)) return; seen.add(key);
    const fl=(m[3]||'').toUpperCase(), flag=/^(H|HIGH|CH)$/.test(fl)?'H':/^(L|LOW|CL)$/.test(fl)?'L':'';
    rows.push({name,value:(m[1]?m[1].replace(/\s/g,''):'')+m[2],flag,unit:cell.unit.map(i=>i.s).join(' ').trim(),range:cleanRange(cell.ref.map(i=>i.s).join(' ')),panel});
  });});
  return rows;
}
/* Fallback for photos / pasted text: strict one-line pattern */
function parseTextLabs(t){
  const rows=[], seen=new Set(); let panel='';
  const re=/^\s*([A-Za-z][A-Za-z0-9 ,'\-\(\)\/\.]{1,50}?)\s{1,}([<>≤≥]?\d+(?:\.\d+)?)\s*\*?\s*(H|L|CH|CL|High|Low)?\s*\*?\s+(?:((?:[<>≤≥]=?\s*)?\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*)?([a-zA-Zµμ%\/][a-zA-Zµμ%\/\.\d\^]{0,14})?(?:\s+[A-Z]{2})?\s*$/;
  String(t).split(/\n/).forEach(raw=>{
    const line=raw.replace(/\s+/g,' ').trim(); if(!line||/^[*(]/.test(line)||LAB_JUNK.test(line)) return;
    const m=line.match(re); if(!m){ if(line.length<50&&!/\d/.test(line)&&!line.includes(':')) panel=line; return; }
    const name=m[1].trim(); if(name.includes(':')||!(m[4]||m[5])||/[-–]\s*$/.test(name)||/\d\s*[-–]/.test(name)||REF_LABEL.test(name)) return;
    const key=name.toLowerCase(); if(seen.has(key)) return; seen.add(key);
    const fl=(m[3]||'').toUpperCase();
    rows.push({name,value:m[2],flag:/^(H|HIGH|CH)$/.test(fl)?'H':/^(L|LOW|CL)$/.test(fl)?'L':'',unit:m[5]||'',range:cleanRange(m[4]),panel});
  });
  return rows;
}
async function handleLabFile(file){
  if(!file) return; const name=(file.name||'').toLowerCase(), type=file.type||''; let rows=[], text='';
  try{
    if(type==='application/pdf'||name.endsWith('.pdf')){
      $('labStatus').textContent='Opening PDF…';
      const {pages,pdf}=await pdfPages(file); text=pages.map(p=>p.map(l=>l.text).join('\n')).join('\n');
      rows=parsePdfLabs(pages);
      if(rows.length<5&&text.replace(/\s/g,'').length>40) rows=parseTextLabs(text);
      if(text.replace(/\s/g,'').length<40){ $('labStatus').textContent='Scanned PDF – reading with OCR (~30 sec)…'; text=await pdfOcr(pdf); rows=parseTextLabs(text); }
    } else if(type.startsWith('text')||name.endsWith('.txt')){ text=await file.text(); rows=parseTextLabs(text); }
    else { text=await ocr(file,'labStatus'); rows=parseTextLabs(text); }
  }catch(e){ console.error(e); $('labStatus').textContent='Could not read that file ('+(e.message||'error')+'). Try a screenshot, or paste the text.'; return; }
  const dm=text.match(/collect\w*\s*(?:date)?[:\s]*([01]?\d\/[0-3]?\d\/(?:20)?\d{2})/i)||text.match(/([01]?\d\/[0-3]?\d\/20\d{2})/);
  if(dm){ const d=new Date(dm[1]); if(!isNaN(d)) $('lab_date').value=iso(d); }
  labRows=rows; renderLabTbl();
  const n=rows.length, ab=rows.filter(r=>outOfRange(r)).length;
  $('labStatus').innerHTML=n?`✓ Found <b>${n} results</b>${ab?`, <span class="flag">${ab} outside range</span>`:''}. Collected ${$('lab_date').value?fmtDate($('lab_date').value)+' '+$('lab_date').value.slice(0,4):'?'} — check the date, then Save.`
    :'No results recognized. Paste the text below or add rows with + Row.';
}
async function pdfOcr(pdf){ let out='';
  for(let p=1;p<=Math.min(pdf.numPages,6);p++){
    const page=await pdf.getPage(p), vp=page.getViewport({scale:2}), c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
    await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise; out+='\n'+await ocrSource(c,'labStatus'); }
  return out; }
function parseLabs(t){ labRows=parseTextLabs(t); renderLabTbl(); toast(labRows.length?labRows.length+' results found – review below':'No results found in that text'); }
function addLabRow(){ labRows.push({name:'',value:'',flag:'',unit:'',range:'',panel:''}); renderLabTbl(); }
function renderLabTbl(){
  let lastPanel=null, html='<tr><th>Test</th><th>Value</th><th>Range</th><th></th></tr>';
  labRows.forEach((r,i)=>{ if(r.panel&&r.panel!==lastPanel){ lastPanel=r.panel; html+=`<tr><td colspan="4" class="small" style="color:var(--gold);padding-top:10px">${esc(r.panel)}</td></tr>`; }
    const o=r.value&&outOfRange(r);
    html+=`<tr data-i="${i}"><td><input data-k="name" style="padding:5px;font-size:14px" value="${esc(r.name)}" onchange="labRows[${i}].name=this.value"></td>
      <td><input data-k="value" style="padding:5px;font-size:14px;width:70px;${o?'color:var(--red);font-weight:700':''}" value="${esc(r.value)}" onchange="labRows[${i}].value=this.value"><div class="small mute">${esc(r.unit)}${r.flag?` <span class="flag">${r.flag}</span>`:''}</div></td>
      <td><input data-k="range" style="padding:5px;font-size:14px;width:84px" value="${esc(r.range)}" onchange="labRows[${i}].range=this.value"></td>
      <td><button class="sm ghost" onclick="labRows.splice(${i},1);renderLabTbl()">✕</button></td></tr>`; });
  $('labTbl').innerHTML=labRows.length?html:''; }
function saveLabs(){
  try{
    if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();   // commit any edit in progress
    document.querySelectorAll('#labTbl tr[data-i]').forEach(tr=>{ const r=labRows[+tr.dataset.i]; if(!r) return;
      tr.querySelectorAll('input[data-k]').forEach(inp=>r[inp.dataset.k]=inp.value.trim()); });
    const d=$('lab_date').value||today(), rows=labRows.filter(r=>r&&String(r.name||'').trim()&&String(r.value||'').trim());
    if(!rows.length){ toast('No results to save — load a file first'); return; }
    const keys=new Set(rows.map(r=>String(r.name).toLowerCase()));
    S.labs=(S.labs||[]).filter(x=>!(x.date===d&&keys.has(String(x.name).toLowerCase())));
    rows.forEach(r=>S.labs.push({date:d,name:String(r.name),value:String(r.value),flag:r.flag||'',unit:r.unit||'',range:r.range||'',panel:r.panel||''}));
    localStorage.setItem(KEY, JSON.stringify(S));                       // save first, before any UI work
    labRows=[]; $('labTbl').innerHTML=''; $('lab_txt').value=''; $('labStatus').textContent='';
    closeSheet('labSheet'); toast(rows.length+' lab results saved ✓');
    try{ render(); }catch(e){ showErr('Saved, but display error: '+e.message); }
  }catch(e){ showErr('Save failed: '+(e&&e.message||e)); }
}
function outOfRange(r){
  if(r.flag==='H') return 'high'; if(r.flag==='L') return 'low';
  const v=parseFloat(String(r.value).replace(/[<>≤≥=]/g,'')), R=cleanRange(r.range); if(isNaN(v)||!R) return false;
  let m=R.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/); if(m) return v<+m[1]?'low':v>+m[2]?'high':false;
  m=R.match(/^≤(\d+(?:\.\d+)?)/); if(m) return v>+m[1]?'high':false;
  m=R.match(/^<(\d+(?:\.\d+)?)/); if(m) return v>=+m[1]?'high':false;
  m=R.match(/^≥(\d+(?:\.\d+)?)/); if(m) return v<+m[1]?'low':false;
  m=R.match(/^>(\d+(?:\.\d+)?)/); if(m) return v<=+m[1]?'low':false;
  return false; }
function miniSpark(vals,color){ if(vals.length<2) return ''; const mx=Math.max(...vals),mn=Math.min(...vals),W=80,H=24;
  return `<svg width="${W}" height="${H}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${vals.map((v,i)=>`${i/(vals.length-1)*W},${H-2-(mx===mn?.5:(v-mn)/(mx-mn))*(H-4)}`).join(' ')}"/></svg>`; }
function deleteLab(name){ if(!confirm('Delete all results for '+name+'?')) return; S.labs=S.labs.filter(x=>x.name.toLowerCase()!==name.toLowerCase()); save(); render(); }
function renderHealth(){
  const nl=new Set(S.labs.map(x=>x.name.toLowerCase())).size, nFlag=(()=>{const L={};S.labs.forEach(r=>{const k=r.name.toLowerCase();if(!L[k]||r.date>=L[k].date)L[k]=r;});return Object.values(L).filter(outOfRange).length;})();
  const s7=sleepWindow(7), w7=[...Array(7)].map((_,i)=>S.water[addDays(today(),-i)]||0).filter(x=>x>0);
  $('healthSummary').innerHTML=`<div class="card"><div class="grid3">
    <div onclick="$('labsCard').scrollIntoView({behavior:'smooth'})"><div class="big" style="font-size:24px">${nl}</div><div class="small mute">lab markers${nFlag?` · <span class="flag">${nFlag} flagged</span>`:''}</div></div>
    <div><div class="big" style="font-size:24px">${s7.length?avg(s7.map(x=>x.hrs)).toFixed(1):'–'}</div><div class="small mute">sleep hrs (7d)</div></div>
    <div><div class="big" style="font-size:24px">${w7.length?r0(avg(w7)):'–'}</div><div class="small mute">water oz/day (7d)</div></div></div></div>`;
  renderSleep();
  const b=S.bodycomp, L=b[b.length-1], P=b[b.length-2];
  const d=k=>{ if(!P||L[k]==null||P[k]==null) return ''; const up=L[k]>P[k], bad=(k==='bf'||k==='bfm')===up; return ` <span class="small" style="color:${bad?'var(--red)':'var(--green)'}">${up?'▲':'▼'}${Math.abs(L[k]-P[k]).toFixed(1)}</span>`; };
  $('bc').innerHTML=L?`<div class="small mute">Latest: ${fmtDate(L.date)} ${L.date.slice(0,4)} · ${b.length} scan${b.length>1?'s':''}</div>
   <div class="grid3" style="margin-top:8px"><div><div class="big" style="font-size:24px">${L.bf}%</div><div class="small mute">body fat${d('bf')}</div></div><div><div class="big" style="font-size:24px">${L.smm}</div><div class="small mute">muscle lb${d('smm')}</div></div><div><div class="big" style="font-size:24px">${L.wt}</div><div class="small mute">weight lb${d('wt')}</div></div></div>
   <div class="small" style="margin-top:8px">Fat mass ${L.bfm} lb · BMR ${r0(L.bmr)} kcal${L.seg&&L.seg.tr?` · Lean: trunk ${L.seg.tr}, arms ${L.seg.la}/${L.seg.ra}, legs ${L.seg.ll}/${L.seg.rl} lb`:''}</div>
   <div class="row" style="margin-top:6px">${miniSpark(b.map(x=>x.bf).filter(Boolean),'var(--f)')}${miniSpark(b.map(x=>x.smm).filter(Boolean),'var(--sky)')}</div>`:'<div class="mute">Scan your first OTF body comp.</div>';
  const bp=S.bp; $('bp').innerHTML=bp.length?bp.slice(-6).reverse().map(x=>{const[c,k]=bpCat(x.sys,x.dia);return `<div class="row between small" style="padding:4px 0"><span>${fmtDate(x.date)} ${x.date.slice(0,4)}</span><b>${x.sys}/${x.dia}${x.pulse?` · ${x.pulse} bpm`:''}</b><span class="pill ${k}">${c}</span></div>`;}).join('')+`<div>${miniSpark(bp.map(x=>x.sys),'var(--red)')}</div>`:"<div class=\"mute small\">Log monthly — you'll get a reminder on the Fuel screen.</div>";
  const by={}; S.labs.forEach(r=>(by[r.name.toLowerCase()]=by[r.name.toLowerCase()]||[]).push(r));
  const groups={}; Object.values(by).forEach(a=>{ a.sort((x,y)=>x.date.localeCompare(y.date)); const l=a[a.length-1]; (groups[l.panel||'Other']=groups[l.panel||'Other']||[]).push(a); });
  const flagged=Object.values(by).map(a=>a[a.length-1]).filter(outOfRange);
  const rowH=a=>{ const l=a[a.length-1], o=outOfRange(l), prev=a.length>1?a[a.length-2]:null;
    return `<tr onclick="deleteLab('${esc(l.name).replace(/'/g,"\\'")}')"><td>${esc(l.name)}<div class="small mute">${fmtDate(l.date)} '${l.date.slice(2,4)}${prev?` · was ${esc(prev.value)}`:''}</div></td><td class="${o?'flag':''}">${esc(l.value)}${o?(o==='high'?' ▲':' ▼'):''} <span class="small mute">${esc(l.unit)}</span></td><td class="small mute">${esc(l.range)}</td><td>${miniSpark(a.map(x=>parseFloat(String(x.value).replace(/[<>≤≥]/g,''))).filter(x=>!isNaN(x)),o?'var(--red)':'var(--green)')}</td></tr>`; };
  const n=Object.keys(by).length, last=S.labs.reduce((m,x)=>x.date>m?x.date:m,'');
  $('labs').innerHTML=n?`<div class="small mute">${n} markers · latest draw ${fmtDate(last)} ${last.slice(0,4)}</div>
    ${flagged.length?`<div class="tip" style="border-color:var(--red)"><b class="flag">${flagged.length} outside range:</b> ${flagged.map(l=>esc(l.name)+' '+esc(l.value)).join(' · ')}</div>`:''}
    <table>${Object.keys(groups).map(g=>`<tr><td colspan="4" class="small" style="color:var(--gold);padding-top:12px">${esc(g)}</td></tr>`+groups[g].map(rowH).join('')).join('')}</table>
    <div class="small mute" style="margin-top:6px">Red = outside the lab's reference range. Tap a row to delete it. See the Coach report for what flagged results mean for training.</div>`
    :'<div class="mute small">Add a PDF, screenshot, or pasted text of your blood work to track every marker over time.</div>';
}

/* ---------- SETTINGS ---------- */
function fillSettings(){ const s=S.settings,P=S.plan;
  $('s_kcal').value=curKcal(); $('s_step').value=P.step; $('s_ceil').value=P.ceil; $('s_floor').value=P.floor; $('s_auto').checked=P.auto;
  $('s_rp').value=s.ratio.p; $('s_rc').value=s.ratio.c; $('s_rf').value=s.ratio.f; $('s_gpl').value=s.gPerLb; $('s_wt').value=s.weight; $('s_sleep').value=s.sleepGoal; $('s_water').value=s.waterGoal; const R=s.reminders||{}; ['sleep','food1','food2','w1','w2','w3','bp','week'].forEach(k=>$('r_'+k).value=R[k]||''); renderDiag(); $('s_push').value=s.pushUrl||''; renderNotifState();
  $('s_mhr').value=s.maxHr; $('s_omhr').value=s.maxHrOtf; $('s_rhr').value=s.restHr; $('s_cid').value=s.clientId; $('s_csec').value=s.secret; $('s_api').value=s.api;
  $('calib').textContent='×'+s.splatCal; setSeg('phaseSeg','p',P.phase); setSeg('mmSeg','m',s.macroMode);
  $('stravaStatus').innerHTML=S.strava.refresh?`✅ Connected${S.strava.athlete?' as '+esc(S.strava.athlete):''}`:'Not connected.';
  $('planHist').innerHTML=P.history.slice(-8).map(h=>`${fmtDate(h.week)}: ${h.kcal} (${h.phase})`).join(' · ');
}
document.querySelectorAll('#phaseSeg button').forEach(b=>b.onclick=()=>{S.plan.phase=b.dataset.p;setSeg('phaseSeg','p',b.dataset.p);save();toast(b.textContent.trim()+' — applies from next week');});
document.querySelectorAll('#mmSeg button').forEach(b=>b.onclick=()=>{S.settings.macroMode=b.dataset.m;setSeg('mmSeg','m',b.dataset.m);});
function saveSettings(quiet){ const s=S.settings,P=S.plan,n=id=>+$(id).value;
  P.step=n('s_step')||100; P.ceil=n('s_ceil')||2500; P.floor=n('s_floor')||1600; P.auto=$('s_auto').checked;
  P.history[P.history.length-1].kcal=Math.max(P.floor,Math.min(P.ceil,n('s_kcal')||2000));
  s.ratio={p:n('s_rp'),c:n('s_rc'),f:n('s_rf')}; s.gPerLb=n('s_gpl')||1; s.weight=n('s_wt')||s.weight; s.sleepGoal=parseHours($('s_sleep').value)||7.5; s.waterGoal=parseFloat($('s_water').value)||128; s.pushUrl=$('s_push').value.trim(); s.reminders={}; ['sleep','food1','food2','w1','w2','w3','bp','week'].forEach(k=>s.reminders[k]=$('r_'+k).value);
  s.maxHr=n('s_mhr')||207; s.maxHrOtf=n('s_omhr')||192; s.restHr=n('s_rhr')||55;
  s.clientId=$('s_cid').value.trim(); s.secret=$('s_csec').value.trim(); s.api=$('s_api').value.trim().replace(/\/$/,'')||DEFAULT.settings.api;
  save(); if(quiet!==true){toast('Saved');render(); syncPush();} }
function toggleTheme(){ S.settings.theme=S.settings.theme==='light'?'dark':'light'; save(); applyTheme(); }
function applyTheme(){ document.body.classList.toggle('light',S.settings.theme==='light'); drawTopo(); }
function exportData(){ const blob=new Blob([JSON.stringify({...S,settings:{...S.settings,secret:'',deviceToken:'',pushSub:null},strava:{}})],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='summit-backup-'+today()+'.json'; a.click(); toast('Backup saved (Strava keys excluded)'); }
function importData(inp){ const f=inp.files[0]; if(!f)return; f.text().then(t=>{ const d=JSON.parse(t), keep={settings:S.settings,strava:S.strava};
  S=Object.assign(structuredClone(DEFAULT),d); S.settings=Object.assign({},DEFAULT.settings,d.settings,{clientId:keep.settings.clientId,secret:keep.settings.secret,deviceId:keep.settings.deviceId,deviceToken:keep.settings.deviceToken,pushSub:keep.settings.pushSub,pushUrl:keep.settings.pushUrl}); S.strava=keep.strava; save(); toast('Restored'); render(); }).catch(()=>toast('Invalid backup')); }

/* ---------- CHECKLIST + BADGE + PUSH ---------- */
function todayStatus(){ const d=today(), f=S.food[d]||[], lastBp=S.bp.length?S.bp[S.bp.length-1].date:null;
  return {date:d,sleep:!!S.sleep.find(x=>x.date===d),water:S.water[d]||0,waterGoal:S.settings.waterGoal||128,meals:[...new Set(f.map(x=>x.meal))],bpDate:lastBp,streak:streak()}; }
function todoList(){ const st=todayStatus(), h=new Date().getHours()+new Date().getMinutes()/60, g=st.waterGoal;
  const bpDue=!st.bpDate||daysBetween(st.bpDate,today())>=30, has=m=>st.meals.includes(m);
  return [
    {k:'sleep',icon:'🌙',label:'Sleep',done:st.sleep,due:true,act:"openSleep()"},
    {k:'water',icon:'💧',label:`${r0(st.water)}/${g}`,done:st.water>=g,due:true,act:"$('waterCard').scrollIntoView({behavior:'smooth'})"},
    {k:'lunch',icon:'🥗',label:'Lunch',done:has('Breakfast')||has('Lunch'),due:h>=11,act:"meal='Lunch';openFood()"},
    {k:'dinner',icon:'🍽',label:'Dinner',done:has('Dinner'),due:h>=18,act:"meal='Dinner';openFood()"},
    ...(bpDue?[{k:'bp',icon:'🩺',label:'BP',done:false,due:true,act:"openSheet('bpSheet')"}]:[])]; }
function badgeNum(){ return todoList().filter(t=>t.due&&!t.done).length; }
function renderChecklist(){ if(day!==today()){ $('checklist').innerHTML=''; return; }
  const L=todoList(), left=L.filter(t=>t.due&&!t.done).length, s=streak();
  $('checklist').innerHTML=`<div class="card" style="padding:12px 14px"><div class="row between small" style="margin-bottom:8px"><b>${left?`⛺ ${left} left to reach today's summit`:'🏔 Summit reached — everything logged!'}</b><span class="mute">${s>=2?'🔥 '+s+'-day streak':''}</span></div>
    <div class="chips">${L.map(t=>`<div class="chip ${t.done?'done':t.due?'due':''}" onclick="${t.act}">${t.done?'✓':t.icon} ${esc(t.label)}</div>`).join('')}</div></div>`; }
function updateBadge(){ const n=badgeNum();
  try{ if(navigator.setAppBadge){ n?navigator.setAppBadge(n).catch(()=>{}):navigator.clearAppBadge().catch(()=>{}); } }catch(e){}
  const fuel=document.querySelector('nav button[data-v="today"]'); if(fuel){ let d=fuel.querySelector('.ndot'); if(n){ if(!d){d=document.createElement('span');d.className='ndot';fuel.appendChild(d);} d.textContent=n; } else if(d) d.remove(); } }
let statusTimer=null, lastStatus='';
function afterSave(){ updateBadge(); clearTimeout(statusTimer); statusTimer=setTimeout(pushStatus,4000); }
async function pushStatus(){ const s=S.settings; if(!s.pushUrl||!s.deviceId) return; const st=JSON.stringify(todayStatus()); if(st===lastStatus) return;
  try{ const r=await fetch(s.pushUrl.replace(/\/$/,'')+'/status',{method:'POST',body:JSON.stringify({id:s.deviceId,token:s.deviceToken,status:JSON.parse(st)})}); if(r.ok) lastStatus=st; }catch(e){} }
const b64uToBytes=s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
function renderNotifState(){
  const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches, perm=('Notification' in window)?Notification.permission:'unsupported', s=S.settings;
  $('notifState').innerHTML=[
    standalone?'✅ Running as Home Screen app':'⚠️ <b>Open Summit from your Home Screen icon</b> — iPhone only allows notifications there.',
    perm==='granted'?'✅ Notifications allowed':perm==='denied'?'⛔ Notifications blocked — iPhone Settings → Notifications → Summit → Allow':perm==='unsupported'?'⚠️ This iOS version doesn\'t support web notifications (need iOS 16.4+)':'○ Notifications not turned on yet',
    s.deviceId&&s.pushUrl?'✅ Connected to push server':'○ Push server not connected (badge still works while you use the app)'].map(x=>`<div style="margin:3px 0">${x}</div>`).join(''); }
async function enablePush(){
  saveSettings(true); const s=S.settings;
  if(!('Notification' in window)||!('serviceWorker' in navigator)) return showErr('Notifications need Summit opened from the Home Screen on iOS 16.4+');
  const perm=await Notification.requestPermission(); renderNotifState(); if(perm!=='granted') return showErr('Notifications not allowed');
  updateBadge();
  if(!s.pushUrl) return toast('Badge is on ✓ Add your push server URL for reminders when the app is closed');
  try{
    const base=s.pushUrl.replace(/\/$/,''), {publicKey}=await (await fetch(base+'/key')).json();
    const reg=await navigator.serviceWorker.ready; let sub=await reg.pushManager.getSubscription();
    if(sub){ try{ await sub.unsubscribe(); }catch(e){} }
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToBytes(publicKey)});
    if(!s.deviceId){ s.deviceId=crypto.randomUUID(); s.deviceToken=crypto.randomUUID()+crypto.randomUUID(); localStorage.setItem(KEY,JSON.stringify(S)); }
    s.pushSub=sub.toJSON(); await syncPush(); renderNotifState(); toast('🔔 Notifications on! Sending a test…'); setTimeout(testPush,800);
  }catch(e){ showErr('Push setup failed: '+e.message+'. Check the server URL.'); }
}
async function syncPush(showToast){ const s=S.settings; if(!s.pushUrl||!s.deviceId||!s.pushSub) return;
  try{ const r=await fetch(s.pushUrl.replace(/\/$/,'')+'/subscribe',{method:'POST',body:JSON.stringify({id:s.deviceId,token:s.deviceToken,subscription:s.pushSub,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,reminders:s.reminders,status:todayStatus()})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||r.status); lastStatus=JSON.stringify(todayStatus()); if(showToast) toast('Reminder times synced ✓'); }
  catch(e){ showErr('Could not reach push server: '+e.message); } }
async function testPush(){ const s=S.settings; if(!s.pushUrl||!s.deviceId) return showErr('Turn on notifications first');
  try{ const j=await (await fetch(s.pushUrl.replace(/\/$/,'')+'/test',{method:'POST',body:JSON.stringify({id:s.deviceId,token:s.deviceToken})})).json();
    j.ok?toast('Test sent — check your lock screen'):showErr('Test failed: '+(j.error||j.status)); }catch(e){ showErr('Test failed: '+e.message); } }
/* ---------- REMINDERS (.ics calendar file) ---------- */
function makeReminders(){
  saveSettings(true); const R=S.settings.reminders, url=location.origin+location.pathname, d0=today().replace(/-/g,'');
  const items=[['sleep','🌙 Summit: log last night\'s sleep','Hours + restful 1–10. Takes 5 seconds.','DAILY'],['food1','🍽 Summit: log your meals','Log breakfast and lunch while you remember.','DAILY'],
    ['food2','🍽 Summit: log dinner + check macros','Finish today\'s food log and check your protein.','DAILY'],['w1','💧 Summit: water check','Goal '+S.settings.waterGoal+' oz. Log what you\'ve had.','DAILY'],
    ['w2','💧 Summit: water check','Halfway point: aim for ~'+r0(S.settings.waterGoal/2)+' oz by now.','DAILY'],['w3','💧 Summit: water check','Last push before evening.','DAILY'],
    ['bp','🩺 Summit: monthly blood pressure','Seated, after 5 min rest. Log it in Summit.','MONTHLY;BYMONTHDAY=1'],['week','⛰ Summit: weekly coach check','Sync Strava and open the Coach report.','WEEKLY;BYDAY=SU']];
  const ev=items.filter(([k])=>R[k]).map(([k,title,desc,rr])=>{ const t=R[k].replace(':','')+'00';
    return ['BEGIN:VEVENT','UID:summit-'+k+'@summit.app','DTSTAMP:'+d0+'T000000','DTSTART:'+d0+'T'+t,'DURATION:PT5M','RRULE:FREQ='+rr,'SUMMARY:'+title,'DESCRIPTION:'+desc+'\\nOpen Summit from your Home Screen.','URL:'+url,'TRANSP:TRANSPARENT',
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+title,'TRIGGER:PT0M','END:VALARM','END:VEVENT'].join('\r\n'); });
  if(!ev.length) return toast('Set at least one reminder time');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Summit//Reminders//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',...ev,'END:VCALENDAR'].join('\r\n');
  const file=new File([ics],'summit-reminders.ics',{type:'text/calendar'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){ navigator.share({files:[file],title:'Summit reminders'}).catch(()=>{}); }
  else { const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download='summit-reminders.ics'; document.body.appendChild(a); a.click(); a.remove(); }
  $('remStatus').innerHTML=`Created ${ev.length} repeating reminders. In the share sheet choose <b>Save to Files</b>, then open the file in Files and tap <b>Add All</b>. To change times later, delete the old "Summit" events in Calendar and add the new file.`;
}
/* ---------- DIAGNOSTICS ---------- */
function renderDiag(){
  const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches, kb=r0((localStorage.getItem(KEY)||'').length/1024);
  const ld=[...new Set(S.labs.map(x=>x.date))].sort();
  $('diag').innerHTML=`<table>
    <tr><td>Version</td><td><b>${APP_VERSION}</b> · coach ${typeof getInsights==='function'?'✓ loaded':'<span class="flag">missing</span>'}</td></tr>
    <tr><td>Running as</td><td>${standalone?'Home Screen app ✓':'<span class="flag">Safari browser</span> – data here is separate from your Home Screen app'}</td></tr>
    <tr><td>Lab results</td><td>${S.labs.length}${ld.length?' (draws: '+ld.map(d=>fmtDate(d)+' '+d.slice(0,4)).join(', ')+')':''}</td></tr>
    <tr><td>Sleep nights</td><td>${S.sleep.length}</td></tr><tr><td>Food days</td><td>${Object.keys(S.food).filter(d=>S.food[d].length).length}</td></tr>
    <tr><td>Water days</td><td>${Object.keys(S.water||{}).length}</td></tr><tr><td>Activities</td><td>${S.activities.length}</td></tr>
    <tr><td>Storage used</td><td>${kb} KB</td></tr></table>`;
}
/* ---------- RENDER / BOOT ---------- */
function render(){
  const r=nextRace(); $('hdrRace').innerHTML=r?`<b style="color:var(--gold);font-size:18px">${daysBetween(today(),r.date)}</b><br>days to ${esc(r.name.split(' ')[0])}`:'';
  const v=document.querySelector('.view.on').id;
  updateBadge();
  if(v==='v-today')renderToday(); if(v==='v-train')renderTrain(); if(v==='v-race')renderRace(); if(v==='v-health')renderHealth(); if(v==='v-set')fillSettings();
}
function boot(){
  advancePlan(); applyTheme();
  const code=new URLSearchParams(location.search).get('code');
  if(code){ history.replaceState(null,'',location.pathname);
    if(S.settings.secret) exchangeCode(code);
    else { document.body.innerHTML=`<div style="padding:40px 20px;font-family:sans-serif;color:#eef3ea"><h2>Almost there ⛰</h2><p>Copy this code, open Summit from your Home Screen, then go to <b>Setup → Paste auth code</b>.</p>
      <input value="${esc(code)}" style="width:100%;font-size:18px;padding:12px" onclick="this.select()"><button style="margin-top:12px;padding:12px 18px" onclick="navigator.clipboard.writeText('${esc(code)}').then(()=>this.textContent='Copied!')">Copy code</button></div>`; return; }
  }
  render();
  const goP=new URLSearchParams(location.search).get('go'); if(goP){ history.replaceState(null,'',location.pathname);
    ({sleep:()=>openSleep(),food:()=>openFood(),bp:()=>openSheet('bpSheet'),labs:()=>{go('health');openSheet('labSheet');},coach:()=>openReport&&openReport(),water:()=>$('waterCard').scrollIntoView()}[goP]||(()=>{}))(); }
  if(S.strava.refresh&&(!S.strava.lastSync||Date.now()-S.strava.lastSync>6*3600e3)) stravaSync();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message',e=>{ const g=e.data&&e.data.go; if(g) location.href=location.pathname+'?go='+g; }); }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ day=today(); render(); pushStatus(); } else updateBadge(); });
  updateBadge(); pushStatus();
}
