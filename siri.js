/* Summit + Siri add-on.
   Siri Shortcuts send water/sleep to your push server; Summit picks them up whenever it opens.
   Requires notifications to be connected (Setup → Notifications & Badge) so the app has a device link. */
(function(){
  const base=()=>(S.settings.pushUrl||'').replace(/\/$/,'');
  const linked=()=>!!(S.settings.pushUrl&&S.settings.deviceId&&S.settings.deviceToken);

  async function pullSiri(){
    if(!linked()) return;
    try{
      const r=await fetch(base()+'/pending',{method:'POST',body:JSON.stringify({id:S.settings.deviceId,token:S.settings.deviceToken})});
      const j=await r.json(); if(!j.ok||!j.items||!j.items.length) return;
      let oz=0, nights=0;
      j.items.forEach(it=>{
        if(it.type==='water'&&it.oz>0){ S.water=S.water||{}; S.water[it.date]=Math.round(((S.water[it.date]||0)+it.oz)*10)/10; oz+=it.oz; }
        if(it.type==='sleep'&&it.hrs>0){ const prev=S.sleep.find(x=>x.date===it.date);
          S.sleep=S.sleep.filter(x=>x.date!==it.date);
          S.sleep.push({date:it.date,hrs:it.hrs,rest:it.rest||(prev&&prev.rest)||null}); S.sleep.sort((a,b)=>a.date.localeCompare(b.date)); nights++; }
      });
      save(); render();
      toast('🎙 From Siri: '+[oz?`+${Math.round(oz)} oz water`:'',nights?'sleep logged':''].filter(Boolean).join(' · '));
      const needRest=S.sleep.find(x=>x.date===today()&&!x.rest); if(needRest) setTimeout(()=>openSleep(today()),900);
    }catch(e){}
  }

  function siriLink(type){
    const u=new URL(base()+'/log'); u.searchParams.set('id',S.settings.deviceId); u.searchParams.set('token',S.settings.deviceToken); u.searchParams.set('type',type);
    return u.href+(type==='water'?'&oz=':'&hrs=');
  }
  window.copySiriLink=function(type){
    if(!linked()) return showErr('Turn on notifications first (it creates the link Siri uses)');
    const link=siriLink(type);
    (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Siri link copied ✓ — paste it into Shortcuts'))
      .catch(()=>{ prompt('Copy this link:',link); });
  };
  window.testSiri=async function(){
    if(!linked()) return showErr('Turn on notifications first');
    try{ const j=await (await fetch(siriLink('water')+'8')).json(); toast(j.say||'Sent'); setTimeout(pullSiri,600); }catch(e){ showErr('Test failed: '+e.message); }
  };

  function addCard(){
    const set=$('v-set'); if(!set||$('siriCard')) return;
    const c=document.createElement('div'); c.className='card'; c.id='siriCard';
    c.innerHTML=`<h2>🎙 Siri</h2>
      <div class="small mute">Say <b>"Hey Siri, log water in Summit"</b> → Siri asks how many ounces → it's saved, even when Summit is closed. Needs notifications turned on above.</div>
      <div class="row wrap" style="margin-top:10px"><button onclick="copySiriLink('water')">Copy water link</button><button class="ghost" onclick="copySiriLink('sleep')">Copy sleep link</button><button class="ghost" onclick="testSiri()">Test (+8 oz)</button></div>
      <div class="small mute" style="margin-top:8px">Keep these links private — anyone with them can log water/sleep to your Summit.</div>`;
    const anchor=[...set.querySelectorAll('.card')].find(x=>/Notifications/.test(x.textContent));
    anchor?anchor.after(c):set.prepend(c);
  }

  addCard();
  setTimeout(pullSiri,1500);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') pullSiri(); });
})();
