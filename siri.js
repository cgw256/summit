/* Summit + Siri add-on (v2): water, sleep, weight, blood pressure, and "How am I doing today?".
   Siri Shortcuts send entries to your push server; Summit picks them up whenever it opens.
   Requires notifications to be connected (Setup → Notifications & Badge). */
(function(){
  const base=()=>(S.settings.pushUrl||'').replace(/\/$/,'');
  const linked=()=>!!(S.settings.pushUrl&&S.settings.deviceId&&S.settings.deviceToken);
  const r1=v=>Math.round(v*10)/10;

  /* ---- richer status so "How am I doing today?" can answer ---- */
  if(typeof window.todayStatus==='function'){
    const _ts=window.todayStatus;
    window.todayStatus=function(){
      const st=_ts(), d=today();
      try{
        const T=targets(), t=totals(d); st.kcal=Math.round(t.k); st.protein=Math.round(t.p); st.kcalGoal=Math.round(T.k); st.proteinGoal=Math.round(T.p);
        st.phase=S.plan&&S.plan.phase; st.sleepGoal=S.settings.sleepGoal;
        const sl=S.sleep.find(x=>x.date===d); if(sl){ st.sleepHrs=sl.hrs; st.sleepRest=sl.rest; }
        const r=nextRace(); if(r) st.race={name:r.name,date:r.date};
        const W=(S.weights||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
        if(W.length){ const L=W[W.length-1]; st.weight=L.lb; st.weightDate=L.date;
          const wk=W.filter(x=>x.date<=addDays(L.date,-6)).pop(); st.weightWeekAgo=wk?wk.lb:null; }
        if(typeof readiness==='function'){ const R=readiness(); st.readiness=R.v; st.readinessLabel=R.label; st.readinessDate=d; }
      }catch(e){}
      return st;
    };
  }

  async function pullSiri(){
    if(!linked()) return;
    try{
      const r=await fetch(base()+'/pending',{method:'POST',body:JSON.stringify({id:S.settings.deviceId,token:S.settings.deviceToken})});
      const j=await r.json(); if(!j.ok||!j.items||!j.items.length) return;
      const got=[];
      j.items.forEach(it=>{
        if(it.type==='water'&&it.oz>0){ S.water=S.water||{}; S.water[it.date]=r1((S.water[it.date]||0)+it.oz); got.push(`+${Math.round(it.oz)} oz water`); }
        if(it.type==='sleep'&&it.hrs>0){ const prev=S.sleep.find(x=>x.date===it.date);
          S.sleep=S.sleep.filter(x=>x.date!==it.date);
          S.sleep.push({date:it.date,hrs:it.hrs,rest:it.rest||(prev&&prev.rest)||null}); S.sleep.sort((a,b)=>a.date.localeCompare(b.date)); got.push('sleep'); }
        if(it.type==='weight'&&it.lb>0){ if(window.WGT) WGT.add(it.date,it.lb,true); got.push(`${it.lb} lb`); }
        if(it.type==='bp'&&it.sys>0){ S.bp=S.bp||[]; S.bp.push({date:it.date,sys:it.sys,dia:it.dia,pulse:it.pulse||null}); S.bp.sort((a,b)=>a.date.localeCompare(b.date)); got.push(`BP ${it.sys}/${it.dia}`); }
      });
      save(); render();
      toast('🎙 From Siri: '+[...new Set(got)].join(' · '));
      const needRest=S.sleep.find(x=>x.date===today()&&!x.rest); if(needRest) setTimeout(()=>openSleep(today()),900);
    }catch(e){}
  }

  const SUFFIX={water:'&oz=',sleep:'&hrs=',weight:'&lb=',bp:'&sys=',summary:''};
  function siriLink(type){
    const u=new URL(base()+'/log'); u.searchParams.set('id',S.settings.deviceId); u.searchParams.set('token',S.settings.deviceToken); u.searchParams.set('type',type);
    return u.href+SUFFIX[type];
  }
  window.copySiriLink=function(type){
    if(!linked()) return showErr('Turn on notifications first (it creates the link Siri uses)');
    const link=siriLink(type);
    (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Siri link copied ✓ — paste it into a Text action in Shortcuts'))
      .catch(()=>{ prompt('Copy this link:',link); });
  };
  window.testSiri=async function(){
    if(!linked()) return showErr('Turn on notifications first');
    try{ await pushStatusNow(); const j=await (await fetch(siriLink('summary'))).json(); toast(j.say||'Sent'); }catch(e){ showErr('Test failed: '+e.message); }
  };
  async function pushStatusNow(){ try{ await fetch(base()+'/status',{method:'POST',body:JSON.stringify({id:S.settings.deviceId,token:S.settings.deviceToken,status:todayStatus()})}); }catch(e){} }

  function addCard(){
    const set=$('v-set'); if(!set) return; const old=$('siriCard'); if(old) old.remove();
    const c=document.createElement('div'); c.className='card'; c.id='siriCard';
    c.innerHTML=`<h2>🎙 Siri</h2>
      <div class="small mute">Copy a link, then paste it into a <b>Text</b> action in your Shortcut. Needs notifications turned on above.</div>
      <div class="grid2" style="margin-top:10px">
        <button onclick="copySiriLink('water')">💧 Water link</button><button onclick="copySiriLink('sleep')">🌙 Sleep link</button>
        <button onclick="copySiriLink('weight')">⚖️ Weight link</button><button onclick="copySiriLink('bp')">🩺 BP link</button>
        <button style="grid-column:1/-1" onclick="copySiriLink('summary')">⛰ "How am I doing today?" link</button></div>
      <button class="ghost" style="width:100%;margin-top:8px" onclick="testSiri()">Test: hear today's summary</button>
      <div class="small mute" style="margin-top:8px">Keep these links private — anyone with them can log to your Summit.</div>`;
    const anchor=[...set.querySelectorAll('.card')].find(x=>/Notifications/.test(x.textContent));
    anchor?anchor.after(c):set.prepend(c);
  }

  addCard();
  setTimeout(()=>{ pullSiri(); pushStatusNow(); },1500);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') pullSiri(); });
})();
