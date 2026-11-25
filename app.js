/* Summit – Peaks Fitness Coach. All data lives in this phone's storage. */
const KEY = 'summit.v1';
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
function toast(t){ const e=$('toast'); e.textContent=t; e.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>e.style.display='none',2200); }

/* ---------- STATE ---------- */
const DEFAULT = {
  settings:{maxHr:207,maxHrOtf:192,restHr:55,weight:179.3,gPerLb:1.0,ratio:{p:30,c:40,f:30},macroMode:'both',
    clientId:'',secret:'',api:'https://www.strava.com/api/v3',theme:'dark',splatCal:1},
  strava:{},
  activities:[],
  races:[
    {id:'beast26',name:'Spartan Beast – Arizona',type:'spartan-beast',date:'2026-11-21',done:true,
     result:{time:10037,dist:12.99,elevFt:2106,avgHr:165,kcal:1951,gap:661,note:'Avondale, AZ · Garmin Forerunner 265'}},
    {id:'hyrox27',name:'Hyrox Solo',type:'hyrox-open',date:'2027-02-27',done:false,goal:null}],
  food:{}, favorites:[], recentFoods:[],
  plan:{phase:'build',step:100,ceil:2500,floor:1600,auto:true,history:[]},
  bodycomp:[{date:'2026-07-10',bf:14.8,wt:179.3,smm:88.2,bfm:26.5,bmr:2240.4,seg:{tr:66.8,la:8.8,ra:8.9,ll:22.4,rl:22.3}}],
  labs:[], bp:[], otfEmails:[]
};
let S = load();
function load(){ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s) return Object.assign(structuredClone(DEFAULT),s,{settings:Object.assign({},DEFAULT.settings,s.settings)}); }catch(e){} return structuredClone(DEFAULT); }
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ---------- TOPO BACKGROUND (San Francisco Peaks) ---------- */
function drawTopo(){
  const svg=$('topo'), W=400, H=800; svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // Peaks: Humphreys, Agassiz, Fremont, Doyle approx relative positions
  const peaks=[[230,300,1],[275,330,.9],[300,390,.8],[250,420,.7]];
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const ph=[...Array(6)].map(()=>rnd()*6.28);
  const elev=(x,y)=>{ let z=0; for(const[px,py,h]of peaks){ const d=Math.hypot(x-px,(y-py)*.9); z+=h*Math.exp(-d*d/(2*95*95)); }
    z+= .06*Math.sin(x/37+ph[0])*Math.cos(y/53+ph[1]) + .04*Math.sin((x+y)/29+ph[2]); return z; };
  const N=60, gx=W/N, gy=H/(N*2), grid=[];
  for(let j=0;j<=N*2;j++){grid[j]=[];for(let i=0;i<=N;i++)grid[j][i]=elev(i*gx,j*gy);}
  let out='';
  const gold=getComputedStyle(document.body).getPropertyValue('--gold');
  for(let k=1;k<=22;k++){ const lv=k*.07; let d='';
    for(let j=0;j<N*2;j++)for(let i=0;i<N;i++){
      const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],e=grid[j+1][i];
      const pts=[]; const ed=(v1,v2,x1,y1,x2,y2)=>{ if((v1-lv)*(v2-lv)<0){const t=(lv-v1)/(v2-v1);pts.push([(x1+(x2-x1)*t)*gx,(y1+(y2-y1)*t)*gy]);} };
      ed(a,b,i,j,i+1,j);ed(b,c,i+1,j,i+1,j+1);ed(c,e,i+1,j+1,i,j+1);ed(e,a,i,j+1,i,j);
      if(pts.length>=2) d+=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`;
    }
    const idx=k%5===0; out+=`<path d="${d}" fill="none" stroke="${idx?gold:'#7fa58e'}" stroke-opacity="${idx?.35:.18}" stroke-width="${idx?1.1:.6}"/>`;
  }
  out+=`<text x="236" y="296" fill="${gold}" fill-opacity=".5" font-size="9" font-family="sans-serif">▲ Humphreys 12,633′</text>`;
  svg.innerHTML=out;
}

/* ---------- NAV ---------- */
const TITLES={today:['Today','Fuel the climb'],train:['Train','Strava · Garmin · OTF'],race:['Race','Base camp → summit'],health:['Health','Labs · BP · Body comp'],set:['Setup','Settings']};
document.querySelectorAll('nav button[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
function go(v){ document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  document.querySelectorAll('nav button[data-v]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
  $('hdrTitle').textContent=TITLES[v][0]; $('hdrSub').textContent=TITLES[v][1]; render(); scrollTo(0,0); }
function openSheet(id){ $(id).classList.add('on'); const d=today(); ['otf_date','bc_date','bp_date','lab_date'].forEach(x=>{if($(x)&&!$(x).value)$(x).value=d;}); }
function closeSheet(id){ $(id).classList.remove('on'); if(id==='foodSheet') stopScan(); }

/* ---------- CALORIE PLAN (load/cut weeks) ---------- */
function weekStart(d){ const x=new Date(d+'T12:00'); x.setDate(x.getDate()-((x.getDay()+6)%7)); return iso(x); } // Monday
function advancePlan(){
  const P=S.plan, ws=weekStart(today());
  if(!P.history.length){ P.history.push({week:ws,kcal:2000,phase:P.phase}); return; }
  let last=P.history[P.history.length-1];
  while(daysBetween(last.week,ws)>=7){
    let k=last.kcal, ph=P.phase;
    if(ph==='build'){ k=Math.min(P.ceil,k+P.step); if(k>=P.ceil&&P.auto&&last.kcal>=P.ceil) {P.phase='cut'; k=Math.max(P.floor,k-P.step);} }
    else if(ph==='cut'){ k=Math.max(P.floor,k-P.step); if(k<=P.floor&&P.auto&&last.kcal<=P.floor) {P.phase='build'; k=Math.min(P.ceil,k+P.step);} }
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
function totals(d){ return dayFood(d).reduce((a,x)=>{a.k+=x.k*x.q;a.p+=x.p*x.q;a.c+=x.c*x.q;a.f+=x.f*x.q;return a;},{k:0,p:0,c:0,f:0}); }
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
    const items=dayFood(day).map((x,i)=>[x,i]).filter(([x])=>x.meal===m); const mk=items.reduce((a,[x])=>a+x.k*x.q,0);
    return `<div style="margin-bottom:10px"><div class="row between"><b>${m}</b><span class="small mute">${r0(mk)} kcal <button class="sm ghost" onclick="meal='${m}';openFood()">+</button></span></div>
    ${items.map(([x,i])=>`<div class="row between small" style="padding:4px 0"><span>${esc(x.name)} <span class="mute">×${+x.q.toFixed(2)}</span></span><span>${r0(x.k*x.q)} <button class="sm ghost" onclick="delFood(${i})">✕</button></span></div>`).join('')}</div>`; }).join('');
  const lastBp=S.bp[S.bp.length-1];
  $('bpPrompt').innerHTML=(!lastBp||daysBetween(lastBp.date,today())>=30)?`<div class="card" style="border-color:var(--gold)"><div class="row between"><span>🩺 Monthly blood pressure check is due</span><button class="sm" onclick="openSheet('bpSheet')">Log</button></div></div>`:'';
  $('tipToday').innerHTML=coachTips().slice(0,1).map(t=>`<div class="tip">${t}</div>`).join('');
}
function delFood(i){ dayFood(day).splice(i,1); save(); render(); }
function copyYesterday(){ const y=dayFood(addDays(day,-1)); if(!y.length) return toast('Nothing logged yesterday'); y.forEach(x=>dayFood(day).push({...x})); save(); render(); toast('Copied '+y.length+' items'); }
function openFood(){ openSheet('foodSheet'); setSeg('mealSeg','m',meal); renderRecent(); }
function setSeg(id,attr,val){ document.querySelectorAll('#'+id+' button').forEach(b=>b.classList.toggle('on',b.dataset[attr]===val)); }
document.querySelectorAll('#mealSeg button').forEach(b=>b.onclick=()=>{meal=b.dataset.m;setSeg('mealSeg','m',meal);});
function logFood(f,q){ dayFood(day).push({meal,name:f.name,k:f.k,p:f.p,c:f.c,f:f.f,q,serv:f.serv});
  S.recentFoods=[f,...S.recentFoods.filter(x=>x.name!==f.name)].slice(0,40); save(); render(); renderRecent(); toast('Logged '+f.name); }
function renderRecent(){
  const fav=new Set(S.favorites.map(x=>x.name)); const list=[...S.favorites,...S.recentFoods.filter(x=>!fav.has(x.name))].slice(0,30);
  window._recent=list;
  $('recent').innerHTML=list.length?list.map((f,i)=>`<div class="row between"><span onclick="servingSheet(_recent[${i}])"><b>${fav.has(f.name)?'★ ':''}${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · ${esc(f.serv||'1 serving')}</span></span><button class="sm" onclick="logFood(_recent[${i}],1)">+</button></div>`).join(''):'<div class="small mute">Foods you log show up here.</div>';
}
function quickAdd(){ const f={name:$('qa_name').value||'Quick add',k:+$('qa_k').value||0,p:+$('qa_p').value||0,c:+$('qa_c').value||0,f:+$('qa_f').value||0,serv:'1 serving'};
  logFood(f,1); ['qa_name','qa_k','qa_p','qa_c','qa_f'].forEach(x=>$(x).value=''); }
function offToFood(p){
  const n=p.nutriments||{}; const hasServ=n['energy-kcal_serving']!=null;
  const g=(k)=> hasServ? (n[k+'_serving']||0) : (n[k+'_100g']||0);
  return {name:[p.brands&&p.brands.split(',')[0],p.product_name].filter(Boolean).join(' – ')||'Unknown',
    k:hasServ?n['energy-kcal_serving']:(n['energy-kcal_100g']||0), p:g('proteins'), c:g('carbohydrates'), f:g('fat'),
    serv:hasServ?(p.serving_size||'1 serving'):'100 g', code:p.code};
}
async function searchFood(){
  const q=$('q').value.trim(); if(!q) return; $('results').innerHTML='<div class="small mute">Searching…</div>';
  try{ const r=await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20&fields=product_name,brands,nutriments,serving_size,code&search_terms='+encodeURIComponent(q));
    const j=await r.json(); const items=(j.products||[]).filter(p=>p.product_name).map(offToFood); window._res=items;
    $('results').innerHTML=items.length?items.map((f,i)=>`<div class="row between" onclick="servingSheet(_res[${i}])"><span><b>${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)} per ${esc(f.serv)}</span></span><span>›</span></div>`).join(''):'<div class="small mute">No matches – try Quick add.</div>';
  }catch(e){ $('results').innerHTML='<div class="small mute">Search failed (offline?). Use Quick add.</div>'; }
}
function servingSheet(f){
  window._sf=f; const isFav=S.favorites.some(x=>x.name===f.name);
  $('servBody').innerHTML=`<h3 style="margin-top:0">${esc(f.name)}</h3><div class="small mute">Per ${esc(f.serv)}: ${r0(f.k)} kcal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)}</div>
   <label>Number of servings${f.serv==='100 g'?' (×100 g)':''}</label><input id="sv_q" type="number" step="0.25" value="1">
   <div class="row" style="margin-top:12px"><button class="ghost" onclick="toggleFav()">${isFav?'★ Unfavorite':'☆ Favorite'}</button><button style="flex:1" onclick="logFood(_sf,+$('sv_q').value||1);closeSheet('servSheet')">Add to ${meal}</button></div>`;
  openSheet('servSheet');
}
function toggleFav(){ const f=_sf; const i=S.favorites.findIndex(x=>x.name===f.name); i>=0?S.favorites.splice(i,1):S.favorites.push(f); save(); servingSheet(f); renderRecent(); }
let scanner=null;
async function startScan(){
  if(!window.Html5Qrcode) return toast('Scanner needs internet the first time');
  stopScan(); scanner=new Html5Qrcode('reader',{formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E]});
  try{ await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:120}},async code=>{ stopScan(); lookupBarcode(code); }); }
  catch(e){ toast('Camera unavailable – allow camera access'); }
}
function stopScan(){ if(scanner){ scanner.stop().catch(()=>{}).finally(()=>{try{scanner.clear()}catch(e){}}); scanner=null; } }
async function lookupBarcode(code){
  toast('Looking up '+code);
  try{ const j=await (await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size,code`)).json();
    if(j.status===1&&j.product) servingSheet(offToFood(j.product)); else { toast('Not in database – quick add it'); $('qa_name').value='Item '+code; } }
  catch(e){ toast('Lookup failed'); }
}

/* ---------- STRAVA ---------- */
function stravaConnect(){
  saveSettings(true); const s=S.settings; if(!s.clientId) return toast('Enter your Client ID first');
  const redirect=location.origin+location.pathname;
  location.href=`https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(s.clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&approval_prompt=auto&scope=read,activity:read_all`;
}
async function tokenCall(params){
  const s=S.settings; const body=new URLSearchParams({client_id:s.clientId,client_secret:s.secret,...params});
  const r=await fetch('https://www.strava.com/oauth/token',{method:'POST',body}); const j=await r.json();
  if(!j.access_token) throw new Error(j.message||'Token error');
  S.strava={access:j.access_token,refresh:j.refresh_token,expires:j.expires_at,athlete:(j.athlete&&j.athlete.firstname)||S.strava.athlete}; save(); return j;
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
    const tok=await stravaToken(), H={Authorization:'Bearer '+tok};
    const after=S.strava.lastSync?Math.floor(S.strava.lastSync/1000)-86400*2:Math.floor(Date.now()/1000)-86400*180;
    let page=1, got=[];
    while(page<10){ const r=await fetch(`${s.api}/athlete/activities?after=${after}&per_page=100&page=${page}`,{headers:H});
      if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json(); got=got.concat(j); if(j.length<100)break; page++; }
    let streamsLeft=60;
    for(const a of got){
      const otf=isOtf(a), max=otf?s.maxHrOtf:s.maxHr;
      const ex=S.activities.find(x=>x.id===a.id);
      const rec={id:a.id,name:a.name,type:a.sport_type||a.type,otf,date:a.start_date_local.slice(0,10),dist:a.distance||0,moving:a.moving_time||0,elapsed:a.elapsed_time||0,
        elev:a.total_elevation_gain||0,avgHr:a.average_heartrate||null,maxHr:a.max_heartrate||null,kcal:a.calories||(a.kilojoules?a.kilojoules*1.1:null),
        zones:ex&&ex.zones, splatEst:ex&&ex.splatEst, splatActual:ex&&ex.splatActual};
      if(a.has_heartrate&&!rec.zones&&streamsLeft-->0){
        try{ const sr=await fetch(`${s.api}/activities/${a.id}/streams?keys=heartrate,time&key_by_type=true`,{headers:H});
          if(sr.ok){ const st=await sr.json(); const hr=st.heartrate&&st.heartrate.data, tm=st.time&&st.time.data;
            if(hr&&tm){ const z=[0,0,0,0,0]; for(let i=1;i<hr.length;i++){ const dt=Math.min(30,tm[i]-tm[i-1]); z[zoneOf(hr[i],max)]+=dt; }
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
  const t=$('otf_txt').value; const num=re=>{const m=t.match(re);return m?+m[1].replace(/,/g,''):null;};
  const sp=num(/splat\s*points?\D{0,20}(\d+)/i)??num(/(\d+)\s*splat/i);
  const k=num(/calories?(?:\s*burned)?\D{0,20}([\d,]+)/i)??num(/([\d,]+)\s*(?:cal|calories)/i);
  const h=num(/(?:avg|average)\.?\s*(?:heart\s*rate|hr)\D{0,20}(\d+)/i);
  const dm=t.match(/(\w+day,?\s+)?(\w+\s+\d{1,2},?\s+\d{4})/); if(dm){const d=new Date(dm[2]); if(!isNaN(d)) $('otf_date').value=iso(d);}
  if(sp!=null)$('otf_s').value=sp; if(k!=null)$('otf_k').value=k; if(h!=null)$('otf_h').value=h;
  toast(sp!=null?'Found '+sp+' splats':'Couldn\'t find splats – type them in');
}
function saveOtf(){
  const d=$('otf_date').value, sp=+$('otf_s').value; if(!d||!$('otf_s').value) return toast('Need date and splats');
  S.otfEmails.push({date:d,splats:sp,kcal:+$('otf_k').value||null,avgHr:+$('otf_h').value||null});
  const a=S.activities.find(x=>x.otf&&x.date===d);
  if(a){ a.splatActual=sp; if(a.splatEst>0){ const pairs=S.activities.filter(x=>x.splatActual!=null&&x.splatEst>0);
      S.settings.splatCal=+(pairs.reduce((s,x)=>s+x.splatActual,0)/pairs.reduce((s,x)=>s+x.splatEst,0)).toFixed(2);} }
  save(); closeSheet('otfSheet'); $('otf_txt').value=''; toast(a?'Matched to '+a.name:'Saved (no Strava match yet)'); render();
}
const splats = a => a.splatActual ?? (a.splatEst!=null?Math.round(a.splatEst*S.settings.splatCal):null);

/* ---------- TRAINING LOAD ---------- */
function trimp(a){ const s=S.settings, max=a.otf?s.maxHrOtf:s.maxHr, min=a.moving/60;
  if(!a.avgHr) return min*0.6; const x=Math.max(0,Math.min(1,(a.avgHr-s.restHr)/(max-s.restHr))); return min*x*0.64*Math.exp(1.92*x); }
function loadSeries(days=90){
  const by={}; S.activities.forEach(a=>by[a.date]=(by[a.date]||0)+trimp(a));
  let ctl=0,atl=0; const out=[]; const start=addDays(today(),-days-42);
  for(let i=0;i<=days+42;i++){ const d=addDays(start,i), l=by[d]||0; ctl+=(l-ctl)/42; atl+=(l-atl)/7; if(i>=42) out.push({d,ctl,atl,tsb:ctl-atl,l}); }
  return out;
}
function lastN(n){ const c=addDays(today(),-n); return S.activities.filter(a=>a.date>c); }
const isRun = a => /Run/.test(a.type);

/* ---------- RACES & PREDICTION ---------- */
function nextRace(){ return S.races.filter(r=>!r.done&&r.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0]; }
function recentRunPace(){
  const runs=lastN(42).filter(a=>isRun(a)&&a.dist*M2MI>=2.5&&a.moving>0);
  if(runs.length){ const paces=runs.map(a=>a.moving/(a.dist*M2MI)).sort((a,b)=>a-b); return {pace:paces[Math.min(1,paces.length-1)],src:`your best recent runs (${runs.length} runs ≥2.5 mi, last 6 wks)`}; }
  const b=S.races.find(r=>r.type==='spartan-beast'&&r.result); if(b) return {pace:b.result.gap*0.85,src:'your Spartan Beast grade-adjusted pace (no recent Strava runs yet)'};
  return null;
}
function predictHyrox(){
  const rp=recentRunPace(); if(!rp) return null;
  const otfWk=lastN(28).filter(a=>a.otf).length/4;
  const runS = 8/1.609344 * rp.pace * 1.14;          // 8 km under fatigue
  const stations = otfWk>=3?40*60:otfWk>=2?43*60:47*60; // 8 stations, OTF strength/power base
  const rox = 7*60;
  const mid=runS+stations+rox; return {lo:mid*0.94,mid,hi:mid*1.07,runS,stations,rox,src:rp.src,otfWk};
}
function renderRace(){
  const r=nextRace();
  if(!r){ $('summitCard').innerHTML='<h2>Next summit</h2><div class="mute">Add a goal race to start your climb.</div>'; }
  else{
    const left=daysBetween(today(),r.date), block=Math.max(left,84), prog=Math.max(0,Math.min(1,1-left/block));
    const camps=['Base Camp','Snowbowl','Agassiz Saddle','False Summit','Humphreys Summit'];
    const ci=Math.min(4,Math.floor(prog*4.999));
    $('summitCard').innerHTML=`<h2><span>${esc(r.name)}</span><span>${fmtDate(r.date)}</span></h2>
     <div class="row between"><div><div class="big">${left}</div><div class="small mute">days to race</div></div><div style="text-align:right"><span class="pill">${camps[ci]}</span><div class="small mute" style="margin-top:4px">Goal: ${r.goal?hms(r.goal):'<a style="color:var(--gold)" onclick="editRace(\''+r.id+'\')">set goal</a>'}</div></div></div>
     <svg viewBox="0 0 300 110" width="100%" style="margin-top:10px"><path d="M0 110 L60 80 L110 88 L170 40 L205 52 L240 14 L300 110Z" fill="rgba(127,165,142,.25)" stroke="#7fa58e"/>
      <path d="M225 28 L240 14 L255 32 L247 28 L240 33 L232 27Z" fill="var(--snow)"/>
      <path id="trail" d="M10 106 L60 80 L110 88 L170 40 L205 52 L240 14" fill="none" stroke="var(--gold)" stroke-width="3" stroke-dasharray="4 5" opacity=".5"/>
      ${(()=>{const pts=[[10,106],[60,80],[110,88],[170,40],[205,52],[240,14]];const L=[];let tot=0;for(let i=1;i<pts.length;i++){L.push(Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));tot+=L[i-1];}
        let t=prog*tot,i=0;while(i<L.length-1&&t>L[i]){t-=L[i];i++;}const f=Math.min(1,t/L[i]);const x=pts[i][0]+(pts[i+1][0]-pts[i][0])*f,y=pts[i][1]+(pts[i+1][1]-pts[i][1])*f;
        return `<circle cx="${x}" cy="${y}" r="7" fill="var(--gold)"/><text x="${x}" y="${y+4}" font-size="9" text-anchor="middle">🥾</text>`;})()}
     </svg>`;
  }
  const P=predictHyrox(), hy=S.races.find(x=>/hyrox/.test(x.type)&&!x.done);
  if(P&&hy){ const g=hy.goal;
    $('predict').innerHTML=`<div class="row between"><div><div class="big">${hms(P.mid)}</div><div class="small mute">realistic Hyrox Open today (range ${hms(P.lo)}–${hms(P.hi)})</div></div></div>
     <table style="margin-top:8px"><tr><td>8 km running (fatigued)</td><td>${hms(P.runS)}</td></tr><tr><td>8 stations</td><td>${hms(P.stations)}</td></tr><tr><td>Roxzone transitions</td><td>${hms(P.rox)}</td></tr></table>
     <div class="small mute" style="margin-top:8px">Based on ${P.src} and ${P.otfWk.toFixed(1)} OTF classes/week. This is a rough estimate that tightens as more data syncs.</div>
     ${g?`<div class="tip">${g<P.lo?`Your goal ${hms(g)} is a stretch — ~${r0((P.mid-g)/60)} min faster than predicted. Doable with focused run volume + compromised-run sessions.`:g>P.hi?`Your goal ${hms(g)} looks comfortable — consider aiming for ${hms(P.mid*0.97)}.`:`Your goal ${hms(g)} is right on target. 🎯`}</div>`:`<button class="sm" style="margin-top:8px" onclick="setGoalPrompt('${hy.id}',${r0(P.mid*0.97)})">Set a goal time</button>`}`;
  } else $('predict').innerHTML='<div class="mute">Connect Strava and sync to get a prediction.</div>';
  $('plan').innerHTML=weeklyPlan().map(x=>`<div class="tip">${x}</div>`).join('')+coachTips().map(t=>`<div class="tip">${t}</div>`).join('');
  $('races').innerHTML=S.races.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<div class="row between" onclick="editRace('${r.id}')"><span><b>${esc(r.name)}</b><br><span class="small mute">${fmtDate(r.date)} ${r.date.slice(0,4)}${r.result?` · ${hms(r.result.time)} · ${r.result.dist} mi · ${r.result.elevFt.toLocaleString()} ft`:''}</span></span><span class="pill ${r.done?'green':''}">${r.done?'✓ Summited':'Goal'}</span></div>`).join('');
}
function setGoalPrompt(id,sugg){ const v=prompt('Goal time (h:mm:ss)',hms(sugg)); if(!v)return; const p=v.split(':').map(Number); const s=p.reduce((a,x)=>a*60+x,0); S.races.find(r=>r.id===id).goal=s; save(); render(); }
function editRace(id){
  const r=S.races.find(x=>x.id===id)||{id:'r'+Date.now(),name:'',type:'hyrox-open',date:'',done:false};
  window._er=r;
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

/* ---------- COACH ---------- */
function weeklyPlan(){
  const r=nextRace(); if(!r) return ['Pick your next summit to get a weekly plan.'];
  const w=Math.ceil(daysBetween(today(),r.date)/7), hy=/hyrox/.test(r.type), sp=/spartan/.test(r.type);
  const phase=w<=1?'Race week':w<=2?'Taper':w<=6?'Build':'Base';
  const plan={ Base:hy?'3 OTF classes · 1 easy run 4–6 mi · 1 tempo run (20 min at comfortably hard) · 1 long walk/hike':'3 OTF · 1 trail run with hills · 1 long hike with pack',
    Build:hy?'3 OTF (push for 15–20 splats) · 1 "compromised run": 8×(1 km run + 2–3 min hard effort) · 1 easy 5 mi · rest day':'3 OTF · hill repeats · long trail run · grip/carry work',
    Taper:'2 OTF (moderate, ~10–12 splats) · 1 short run with 4×1 km at race pace · extra sleep',
    'Race week':'1 light OTF early in the week · 20-min shakeout 2 days out · carbs up 2 days out · rest the day before' }[phase];
  return [`<b>${phase} · ${w} week${w===1?'':'s'} out</b><br>${plan}`];
}
function coachTips(){
  const tips=[], s=loadSeries(42), L=s[s.length-1]||{ctl:0,atl:0,tsb:0}, r=nextRace(), wk=lastN(7);
  const otf=wk.filter(a=>a.otf), runMi=wk.filter(isRun).reduce((a,x)=>a+x.dist*M2MI,0), spl=otf.reduce((a,x)=>a+(splats(x)||0),0);
  const T=targets(), t=totals(today()), left=daysToRace();
  if(L.tsb<-20) tips.push(`Form is ${r0(L.tsb)} — you're carrying fatigue. Make the next OTF a 12-splat day or take a walk instead.`);
  else if(L.tsb>10&&left>14) tips.push(`You're fresh (form +${r0(L.tsb)}). Good day to push an all-out OTF or a tempo run.`);
  if(r&&/hyrox/.test(r.type)&&runMi<8&&left>14) tips.push(`Only ${runMi.toFixed(1)} run miles this week. Hyrox is 8 km of running — aim for 10–15 mi/week alongside OTF.`);
  if(otf.length) tips.push(`${otf.length} OTF class${otf.length>1?'es':''} this week, ~${spl} splats. ${spl/otf.length>18?'Big efforts — balance with an easy day.':'Solid work.'}`);
  if(S.plan.phase==='cut'&&left<=21&&left>=0) tips.push('Race is within 3 weeks — consider switching to Hold or Load so you show up fueled.');
  if(day===today()&&t.p<T.p*0.5&&new Date().getHours()>=14) tips.push(`Protein is at ${r0(t.p)} g of ${r0(T.p)} — prioritize a protein-heavy dinner.`);
  if(!tips.length) tips.push('Stay consistent: every logged meal and workout moves you up the mountain. ⛰');
  return tips;
}
const daysToRace=()=>{ const r=nextRace(); return r?daysBetween(today(),r.date):999; };

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
  const totFt=S.activities.reduce((a,x)=>a+x.elev*M2FT,0);
  const humps=totFt/4400; // Humphreys trail ≈ 3,300 ft gain from Snowbowl; use 4,400 incl. approach
  $('elev').innerHTML=`<div class="row between"><div><div class="big">${r0(totFt).toLocaleString()} ft</div><div class="small mute">climbed (synced activities)</div></div><div style="text-align:right"><div class="big" style="font-size:26px">${humps.toFixed(1)}×</div><div class="small mute">Humphreys climbs</div></div></div>
    <div class="bar" style="margin-top:8px"><i style="width:${(humps%1)*100}%;background:linear-gradient(90deg,#7fa58e,var(--snow))"></i></div><div class="small mute">${r0((1-humps%1)*4400)} ft to your next summit</div>`;
  const wk=lastN(7); const sum=wk.reduce((a,x)=>{a.n++;a.min+=x.moving/60;a.mi+=isRun(x)||/Walk|Hike/.test(x.type)?x.dist*M2MI:0;a.sp+=x.otf?(splats(x)||0):0;a.otf+=x.otf?1:0;return a;},{n:0,min:0,mi:0,sp:0,otf:0});
  $('week').innerHTML=`<div class="grid3"><div><div class="big" style="font-size:24px">${sum.n}</div><div class="small mute">workouts</div></div><div><div class="big" style="font-size:24px">${sum.mi.toFixed(1)}</div><div class="small mute">run/walk mi</div></div><div><div class="big" style="font-size:24px;color:#f08a24">${sum.sp}</div><div class="small mute">splats (${sum.otf} OTF)</div></div></div>`;
  $('acts').innerHTML=S.activities.slice(0,25).map(a=>{ const z=a.zones, zt=z?z.reduce((x,y)=>x+y,0):0, sp=splats(a);
    return `<div><div class="row between"><b>${a.otf?'🟠 ':isRun(a)?'🏃 ':/Walk|Hike/.test(a.type)?'🥾 ':'⛰ '}${esc(a.name)}</b><span class="small mute">${fmtDate(a.date)}</span></div>
    <div class="small mute">${hms(a.moving)}${a.dist?` · ${(a.dist*M2MI).toFixed(2)} mi`:''}${a.dist&&isRun(a)?` · ${pace(a.moving/(a.dist*M2MI))}`:''}${a.avgHr?` · ${r0(a.avgHr)} bpm`:''}${a.otf&&sp!=null?` · <span style="color:#f08a24">${sp} splats${a.splatActual!=null?' ✓':' est'}</span>`:''}</div>
    ${z?`<div class="zones">${z.map((m,i)=>`<i style="width:${m/zt*100}%;background:${ZC[i]}"></i>`).join('')}</div>`:''}</div>`; }).join('')||'<div class="mute small">No activities yet.</div>';
  const B=[['🏔','Beast Slayer',S.races.some(r=>r.type==='spartan-beast'&&r.done)],['🟠','Splat 100',S.activities.filter(a=>a.otf).reduce((a,x)=>a+(splats(x)||0),0)>=100],
    ['🥾','Humphreys ×1',humps>=1],['⛰','Humphreys ×5',humps>=5],['🔥','4 OTF Week',sum.otf>=4],['🏃','15 mi Week',sum.mi>=15],['🍽','7-day Log Streak',streak()>=7],['🩺','Health Check',S.labs.length>0&&S.bp.length>0]];
  $('badges').innerHTML=B.map(([i,n,g])=>`<span class="badge ${g?'got':''}"><b>${i}</b>${n}</span>`).join('');
}
function streak(){ let n=0,d=today(); if(!dayFood(d).length)d=addDays(d,-1); while((S.food[d]||[]).length){n++;d=addDays(d,-1);} return n; }

/* ---------- HEALTH ---------- */
let tesseractLoading=null;
function loadTesseract(){ return tesseractLoading||(tesseractLoading=new Promise((res,rej)=>{ if(window.Tesseract)return res(); const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); })); }
async function ocr(file,status){ $(status).textContent='Reading image on-device…'; await loadTesseract(); const r=await Tesseract.recognize(file,'eng'); $(status).textContent=''; return r.data.text; }
async function ocrBC(files){
  let txt=''; try{ for(const f of files) txt+='\n'+await ocr(f,'bcStatus'); }catch(e){ $('bcStatus').textContent='Could not read image – enter values manually.'; return; }
  const t=txt.replace(/,(\d{3})/g,'$1'); const g=re=>{const m=t.match(re);return m?m[1]:null;};
  const set=(id,v)=>{ if(v!=null) $(id).value=v; };
  set('bc_bf',g(/(\d{1,2}\.\d)\s*%?\s*BODY\s*FAT/i)); set('bc_wt',g(/WEIGHT[\s\S]{0,40}?(\d{2,3}\.\d)\s*lb/i));
  set('bc_smm',g(/SKELETAL\s*MUSCLE\s*MASS[\s\S]{0,40}?(\d{2,3}\.\d)\s*lb/i)); set('bc_bfm',g(/BODY\s*FAT\s*MASS[\s\S]{0,40}?(\d{1,3}\.\d)\s*lb/i));
  set('bc_bmr',g(/METABOLIC\s*RATE[\s\S]{0,20}?(\d{3,4}(?:\.\d)?)/i));
  const dm=t.match(/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+\s+\d{1,2},?\s+\d{4})/i); if(dm){const d=new Date(dm[1]); if(!isNaN(d)) $('bc_date').value=iso(d);}
  const segTxt=t.slice(t.search(/LEFT[\s\S]*RIGHT/i)>=0?t.search(/LEFT/i):0);
  const segs=[...segTxt.matchAll(/(\d{1,2}\.\d)\s*lb\s*\n?\s*\d{2,3}\.\d\s*%/gi)].map(m=>+m[1]);
  if(segs.length>=5){ const sorted=segs.slice(0,5); ['bc_tr','bc_la','bc_ra','bc_ll','bc_rl'].forEach((id,i)=>$(id).value=sorted[i]); }
  $('bcStatus').textContent='Done – please double-check every value.';
}
function saveBC(){ const v=id=>+$(id).value||null;
  S.bodycomp.push({date:$('bc_date').value||today(),bf:v('bc_bf'),wt:v('bc_wt'),smm:v('bc_smm'),bfm:v('bc_bfm'),bmr:v('bc_bmr'),seg:{tr:v('bc_tr'),la:v('bc_la'),ra:v('bc_ra'),ll:v('bc_ll'),rl:v('bc_rl')}});
  S.bodycomp.sort((a,b)=>a.date.localeCompare(b.date)); if(v('bc_wt')) S.settings.weight=v('bc_wt'); save(); closeSheet('bcSheet'); render(); toast('Scan saved'); }
function saveBP(){ const s=+$('bp_s').value,d=+$('bp_d').value; if(!s||!d) return toast('Enter both numbers');
  S.bp.push({date:$('bp_date').value||today(),sys:s,dia:d,pulse:+$('bp_p').value||null}); S.bp.sort((a,b)=>a.date.localeCompare(b.date)); save(); closeSheet('bpSheet'); render(); }
function bpCat(s,d){ return s>=130||d>=80?['Stage 1+','red']:s>=120?['Elevated','']:['Normal','green']; }
let labRows=[];
async function ocrLabs(file){ try{ const t=await ocr(file,'labStatus'); $('lab_txt').value=t; parseLabs(t);}catch(e){$('labStatus').textContent='Could not read image.';} }
function parseLabs(t){
  labRows=[]; const re=/^\s*([A-Za-z][A-Za-z0-9 ,'\-\(\)\/\.%]{1,40}?)[\s:]+([<>]?\s*\d+(?:\.\d+)?)\s*(?:(H|L|High|Low)\s+)?([a-zA-Zµμ%\/\^\.\d\*]{0,14})?\s*(?:(?:Ref(?:erence)?\s*(?:Range)?:?\s*)?(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?|[<>]\s*\d+(?:\.\d+)?))?/;
  t.split(/\n/).forEach(line=>{ const m=line.match(re); if(m&&!/^(page|date|patient|dob|name|phone|collected|received|reported)/i.test(m[1].trim()))
    labRows.push({name:m[1].trim(),value:m[2].replace(/\s/g,''),unit:(m[4]||'').trim(),range:(m[5]||'').replace(/\s/g,'')}); });
  renderLabTbl(); toast(labRows.length+' results found – review below');
}
function addLabRow(){ labRows.push({name:'',value:'',unit:'',range:''}); renderLabTbl(); }
function renderLabTbl(){ $('labTbl').innerHTML='<tr><th>Test</th><th>Value</th><th>Unit</th><th>Range</th><th></th></tr>'+labRows.map((r,i)=>
  `<tr>${['name','value','unit','range'].map(k=>`<td><input style="padding:5px;font-size:14px" value="${esc(r[k])}" onchange="labRows[${i}].${k}=this.value"></td>`).join('')}<td><button class="sm ghost" onclick="labRows.splice(${i},1);renderLabTbl()">✕</button></td></tr>`).join(''); }
function saveLabs(){ const d=$('lab_date').value||today(); labRows.filter(r=>r.name&&r.value).forEach(r=>S.labs.push({date:d,...r})); labRows=[]; renderLabTbl(); $('lab_txt').value=''; save(); closeSheet('labSheet'); render(); toast('Labs saved'); }
function outOfRange(r){ const v=parseFloat(String(r.value).replace(/[<>]/,'')); const m=String(r.range).match(/([\d.]+)[-–]([\d.]+)/); if(m) return v<+m[1]||v>+m[2];
  const lt=String(r.range).match(/<([\d.]+)/); if(lt) return v>=+lt[1]; const gt=String(r.range).match(/>([\d.]+)/); if(gt) return v<=+gt[1]; return false; }
function miniSpark(vals,color){ if(vals.length<2) return ''; const mx=Math.max(...vals),mn=Math.min(...vals),W=80,H=24;
  return `<svg width="${W}" height="${H}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${vals.map((v,i)=>`${i/(vals.length-1)*W},${H-2-(mx===mn?.5:(v-mn)/(mx-mn))*(H-4)}`).join(' ')}"/></svg>`; }
function renderHealth(){
  const b=S.bodycomp, L=b[b.length-1], P=b[b.length-2], d=(k)=>P&&L[k]!=null&&P[k]!=null?` <span class="small ${ (k==='bf'||k==='bfm')===(L[k]>P[k])?'flag':''}" style="${(k==='bf'||k==='bfm')===(L[k]>P[k])?'':'color:var(--green)'}">${L[k]>P[k]?'▲':'▼'}${Math.abs(L[k]-P[k]).toFixed(1)}</span>`:'';
  $('bc').innerHTML=L?`<div class="small mute">Latest: ${fmtDate(L.date)} ${L.date.slice(0,4)} · ${b.length} scan${b.length>1?'s':''}</div>
   <div class="grid3" style="margin-top:8px"><div><div class="big" style="font-size:24px">${L.bf}%</div><div class="small mute">body fat${d('bf')}</div></div><div><div class="big" style="font-size:24px">${L.smm}</div><div class="small mute">muscle lb${d('smm')}</div></div><div><div class="big" style="font-size:24px">${L.wt}</div><div class="small mute">weight lb${d('wt')}</div></div></div>
   <div class="small" style="margin-top:8px">Fat mass ${L.bfm} lb · BMR ${r0(L.bmr)} kcal${L.seg&&L.seg.tr?` · Lean: trunk ${L.seg.tr}, arms ${L.seg.la}/${L.seg.ra}, legs ${L.seg.ll}/${L.seg.rl} lb`:''}</div>
   <div class="row" style="margin-top:6px">${miniSpark(b.map(x=>x.bf).filter(Boolean),'var(--f)')}${miniSpark(b.map(x=>x.smm).filter(Boolean),'var(--sky)')}</div>
   ${L.bmr?`<div class="small mute" style="margin-top:6px">Your current calorie target (${curKcal()}) is ${curKcal()<L.bmr?'<b>below</b>':'above'} your measured BMR of ${r0(L.bmr)}.</div>`:''}`:'<div class="mute">Scan your first OTF body comp.</div>';
  const bp=S.bp; $('bp').innerHTML=bp.length?bp.slice(-6).reverse().map(x=>{const[c,k]=bpCat(x.sys,x.dia);return `<div class="row between small" style="padding:4px 0"><span>${fmtDate(x.date)} ${x.date.slice(0,4)}</span><b>${x.sys}/${x.dia}${x.pulse?` · ${x.pulse} bpm`:''}</b><span class="pill ${k}">${c}</span></div>`;}).join('')+`<div>${miniSpark(bp.map(x=>x.sys),'var(--red)')}</div>`:'<div class="mute small">Log monthly — you\'ll get a reminder on the Fuel screen.</div>';
  const by={}; S.labs.forEach(r=>(by[r.name.toLowerCase()]=by[r.name.toLowerCase()]||[]).push(r));
  const keys=Object.keys(by).sort();
  $('labs').innerHTML=keys.length?`<table><tr><th>Test</th><th>Latest</th><th>Range</th><th>Trend</th></tr>${keys.map(k=>{const a=by[k].sort((x,y)=>x.date.localeCompare(y.date)),l=a[a.length-1],o=outOfRange(l);
    return `<tr><td>${esc(l.name)}<div class="small mute">${fmtDate(l.date)} ${l.date.slice(2,4)}</div></td><td class="${o?'flag':''}">${esc(l.value)} <span class="small mute">${esc(l.unit)}</span></td><td class="small mute">${esc(l.range)}</td><td>${miniSpark(a.map(x=>parseFloat(x.value)).filter(x=>!isNaN(x)),o?'var(--red)':'var(--green)')}</td></tr>`;}).join('')}</table><div class="small mute" style="margin-top:6px">Red = outside the lab's reference range. Talk with your doctor about any flagged values.</div>`:'<div class="mute small">Paste or scan your blood work to track every marker over time.</div>';
}

/* ---------- SETTINGS ---------- */
function fillSettings(){ const s=S.settings,P=S.plan;
  $('s_kcal').value=curKcal(); $('s_step').value=P.step; $('s_ceil').value=P.ceil; $('s_floor').value=P.floor; $('s_auto').checked=P.auto;
  $('s_rp').value=s.ratio.p; $('s_rc').value=s.ratio.c; $('s_rf').value=s.ratio.f; $('s_gpl').value=s.gPerLb; $('s_wt').value=s.weight;
  $('s_mhr').value=s.maxHr; $('s_omhr').value=s.maxHrOtf; $('s_rhr').value=s.restHr; $('s_cid').value=s.clientId; $('s_csec').value=s.secret; $('s_api').value=s.api;
  $('calib').textContent='×'+s.splatCal; setSeg('phaseSeg','p',P.phase); setSeg('mmSeg','m',s.macroMode);
  $('stravaStatus').innerHTML=S.strava.refresh?`✅ Connected${S.strava.athlete?' as '+esc(S.strava.athlete):''}`:'Not connected.';
  $('planHist').innerHTML=P.history.slice(-8).map(h=>`${fmtDate(h.week)}: ${h.kcal} (${h.phase})`).join(' · ');
}
document.querySelectorAll('#phaseSeg button').forEach(b=>b.onclick=()=>{S.plan.phase=b.dataset.p;setSeg('phaseSeg','p',b.dataset.p);save();toast(b.textContent.trim()+' — applies from next week');});
document.querySelectorAll('#mmSeg button').forEach(b=>b.onclick=()=>{S.settings.macroMode=b.dataset.m;setSeg('mmSeg','m',b.dataset.m);});
function saveSettings(quiet){ const s=S.settings,P=S.plan,n=id=>+$(id).value;
  P.step=n('s_step')||100; P.ceil=n('s_ceil')||2500; P.floor=n('s_floor')||1600; P.auto=$('s_auto').checked;
  const k=Math.max(P.floor,Math.min(P.ceil,n('s_kcal')||2000)); P.history[P.history.length-1].kcal=k;
  s.ratio={p:n('s_rp'),c:n('s_rc'),f:n('s_rf')}; s.gPerLb=n('s_gpl')||1; s.weight=n('s_wt')||s.weight;
  s.maxHr=n('s_mhr')||207; s.maxHrOtf=n('s_omhr')||192; s.restHr=n('s_rhr')||55;
  s.clientId=$('s_cid').value.trim(); s.secret=$('s_csec').value.trim(); s.api=$('s_api').value.trim().replace(/\/$/,'')||DEFAULT.settings.api;
  save(); if(!quiet){toast('Saved');render();} }
function toggleTheme(){ S.settings.theme=S.settings.theme==='light'?'dark':'light'; save(); applyTheme(); }
function applyTheme(){ document.body.classList.toggle('light',S.settings.theme==='light'); drawTopo(); }
function exportData(){ const blob=new Blob([JSON.stringify({...S,settings:{...S.settings,secret:''},strava:{}},null,1)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='summit-backup-'+today()+'.json'; a.click(); toast('Backup saved (Strava keys excluded)'); }
function importData(inp){ const f=inp.files[0]; if(!f)return; f.text().then(t=>{ const d=JSON.parse(t); const keep={settings:S.settings,strava:S.strava};
  S=Object.assign(structuredClone(DEFAULT),d); S.settings=Object.assign({},DEFAULT.settings,d.settings,{clientId:keep.settings.clientId,secret:keep.settings.secret}); S.strava=keep.strava; save(); toast('Restored'); render(); }).catch(()=>toast('Invalid backup')); }

/* ---------- RENDER / BOOT ---------- */
function render(){
  const r=nextRace(); $('hdrRace').innerHTML=r?`<b style="color:var(--gold);font-size:18px">${daysBetween(today(),r.date)}</b><br>days to ${esc(r.name.split(' ')[0])}`:'';
  const v=document.querySelector('.view.on').id;
  if(v==='v-today')renderToday(); if(v==='v-train')renderTrain(); if(v==='v-race')renderRace(); if(v==='v-health')renderHealth(); if(v==='v-set')fillSettings();
}
(function boot(){
  advancePlan(); applyTheme();
  const code=new URLSearchParams(location.search).get('code');
  if(code){ history.replaceState(null,'',location.pathname);
    if(S.settings.secret) exchangeCode(code);
    else { // iPhone opened the Strava redirect in Safari instead of the Home Screen app
      document.body.innerHTML=`<div style="padding:40px 20px;font-family:sans-serif"><h2>Almost there ⛰</h2><p>Copy this code, open the Summit app from your Home Screen, go to <b>Setup → Paste auth code</b>.</p>
      <input value="${esc(code)}" style="width:100%;font-size:18px;padding:12px" onclick="this.select()"><button style="margin-top:12px;padding:12px 18px" onclick="navigator.clipboard.writeText('${esc(code)}').then(()=>this.textContent='Copied!')">Copy code</button></div>`; return; }
  }
  render();
  if(S.strava.refresh && (!S.strava.lastSync || Date.now()-S.strava.lastSync>6*3600e3)) stravaSync();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
