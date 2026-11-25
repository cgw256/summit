/* Summit add-on: daily weight log + trend chart (1W / 1M / 3M / 6M / 1Y) + coach insight.
   Load after boot():  <script src="weight.js"></script>  */
(function(){
  if(window.WGT) return;
  S.weights=S.weights||[];
  // seed from OTF body-comp scans the first time
  if(!S.weights.length&&S.bodycomp) S.bodycomp.forEach(b=>{ if(b.wt) S.weights.push({date:b.date,lb:b.wt,src:'scan'}); });
  const sorted=()=>S.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const num=v=>parseFloat(String(v??'').replace(',','.'));
  const R={'1W':7,'1M':30,'3M':91,'6M':182,'1Y':365}; let range='1M';

  const css=document.createElement('style'); css.textContent=`
    #wSeg button{padding:7px 0;font-size:12px}
    .wstat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
    .wstat b{font-size:20px;display:block}`;
  document.head.appendChild(css);

  const card=document.createElement('div'); card.className='card'; card.id='weightCard';
  card.innerHTML=`<h2><span>⚖️ Weight</span><span class="small" id="wLatest"></span></h2>
    <div class="row"><input id="wIn" type="text" inputmode="decimal" placeholder="Today's weight (lb)" style="flex:1" onkeydown="if(event.key==='Enter')WGT.save()">
      <input id="wDate" type="date" style="width:132px"><button onclick="WGT.save()">Log</button></div>
    <div class="seg" id="wSeg" style="margin-top:12px">${Object.keys(R).map(k=>`<button data-r="${k}" onclick="WGT.range('${k}')">${k}</button>`).join('')}</div>
    <svg id="wChart" viewBox="0 0 320 170" width="100%" style="margin-top:8px;overflow:visible"></svg>
    <div class="wstat" id="wStats"></div>
    <details style="margin-top:10px"><summary class="small mute">History (tap ✕ to delete)</summary><div class="list" id="wHist"></div></details>`;
  const host=$('v-health'), after=$('healthSummary');
  after?after.after(card):host.prepend(card);

  function chart(){
    const all=sorted(), end=today(), start=addDays(end,-R[range]+1), pts=all.filter(x=>x.date>=start&&x.date<=end);
    const svg=$('wChart'), W=320, H=170, L=34, Rr=8, T=10, B=24;
    if(!pts.length){ svg.innerHTML=`<text x="160" y="85" text-anchor="middle" fill="var(--mute)" font-size="12">No weigh-ins in this range yet</text>`; return pts; }
    const vals=pts.map(p=>p.lb); let lo=Math.min(...vals), hi=Math.max(...vals); const pad=Math.max(1,(hi-lo)*0.15); lo=Math.floor(lo-pad); hi=Math.ceil(hi+pad);
    const span=R[range]-1||1, X=d=>L+(daysBetween(start,d)/span)*(W-L-Rr), Y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
    let g='';
    for(let i=0;i<=3;i++){ const v=lo+(hi-lo)*i/3, y=Y(v); g+=`<line x1="${L}" x2="${W-Rr}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${L-5}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--mute)">${Math.round(v)}</text>`; }
    const fmtX=d=>new Date(d+'T12:00').toLocaleDateString(undefined,R[range]>200?{month:'short'}:{month:'short',day:'numeric'});
    [start,addDays(start,Math.round(span/2)),end].forEach((d,i)=>{ g+=`<text x="${X(d)}" y="${H-6}" text-anchor="${['start','middle','end'][i]}" font-size="10" fill="var(--mute)">${fmtX(d)}</text>`; });
    // 7-day rolling average
    if(pts.length>=3&&R[range]>=30){
      const avgPts=pts.map(p=>{ const w=all.filter(x=>x.date<=p.date&&x.date>addDays(p.date,-7)); return [X(p.date),Y(w.reduce((a,x)=>a+x.lb,0)/w.length)]; });
      g+=`<polyline fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" points="${avgPts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}"/>`;
    }
    g+=`<polyline fill="none" stroke="var(--sky)" stroke-width="${R[range]>=30?1.2:2}" stroke-opacity="${R[range]>=30?.6:1}" points="${pts.map(p=>X(p.date).toFixed(1)+','+Y(p.lb).toFixed(1)).join(' ')}"/>`;
    g+=pts.map(p=>`<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.lb).toFixed(1)}" r="${pts.length>60?1.8:3}" fill="${p.src==='scan'?'var(--f)':'var(--sky)'}"/>`).join('');
    if(R[range]>=30&&pts.length>=3) g+=`<text x="${W-Rr}" y="${T+2}" text-anchor="end" font-size="9" fill="var(--gold)">— 7-day avg</text>`;
    svg.innerHTML=g; return pts;
  }
  function stats(pts){
    const all=sorted(), last=all[all.length-1];
    $('wLatest').innerHTML=last?`${last.lb} lb · ${fmtDate(last.date)}`:'';
    if(pts.length<2){ $('wStats').innerHTML=`<div class="small mute" style="grid-column:1/-1">${pts.length?'Log a few more days to see your trend.':''}</div>`; return; }
    const ch=pts[pts.length-1].lb-pts[0].lb, days=Math.max(1,daysBetween(pts[0].date,pts[pts.length-1].date)), perWk=ch/days*7;
    const col=v=>Math.abs(v)<0.05?'var(--ink)':v<0?'var(--green)':'var(--f)';
    $('wStats').innerHTML=`<div><b style="color:${col(ch)}">${ch>0?'+':''}${ch.toFixed(1)}</b><span class="small mute">lb in ${range}</span></div>
      <div><b>${perWk>0?'+':''}${perWk.toFixed(1)}</b><span class="small mute">lb / week</span></div>
      <div><b>${Math.min(...pts.map(p=>p.lb))}–${Math.max(...pts.map(p=>p.lb))}</b><span class="small mute">low – high</span></div>`;
  }
  function hist(){
    const all=sorted().reverse().slice(0,30);
    $('wHist').innerHTML=all.length?all.map(w=>`<div class="row between small"><span>${fmtDate(w.date)} ${w.date.slice(0,4)}${w.src==='scan'?' · OTF scan':''}</span><b>${w.lb} lb</b><button class="sm ghost" onclick="WGT.del('${w.date}')">✕</button></div>`).join(''):'<div class="small mute">No entries yet.</div>';
  }
  function draw(){ if(!$('weightCard')) return; if(!$('wDate').value) $('wDate').value=today(); setSeg('wSeg','r',range); stats(chart()); hist(); }

  window.WGT={
    add(date,lb,quiet){ S.weights=S.weights.filter(x=>!(x.date===date&&x.src!=='scan')); S.weights.push({date,lb:Math.round(lb*10)/10});
      const last=sorted().pop(); if(last) S.settings.weight=last.lb; if(!quiet){ save(); draw(); } },
    save(){ const lb=num($('wIn').value), d=$('wDate').value||today();
      if(!(lb>=60&&lb<=500)) return toast('Enter your weight in pounds');
      WGT.add(d,lb); $('wIn').value=''; $('wIn').blur(); toast(`⚖️ ${lb} lb logged`); render(); },
    del(date){ if(!confirm('Delete weight for '+fmtDate(date)+'?')) return; S.weights=S.weights.filter(x=>x.date!==date); save(); draw(); },
    range(r){ range=r; draw(); }, draw
  };

  /* redraw with the Health tab */
  const _rh=window.renderHealth; window.renderHealth=function(){ _rh.apply(this,arguments); draw(); };

  /* coach: weight trend vs. load/cut phase */
  if(typeof window.getInsights==='function'){
    const _gi=window.getInsights;
    window.getInsights=function(){
      const I=_gi.apply(this,arguments), all=sorted().filter(x=>x.date>addDays(today(),-29));
      if(all.length>=4){
        const ch=all[all.length-1].lb-all[0].lb, days=Math.max(7,daysBetween(all[0].date,all[all.length-1].date)), wk=ch/days*7, pct=wk/all[all.length-1].lb*100, ph=S.plan&&S.plan.phase;
        const add=(pri,title,why,action)=>I.push({cat:'Body',pri,title,why,action});
        if(ph==='cut'&&pct<-1) add(1,`Losing fast: ${wk.toFixed(1)} lb/week`,'More than ~1% of bodyweight per week in a cut risks losing muscle and power for Hyrox.','Ease the deficit by ~100–150 kcal and keep protein at target.');
        else if(ph==='cut'&&wk>-0.2) add(2,`Weight is flat in a cut (${wk>0?'+':''}${wk.toFixed(1)} lb/week)`,'Water swings can hide progress for 1–2 weeks, so judge the 7-day average.','If it stays flat another week, check logging accuracy before cutting calories further.');
        else if(ph==='build'&&pct>0.5) add(2,`Gaining quickly: +${wk.toFixed(1)} lb/week`,'In a load phase, about 0.25–0.5% per week keeps gains mostly lean.','Hold calories for a week instead of stepping up.');
        else add(3,`Weight trend: ${wk>0?'+':''}${wk.toFixed(1)} lb/week`,`Over the last ${days} days, in line with your ${ph==='build'?'load':ph==='cut'?'cut':'hold'} phase.`,'Keep weighing in the morning, after the bathroom, before eating.');
      } else if(!S.weights.some(x=>x.date>addDays(today(),-7)))
        I.push({cat:'Habits',pri:3,title:'Log your morning weight',why:'A few weigh-ins a week let the coach check your load and cut weeks against real trends.',action:'Health → ⚖️ Weight, or "Hey Siri, log my weight."'});
      return I.sort((a,b)=>a.pri-b.pri);
    };
  }
  draw();
})();
