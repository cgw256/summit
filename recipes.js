/* Summit add-on: Recipes · ✕ clear button on food search · stay on the Log screen after adding food.
   Load after boot():  <script src="recipes.js"></script>  */
(function(){
  if(window.RCP) return;
  const err=m=>(window.showErr?showErr(m):toast(m));
  const num=v=>{ const x=parseFloat(String(v??'').replace(',','.')); return isFinite(x)?x:0; };
  const r1=v=>Math.round((v||0)*10)/10;
  S.recipes=S.recipes||[];

  /* ---------- styles ---------- */
  const css=document.createElement('style'); css.textContent=`
    .qwrap{position:relative;flex:1;min-width:0}
    .qwrap input{padding-right:42px}
    .qclear{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;padding:0;
      background:rgba(255,255,255,.16);color:var(--ink);font-size:15px;line-height:30px;font-weight:700;display:none}
    body.light .qclear{background:rgba(0,0,0,.1)}
    .qclear.on{display:block}
    .ing{display:grid;grid-template-columns:1fr 70px 34px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
    .ing:last-child{border:0}
    .rhead{display:flex;justify-content:space-between;align-items:center;margin:14px 0 4px}`;
  document.head.appendChild(css);

  /* ---------- ✕ clear button for any search box ---------- */
  function addClear(id,onClear){
    const q=$(id); if(!q||q.parentNode.classList.contains('qwrap')) return;
    const w=document.createElement('div'); w.className='qwrap'; q.parentNode.insertBefore(w,q); w.appendChild(q);
    const b=document.createElement('button'); b.type='button'; b.className='qclear'; b.textContent='✕'; b.setAttribute('aria-label','Clear'); w.appendChild(b);
    const sync=()=>b.classList.toggle('on',!!q.value);
    q.addEventListener('input',sync);
    b.addEventListener('click',e=>{ e.preventDefault(); q.value=''; sync(); if(onClear) onClear(); q.focus(); });
    q.setAttribute('autocomplete','off'); q.setAttribute('autocorrect','off'); q.setAttribute('enterkeyhint','search');
  }
  addClear('q',()=>{ $('results').innerHTML=''; });

  /* ---------- after logging anything, stay on the Log screen ---------- */
  const _logFood=window.logFood;
  window.logFood=function(f,q){
    _logFood(f,q);
    setTimeout(()=>{ if(!$('foodSheet').classList.contains('on')){ openSheet('foodSheet'); if(window.setSeg) setSeg('mealSeg','m',meal); }
      if(window.renderRecent) renderRecent(); renderList(); },0);
  };

  /* ---------- recipe list inside the Log sheet ---------- */
  const favH=[...$('foodSheet').querySelectorAll('h4')].find(h=>/Favorites/i.test(h.textContent));
  const box=document.createElement('div');
  box.innerHTML=`<div class="rhead"><h4 class="mute" style="margin:0">🍲 My recipes</h4><button type="button" class="sm" onclick="RCP.edit()">+ New recipe</button></div><div class="list" id="recipeList"></div>`;
  favH?favH.parentNode.insertBefore(box,favH):$('foodSheet').firstElementChild.appendChild(box);

  function perServing(r){
    const s=Math.max(0.25,num(r.servings)||1), t={k:0,p:0,c:0,f:0,fi:0,na:0};
    (r.items||[]).forEach(i=>{ const q=num(i.q); ['k','p','c','f','fi','na'].forEach(x=>t[x]+=num(i[x])*q); });
    return Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v/s]));
  }
  function asFood(r){ const p=perServing(r);
    return {name:'🍲 '+r.name,k:r1(p.k),p:r1(p.p),c:r1(p.c),f:r1(p.f),fi:r1(p.fi),na:Math.round(p.na),serv:`1 serving (recipe makes ${r.servings})`,recipe:r.id}; }
  function renderList(){
    const el=$('recipeList'); if(!el) return;
    const L=(S.recipes||[]).slice().sort((a,b)=>(b.used||0)-(a.used||0)||a.name.localeCompare(b.name));
    el.innerHTML=L.length?L.map(r=>{ const p=perServing(r);
      return `<div class="row between"><span style="flex:1" onclick="RCP.log('${r.id}')"><b>${esc(r.name)}</b><br>
        <span class="small mute">${r0(p.k)} kcal · P${r0(p.p)} C${r0(p.c)} F${r0(p.f)} per serving · makes ${r.servings}</span></span>
        <button type="button" class="sm ghost" onclick="RCP.edit('${r.id}')">✎</button><button type="button" class="sm" onclick="RCP.quick('${r.id}')">+</button></div>`; }).join('')
      :'<div class="small mute">Save meals you cook often, then log them in one tap.</div>';
  }

  /* ---------- recipe editor sheet ---------- */
  const sh=document.createElement('div'); sh.className='sheet'; sh.id='recipeSheet';
  sh.addEventListener('click',e=>{ if(e.target===sh) RCP.close(); });
  sh.innerHTML=`<div>
    <div class="row between"><h3 style="margin:0" id="rc_title">New recipe</h3><button type="button" class="sm ghost" onclick="RCP.close()">Cancel</button></div>
    <label>Recipe name</label><input id="rc_name" placeholder="e.g. Turkey chili">
    <div class="grid2"><div><label>Servings it makes</label><input id="rc_serv" type="text" inputmode="decimal" value="4" oninput="RCP.sum()"></div><div></div></div>
    <div class="card" style="margin-top:12px;padding:12px" id="rc_sum"></div>
    <h4 class="mute" style="margin:14px 0 4px">Ingredients <span class="small">(amount = number of servings shown under each item)</span></h4>
    <div id="rc_ings"></div>
    <h4 class="mute" style="margin:16px 0 4px">Add ingredient</h4>
    <div class="row"><input id="rc_q" placeholder="Search foods" onkeydown="if(event.key==='Enter')RCP.search()"><button type="button" class="sm" onclick="RCP.search()">Go</button></div>
    <div class="list" id="rc_res"></div>
    <button type="button" class="ghost" style="width:100%;margin-top:8px" onclick="RCP.scan()">▦ Scan ingredient barcode</button>
    <div id="rc_reader" style="margin-top:8px;border-radius:14px;overflow:hidden"></div>
    <details style="margin-top:10px"><summary class="small mute">From my foods & recent</summary><div class="list" id="rc_mine"></div></details>
    <details style="margin-top:10px"><summary class="small mute">Add manually</summary>
      <input id="rc_mn" placeholder="Ingredient name" style="margin-top:8px">
      <div class="grid2" style="margin-top:6px"><input id="rc_mk" inputmode="decimal" placeholder="kcal"><input id="rc_mp" inputmode="decimal" placeholder="Protein g"><input id="rc_mc" inputmode="decimal" placeholder="Carbs g"><input id="rc_mf" inputmode="decimal" placeholder="Fat g"></div>
      <input id="rc_ms" placeholder="Serving (e.g. 1 cup, 4 oz)" style="margin-top:6px">
      <button type="button" class="ghost" style="width:100%;margin-top:6px" onclick="RCP.manual()">Add ingredient</button></details>
    <div class="row" style="margin-top:16px"><button type="button" class="danger" id="rc_del" style="display:none" onclick="RCP.del()">Delete</button><button type="button" style="flex:1" onclick="RCP.save()">Save recipe</button></div>
  </div>`;
  document.body.appendChild(sh);
  addClear('rc_q',()=>{ $('rc_res').innerHTML=''; });

  let draft=null, scanner=null, found=[];
  const ingFrom=f=>({name:f.name,k:num(f.k),p:num(f.p),c:num(f.c),f:num(f.f),fi:num(f.fi),na:num(f.na),serv:f.serv||'1 serving',q:1});

  function renderIngs(){
    $('rc_ings').innerHTML=draft.items.length?draft.items.map((i,n)=>`<div class="ing"><div><b>${esc(i.name)}</b><div class="small mute">${esc(i.serv)} · ${r0(i.k)} kcal</div></div>
      <input type="text" inputmode="decimal" value="${i.q}" style="padding:6px;text-align:center" oninput="RCP.qty(${n},this.value)">
      <button type="button" class="sm ghost" onclick="RCP.rm(${n})">✕</button></div>`).join('')
      :'<div class="small mute">No ingredients yet — search, scan, or add manually below.</div>';
    sum();
  }
  function sum(){
    if(!draft) return; draft.servings=num($('rc_serv').value)||1;
    const p=perServing(draft), tot=draft.items.reduce((a,i)=>a+i.k*num(i.q),0);
    $('rc_sum').innerHTML=`<div class="small mute">Per serving (whole recipe ${r0(tot)} kcal)</div>
      <div class="grid3" style="grid-template-columns:repeat(4,1fr);margin-top:6px">
      <div><b style="font-size:20px">${r0(p.k)}</b><div class="small mute">kcal</div></div><div><b style="font-size:20px;color:var(--p)">${r0(p.p)}</b><div class="small mute">protein</div></div>
      <div><b style="font-size:20px;color:var(--c)">${r0(p.c)}</b><div class="small mute">carbs</div></div><div><b style="font-size:20px;color:var(--f)">${r0(p.f)}</b><div class="small mute">fat</div></div></div>`;
  }
  function renderMine(){
    const seen=new Set(), L=[];
    [...(S.myFoods||[]),...(S.favorites||[]),...(S.recentFoods||[])].forEach(f=>{ if(f&&!f.recipe&&!seen.has(f.name)){ seen.add(f.name); L.push(f); } });
    window._rcMine=L.slice(0,40);
    $('rc_mine').innerHTML=_rcMine.length?_rcMine.map((f,i)=>`<div class="row between" onclick="RCP.add(_rcMine[${i}])"><span><b>${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · ${esc(f.serv||'1 serving')}</span></span><span>＋</span></div>`).join('')
      :'<div class="small mute">Nothing yet.</div>';
  }
  function stopScan(){ if(scanner){ const s=scanner; scanner=null; s.stop().catch(()=>{}).finally(()=>{ try{s.clear()}catch(e){} }); } }

  window.RCP={
    sum,
    edit(id){
      const r=(S.recipes||[]).find(x=>x.id===id);
      draft=r?JSON.parse(JSON.stringify(r)):{id:'rcp'+Date.now(),name:'',servings:4,items:[]};
      $('rc_title').textContent=r?'Edit recipe':'New recipe'; $('rc_name').value=draft.name; $('rc_serv').value=draft.servings;
      $('rc_q').value=''; $('rc_q').dispatchEvent(new Event('input')); $('rc_res').innerHTML=''; $('rc_del').style.display=r?'block':'none';
      renderIngs(); renderMine(); openSheet('recipeSheet'); sh.firstElementChild.scrollTop=0;
    },
    close(){ stopScan(); closeSheet('recipeSheet'); draft=null; },
    add(f){ draft.items.push(ingFrom(f)); renderIngs(); toast('Added '+f.name+' — set the amount'); },
    qty(n,v){ draft.items[n].q=num(v); sum(); },
    rm(n){ draft.items.splice(n,1); renderIngs(); },
    async search(){
      const q=$('rc_q').value.trim(); if(!q) return; $('rc_res').innerHTML='<div class="small mute">Searching…</div>';
      found=(S.myFoods||[]).filter(f=>f.name.toLowerCase().includes(q.toLowerCase()));
      try{ const j=await (await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20&fields=product_name,brands,nutriments,serving_size,code&search_terms='+encodeURIComponent(q))).json();
        found=found.concat((j.products||[]).filter(p=>p.product_name).map(offToFood)); }catch(e){}
      $('rc_res').innerHTML=found.length?found.map((f,i)=>`<div class="row between" onclick="RCP.addFound(${i})"><span><b>${esc(f.name)}</b><br><span class="small mute">${r0(f.k)} kcal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)} per ${esc(f.serv)}</span></span><span>＋</span></div>`).join('')
        :'<div class="small mute">No matches — use Add manually.</div>';
    },
    addFound(i){ RCP.add(found[i]); },
    manual(){
      const f={name:$('rc_mn').value.trim(),k:$('rc_mk').value,p:$('rc_mp').value,c:$('rc_mc').value,f:$('rc_mf').value,serv:$('rc_ms').value.trim()||'1 serving'};
      if(!f.name) return toast('Enter an ingredient name');
      RCP.add(f); ['rc_mn','rc_mk','rc_mp','rc_mc','rc_mf','rc_ms'].forEach(x=>$(x).value='');
    },
    async scan(){
      if(!window.Html5Qrcode) return err('Scanner needs internet the first time');
      stopScan(); const F=Html5QrcodeSupportedFormats;
      scanner=new Html5Qrcode('rc_reader',{formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E]});
      try{ await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:120}},async code=>{
          stopScan(); const mine=(S.myFoods||[]).find(f=>f.code===code); if(mine) return RCP.add(mine);
          try{ const j=await (await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size,code`)).json();
            if(j.status===1&&j.product) return RCP.add(offToFood(j.product)); }catch(e){}
          toast('Not in the database — use Add manually'); }); }
      catch(e){ err('Camera unavailable — allow camera access'); }
    },
    save(){
      draft.name=$('rc_name').value.trim(); draft.servings=num($('rc_serv').value)||1;
      if(!draft.name) return toast('Give the recipe a name');
      if(!draft.items.length) return toast('Add at least one ingredient');
      draft.items=draft.items.filter(i=>num(i.q)>0);
      const i=S.recipes.findIndex(x=>x.id===draft.id); i>=0?S.recipes[i]=draft:S.recipes.push(draft);
      save(); const nm=draft.name; RCP.close(); renderList(); toast('Saved recipe: '+nm);
    },
    del(){ if(!confirm('Delete this recipe?')) return; S.recipes=S.recipes.filter(x=>x.id!==draft.id); save(); RCP.close(); renderList(); toast('Recipe deleted'); },
    log(id){ const r=S.recipes.find(x=>x.id===id); if(!r) return; r.used=(r.used||0)+1; save(); servingSheet(asFood(r)); },
    quick(id){ const r=S.recipes.find(x=>x.id===id); if(!r) return; r.used=(r.used||0)+1; logFood(asFood(r),1); }
  };

  /* refresh recipe list whenever the Log sheet opens */
  const _openFood=window.openFood;
  window.openFood=function(){ _openFood.apply(this,arguments); renderList(); };
  renderList();
})();
