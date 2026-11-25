/* Summit Coach — reads sleep, training, nutrition, body comp, BP and labs, then makes recommendations.
   Each insight: {cat, pri (1 = act now, 2 = worth doing, 3 = nice work), title, why, action} */

const CAT_ICON = {Recovery:'🌙',Training:'🏃',Race:'🏁',Nutrition:'🍽',Body:'💪','Heart':'🩺',Labs:'🧪',Habits:'⛰'};

/* General context for common markers. Flags come from the lab's own range; this adds the "so what" for an athlete. */
const LAB_GUIDE = [
  {re:/\bldl\b/i, hi:'High LDL: favor fiber (oats, beans, berries), swap saturated fats for olive oil, nuts and fish, and keep cardio consistent.'},
  {re:/\bhdl\b/i, lo:'Low HDL: regular aerobic work (runs, OTF base/push), cutting refined carbs, and healthy fats tend to help raise it.'},
  {re:/triglycer/i, hi:'High triglycerides: usually most responsive to cutting added sugar, refined carbs and alcohol, plus regular cardio.'},
  {re:/^(total\s*)?cholesterol/i, hi:'High total cholesterol: look at LDL and HDL together. Fiber, unsaturated fats and consistent training help.'},
  {re:/a1c|hemoglobin a1c|hba1c/i, hi:'Elevated A1C means average blood sugar has been running high over ~3 months. Pairing carbs with protein, putting most carbs around workouts, and steady training all help.'},
  {re:/glucose/i, hi:'High fasting glucose: confirm you were truly fasted. If repeated, discuss with your doctor; timing carbs around training helps.'},
  {re:/vitamin\s*d|25-?oh/i, lo:'Low vitamin D can affect muscle function, bone health and immunity. Supplementation is common, but ask your doctor about dosing.'},
  {re:/ferritin/i, lo:'Low ferritin (iron stores) is common in endurance athletes and can cause fatigue and slower running. Discuss with your doctor before supplementing iron.'},
  {re:/^iron\b|serum iron/i, lo:'Low iron can reduce oxygen delivery and endurance. Red meat, lentils and spinach (with vitamin C) help absorption.'},
  {re:/hemoglobin(?!\s*a1c)|^hgb/i, lo:'Low hemoglobin reduces oxygen-carrying capacity, so you may notice heavier legs and higher HR at easy paces.'},
  {re:/hematocrit|^hct/i, lo:'Low hematocrit often travels with low hemoglobin or iron. Worth discussing if you feel unusually fatigued.'},
  {re:/\btsh\b/i, hi:'High TSH can mean an underactive thyroid, which can cause low energy and slow recovery.', lo:'Low TSH can mean an overactive thyroid and a high resting HR. Discuss with your doctor.'},
  {re:/\b(alt|sgpt)\b/i, hi:'ALT can rise after very hard training. If you trained hard in the 48 hours before the draw, ask about a retest after 2–3 easy days.'},
  {re:/\b(ast|sgot)\b/i, hi:'AST is also released by muscle, so hard OTF or race efforts can push it up temporarily. A retest after easy days helps clarify.'},
  {re:/\bck\b|creatine kinase|\bcpk\b/i, hi:'High CK usually reflects recent muscle damage from hard training. Hydrate and go easy, and retest if very high.'},
  {re:/creatinine/i, hi:'Creatinine runs higher with more muscle mass, dehydration or creatine supplements. Mention these to your doctor.'},
  {re:/egfr/i, lo:'Low eGFR can be affected by muscle mass and hydration. Your doctor will interpret it alongside creatinine.'},
  {re:/testosterone/i, lo:'Low testosterone can come with under-fueling, poor sleep and high training stress. Check sleep and calorie trends here first.'},
  {re:/\bb12\b|cobalamin/i, lo:'Low B12 can cause fatigue. Ask your doctor about supplementing.'},
  {re:/sodium/i, lo:'Low sodium matters for long races. Use electrolytes, not just water, on long efforts.'},
  {re:/potassium/i, hi:'Abnormal potassium should be reviewed by your doctor.', lo:'Abnormal potassium should be reviewed by your doctor.'},
  {re:/crp|c-reactive/i, hi:'Elevated CRP is an inflammation marker. Hard training, illness or poor sleep can raise it.'},
];

function readiness(){
  const g=S.settings.sleepGoal, last=S.sleep.find(x=>x.date===today())||S.sleep.find(x=>x.date===addDays(today(),-1));
  const s=loadSeries(42), tsb=(s[s.length-1]||{tsb:0}).tsb;
  let score=0, parts=0;
  if(last){ score+=Math.min(1,last.hrs/g)*40 + (last.rest/10)*30; parts+=70; }
  const formPts=Math.max(0,Math.min(30,15+tsb*0.6)); score+=formPts; parts+=30;
  const v=Math.round(score/parts*100);
  return {v, hasSleep:!!last, label:v>=80?'Ready to push':v>=60?'Train as planned':v>=40?'Go moderate':'Recovery day', color:v>=80?'var(--green)':v>=60?'var(--gold)':v>=40?'#f08a24':'var(--red)'};
}

function getInsights(){
  const I=[], add=(cat,pri,title,why,action)=>I.push({cat,pri,title,why,action});
  const st=S.settings, g=st.sleepGoal, T=targets(), left=daysToRace(), race=nextRace();
  const series=loadSeries(42), L=series[series.length-1]||{ctl:0,atl:0,tsb:0}, L7=series[series.length-8]||L;
  const wk=lastN(7), wk4=lastN(28), otf=wk.filter(a=>a.otf), runMi=wk.filter(isRun).reduce((a,x)=>a+x.dist*M2MI,0);
  const run4=wk4.filter(isRun).reduce((a,x)=>a+x.dist*M2MI,0)/4;

  /* ---- SLEEP / RECOVERY ---- */
  const s7=sleepWindow(7), s30=sleepWindow(30);
  if(s7.length>=3){
    const ah=avg(s7.map(x=>x.hrs)), ar=avg(s7.map(x=>x.rest)), debt=s7.reduce((a,x)=>a+Math.max(0,g-x.hrs),0);
    if(ah<g-1) add('Recovery',1,`Averaging ${ah.toFixed(1)} h of sleep`,`That's ${(g-ah).toFixed(1)} h under your ${g} h goal, about ${debt.toFixed(0)} h of debt this week. Short sleep raises perceived effort and slows recovery from OTF and running.`,'Move bedtime 30 min earlier for the next 4 nights before adding any training.');
    else if(ah>=g) add('Recovery',3,`Sleep is on point (${ah.toFixed(1)} h avg)`,'Hitting your sleep goal is the cheapest performance boost there is.','Keep the routine, especially in the 3 nights before race day.');
    if(ar<5) add('Recovery',ah>=g-.5?1:2,`Restfulness is low (${ar.toFixed(1)}/10)`,ah>=g-.5?"You're getting enough hours, but they aren't restoring you, so quality is the issue.":'Short and poor-quality sleep together stack up.','Try: no caffeine after 1 pm, a cool dark room, screens off 30 min before bed, and no hard workouts within 3 h of bed. If you often wake unrefreshed or snore, mention it to your doctor.');
    // late workouts vs restfulness
    const pairs=s30.map(n=>{ const a=S.activities.filter(x=>x.date===addDays(n.date,-1)); return a.length?{late:a.some(x=>x.hour>=19),rest:n.rest}:null; }).filter(Boolean);
    const late=pairs.filter(p=>p.late), early=pairs.filter(p=>!p.late);
    if(late.length>=3&&early.length>=3&&avg(early.map(p=>p.rest))-avg(late.map(p=>p.rest))>=1.5)
      add('Recovery',2,'Evening workouts are costing you sleep quality',`Restfulness averages ${avg(late.map(p=>p.rest)).toFixed(1)} after workouts starting at 7 pm or later, vs ${avg(early.map(p=>p.rest)).toFixed(1)} after earlier ones.`,'Book OTF in the morning or at lunch when you can.');
    // sleep vs OTF output
    const sp=S.activities.filter(a=>a.otf&&splats(a)!=null).map(a=>({s:splats(a),n:S.sleep.find(x=>x.date===a.date)})).filter(x=>x.n);
    if(sp.length>=6){ const good=sp.filter(x=>x.n.hrs>=g-.5), bad=sp.filter(x=>x.n.hrs<g-.5);
      if(good.length>=3&&bad.length>=3&&avg(good.map(x=>x.s))-avg(bad.map(x=>x.s))>=3)
        add('Recovery',2,'Your splats track your sleep',`You average ${r0(avg(good.map(x=>x.s)))} splats after a full night vs ${r0(avg(bad.map(x=>x.s)))} after short sleep.`,"After a short night, aim for a smart 12-splat class instead of chasing a big number."); }
  } else add('Habits',2,'Start logging sleep','The coach needs at least 3 nights to judge recovery, and pairing sleep with your workouts unlocks the most useful insights.','Tap 🌙 Log each morning. It takes 5 seconds.');

  /* ---- TRAINING ---- */
  const ramp=L.ctl-L7.ctl;
  if(L.tsb<-25) add('Training',1,`Fatigue is high (form ${r0(L.tsb)})`,'Your last 7 days are well above what your body is used to, which raises illness and injury risk.','Take 1–2 easy days: a walk, mobility, or an OTF class kept mostly green.');
  else if(L.tsb<-10) add('Training',2,`Productive fatigue (form ${r0(L.tsb)})`,'This is the zone where fitness is built, as long as sleep and fuel keep up.','Hold this load. Make sure today has full carbs and protein.');
  else if(L.tsb>15&&left>10) add('Training',2,`You're fresh (form +${r0(L.tsb)})`,'Low recent load. A good window for a hard session.','Make your next OTF an all-out day or do a tempo run.');
  if(ramp>8) add('Training',1,'Load is ramping fast',`Fitness rose ${ramp.toFixed(1)} points in a week. Jumps above ~5–8 per week are when overuse injuries show up.`,'Keep next week at the same volume rather than adding more.');
  const lastRest=(()=>{ for(let i=0;i<14;i++){ if(!S.activities.some(a=>a.date===addDays(today(),-i))) return i; } return 14; })();
  if(S.activities.length&&lastRest>=9) add('Training',1,`${lastRest} days without a rest day`,'Adaptation happens during recovery, not during the workout.','Schedule a full rest day or a short easy walk in the next 48 h.');
  if(otf.length){ const zt=otf.filter(a=>a.zones).map(a=>a.zones), red=zt.reduce((s,z)=>s+z[4],0), tot=zt.reduce((s,z)=>s+z.reduce((x,y)=>x+y,0),0);
    if(tot&&red/tot>0.2) add('Training',2,'A lot of red zone this week',`${r0(red/tot*100)}% of your OTF time was all-out red. Splats come from orange too, and too much red slows recovery.`,'Aim for orange on push intervals and save red for all-outs.'); }
  if(S.activities.length&&wk4.length<6) add('Training',2,'Consistency dipped',`${wk4.length} workouts in the last 4 weeks.`,'Lock in 3 OTF days on your calendar. Showing up beats any single big workout.');

  /* ---- RACE ---- */
  if(race){ const hy=/hyrox/.test(race.type);
    if(hy&&left>14&&S.activities.length){
      if(run4<8) add('Race',1,`Running volume is low for Hyrox (${run4.toFixed(1)} mi/wk avg)`,'Hyrox is 8 × 1 km of running, which is about half your race time, and every km comes after a station.','Build to 12–15 mi/week by adding about 1–2 mi per week: one easy run plus one compromised run (1 km run → burpees/lunges → repeat).');
      else add('Race',3,`Run base is building (${run4.toFixed(1)} mi/wk)`,"You're carrying solid running into Hyrox prep.",'Add race-specific work: run 1 km, then 20 wall balls or 25 m of lunges, ×4–6.');
    }
    if(left<=14&&left>=0) add('Race',1,`${left} days out: taper time`,'Fitness is built. Now the goal is to arrive fresh.','Cut volume ~40%, keep a little intensity, push sleep to ' + (g+0.5) + ' h, and practice race-morning breakfast.');
    if(left<=21&&S.plan.phase==='cut') add('Race',1,"You're in a cut close to race day",'Racing in a deficit costs power and grip strength, especially on stations like sled push and wall balls.','Switch to Hold or Load now so you finish this block fueled.');
    if(!race.goal) add('Race',2,'No goal time set for '+race.name,'A target turns the prediction into pacing.','Open Race → Set a goal time. The coach will tell you if it is realistic.');
  }

  /* ---- NUTRITION ---- */
  const logged=[...Array(7)].map((_,i)=>addDays(today(),-i-1)).filter(d=>(S.food[d]||[]).length);
  if(logged.length>=3){
    const tt=logged.map(totals), ak=avg(tt.map(x=>x.k)), ap=avg(tt.map(x=>x.p)), afi=avg(tt.map(x=>x.fi)), ana=avg(tt.map(x=>x.na));
    if(ap<T.p*0.85) add('Nutrition',1,`Protein is short (${r0(ap)} g vs ${r0(T.p)} g)`,'Low protein during OTF strength blocks limits muscle repair and makes holding muscle in a cut harder.',`Add ~${r0(T.p-ap)} g/day. Easy wins: Greek yogurt (20 g), a protein shake (25 g), or an extra 4 oz of chicken (35 g). Aim for 30–40 g per meal.`);
    else add('Nutrition',3,`Protein dialed in (${r0(ap)} g avg)`,'You are hitting your target consistently.','Keep spreading it over 3–4 meals.');
    const dev=(ak-T.k)/T.k;
    if(Math.abs(dev)>0.12) add('Nutrition',2,`Calories are ${dev>0?'over':'under'} target by ${r0(Math.abs(ak-T.k))}/day`,`Your ${S.plan.phase==='build'?'load':S.plan.phase==='cut'?'cut':'hold'} phase only works if intake tracks the target.`,dev>0?'Check your snacks and drinks first. They are the usual source of extra calories.':'Under-eating during training hurts recovery. Add a carb + protein snack after workouts.');
    if(afi&&afi<25) add('Nutrition',2,`Fiber is low (${r0(afi)} g/day)`,'Fiber supports gut health, cholesterol and fullness, especially useful during cut weeks.','Target 30 g or more: berries, oats, beans, and vegetables at 2 meals.');
    if(ana>3000&&S.bp.length&&bpCat(S.bp[S.bp.length-1].sys,S.bp[S.bp.length-1].dia)[0]!=='Normal') add('Nutrition',2,`High sodium (${r0(ana)} mg) with elevated BP`,'Sodium and blood pressure are linked for many people.','Watch packaged and restaurant foods. Your sweat losses mean you do not need to go ultra-low.');
    // fueling hard days
    const hard=wk.filter(a=>trimp(a)>90).map(a=>a.date), hardDays=hard.filter(d=>(S.food[d]||[]).length);
    if(hardDays.length>=2){ const hc=avg(hardDays.map(d=>totals(d).c)); if(hc<T.c*0.85) add('Nutrition',2,'Under-fueling your hard days',`Carbs averaged ${r0(hc)} g on hard training days vs a ${r0(T.c)} g target.`,'Shift carbs to the meal before and after OTF or long runs. Rest days can run lighter.'); }
  } else add('Habits',2,'Log at least 3 days of food','The nutrition coach needs a few days of data to spot patterns.','Use barcode, label scan, or "Copy yesterday" to make it quick.');
  const bc=S.bodycomp[S.bodycomp.length-1];
  if(bc&&bc.bmr&&curKcal()<bc.bmr*0.85) add('Nutrition',1,`Calorie target is well below your measured BMR`,`${curKcal()} kcal vs a measured BMR of ${r0(bc.bmr)}, before counting any training. Short cuts are fine, but long stretches here can cost muscle and performance.`,'Keep cut phases short (2–4 weeks) and protein high, and step back up afterward.');

  /* ---- BODY COMP ---- */
  if(bc){ const prev=S.bodycomp[S.bodycomp.length-2], age=daysBetween(bc.date,today());
    if(age>42) add('Body',2,`Last body scan was ${age} days ago`,'Scans every 4–6 weeks show whether your load and cut cycles are moving muscle and fat the right way.','Grab a scan at your next OTF class.');
    if(prev){ const dm=bc.smm-prev.smm, df=bc.bfm-prev.bfm;
      if(dm<-1) add('Body',1,`Lost ${Math.abs(dm).toFixed(1)} lb of muscle since last scan`,'Muscle loss usually comes from too big a deficit, low protein or poor sleep.','Raise protein to ~1 g/lb, keep the deficit modest, and prioritize sleep.');
      else if(dm>0.5&&df<=0) add('Body',3,`Recomp win: +${dm.toFixed(1)} lb muscle, ${df.toFixed(1)} lb fat`,'This is the ideal direction.','Keep doing exactly this.');
      else if(df>1.5) add('Body',2,`Fat mass up ${df.toFixed(1)} lb`,S.plan.phase==='build'?"Some gain is expected in a load phase. Check that muscle is rising with it.":'Intake may be running above need.','Compare logged calories to target over the last 4 weeks.'); }
    if(bc.seg&&bc.seg.ll&&bc.seg.rl){ const d=Math.abs(bc.seg.ll-bc.seg.rl)/Math.max(bc.seg.ll,bc.seg.rl), da=Math.abs(bc.seg.la-bc.seg.ra)/Math.max(bc.seg.la,bc.seg.ra);
      if(d>0.05||da>0.05) add('Body',2,'Left/right muscle imbalance','Your segmental scan shows more than a 5% difference between sides.','Add single-arm and single-leg work (split squats, single-arm rows) on the weaker side.');
      else add('Body',3,'Left/right muscle balance looks great','Arms and legs are within 1% side to side, which is good for injury resilience in lunges and carries.','Nothing to change.'); }
  }

  /* ---- HEART / BP ---- */
  if(S.bp.length){ const r3=S.bp.slice(-3), as=avg(r3.map(x=>x.sys)), ad=avg(r3.map(x=>x.dia)), [c]=bpCat(as,ad);
    if(c==='Stage 2') add('Heart',1,`Blood pressure averaging ${r0(as)}/${r0(ad)}`,'This is in the stage 2 range.','Share these readings with your doctor soon.');
    else if(c==='Stage 1') add('Heart',1,`Blood pressure averaging ${r0(as)}/${r0(ad)} (stage 1 range)`,'Exercise, sleep, sodium, alcohol and weight all influence BP.','Measure seated after 5 min of rest, at the same time of day, and bring the trend to your next visit.');
    else if(c==='Elevated') add('Heart',2,`BP slightly elevated (${r0(as)}/${r0(ad)})`,'Not alarming, but worth watching.','Keep cardio consistent and watch sodium, alcohol and sleep.');
    else add('Heart',3,`BP is normal (${r0(as)}/${r0(ad)})`,'Training is paying off here.','Keep logging monthly.');
  }

  /* ---- LABS ---- */
  const latest={}; S.labs.forEach(r=>{ const k=r.name.toLowerCase(); if(!latest[k]||r.date>=latest[k].date) latest[k]=r; });
  Object.values(latest).forEach(r=>{ const o=outOfRange(r); if(!o) return; const g=LAB_GUIDE.find(x=>x.re.test(r.name));
    const hardBefore=S.activities.some(a=>a.date>=addDays(r.date,-2)&&a.date<=r.date&&trimp(a)>80);
    add('Labs',1,`${r.name} is ${o} (${r.value} ${r.unit})`,(g&&g[o==='high'?'hi':'lo'])||`Outside the lab's reference range (${r.range}).`+(hardBefore&&/ast|alt|ck|creat/i.test(r.name)?' Note: you had a hard workout within 2 days before this draw.':''),'Review with your doctor. This app flags results but does not diagnose.'); });
  const inRange=Object.values(latest).filter(r=>r.range&&!outOfRange(r)).length;
  if(inRange) add('Labs',3,`${inRange} lab marker${inRange>1?'s':''} in range`,'Good foundation.','Retest as your doctor recommends.');
  if(!S.labs.length) add('Habits',2,'Add your latest blood work','Lipids, A1C, iron and vitamin D all tie directly to endurance and recovery.','Health → + Labs. You can paste text from your patient portal or snap a photo.');

  return I.sort((a,b)=>a.pri-b.pri);
}

function insightsHTML(list){
  return list.map(i=>`<div class="ins p${i.pri}"><b>${CAT_ICON[i.cat]||''} ${esc(i.title)}</b><div class="small mute">${esc(i.why)}</div><div class="small" style="color:var(--gold)">→ ${esc(i.action)}</div></div>`).join('');
}

function renderCoachCard(){
  const R=readiness(), I=getInsights(), top=I.filter(i=>i.pri<3).slice(0,3), win=I.find(i=>i.pri===3);
  $('tipToday').innerHTML=`<div class="row" style="margin-bottom:6px"><div class="score" style="border-color:${R.color};color:${R.color}">${R.v}</div>
    <div><b>${R.label}</b><div class="small mute">Readiness from ${R.hasSleep?'last night\'s sleep + ':''}training form${R.hasSleep?'':' (log sleep for a better read)'}</div></div></div>
    ${insightsHTML(top)}${win?insightsHTML([win]):''}`;
}

function openReport(){
  const I=getInsights(), R=readiness(), cats=['Recovery','Training','Race','Nutrition','Body','Heart','Labs','Habits'];
  const n1=I.filter(i=>i.pri===1).length;
  $('reportBody').innerHTML=`<div class="card" style="margin-top:12px"><div class="row"><div class="score" style="border-color:${R.color};color:${R.color}">${R.v}</div>
    <div><b>${R.label}</b><div class="small mute">${n1} priority item${n1===1?'':'s'} · ${I.filter(i=>i.pri===3).length} win${I.filter(i=>i.pri===3).length===1?'':'s'}</div></div></div></div>`
   + cats.map(c=>{ const l=I.filter(i=>i.cat===c); return l.length?`<div class="cat">${CAT_ICON[c]} ${c}</div>${insightsHTML(l)}`:''; }).join('')
   + `<div class="small mute" style="margin-top:18px">Red = act now · gold = worth doing · green = nice work. Summit gives general fitness guidance and flags lab and BP values against standard ranges. It is not medical advice, so bring anything flagged to your doctor.</div>`;
  openSheet('reportSheet');
}
