/* APEX DIRECTOR — game layer (3D + UI on top of ENGINE) */
'use strict';
const $=id=>document.getElementById(id);
window.addEventListener('error',e=>{const b=$('errbar');if(b){b.style.display='block';
  b.textContent='⚠ '+(e.message||e.error)+' @'+(e.lineno||'');}});

function modal(o){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='fa-modal';
    ov.innerHTML=`<div class="fa-box"><h3>${o.title||''}</h3>
      <div class="fa-body">${o.html||''}</div>
      ${(o.fields||[]).map(f=>`<label class="fa-f">${f.label}
        ${f.type==='select'?`<select id="mf_${f.k}">${f.opts.map(x=>`<option ${x===f.def?'selected':''}>${x}</option>`).join('')}</select>`
        :f.type==='check'?`<input type="checkbox" id="mf_${f.k}" ${f.def?'checked':''}>`
        :`<input type="${f.type||'text'}" id="mf_${f.k}" value="${f.def??''}">`}</label>`).join('')}
      <div class="fa-btns">${(o.buttons||[{label:'OK',val:true}]).map((b,i)=>
        `<button class="fa-b ${b.cls||''}" data-v="${i}">${b.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    const done=v=>{const fields={};(o.fields||[]).forEach(f=>{
        const el=document.getElementById('mf_'+f.k);
        fields[f.k]=f.type==='check'?el.checked:(f.type==='number'?+el.value:el.value);});
      ov.remove();res(v===null?null:{val:v,fields});};
    ov.querySelectorAll('.fa-b').forEach((b,i)=>b.onclick=()=>done((o.buttons||[{val:true}])[+b.dataset.v].val));
    ov.onclick=e=>{if(e.target===ov&&!o.must)done(null);};
  });
}
function toast(title,html){return modal({title,html,buttons:[{label:'OK',val:1}]});}
let R=null;                       // active race (ENGINE state)
let SEASON={raceIdx:0,drivers:{},teams:{},history:[]};
let CAR=null,GAMELEN='season',LASTPTS=null,PW=null;
function store(k,v){try{localStorage.setItem(k,v);}catch(e){window.__mem=window.__mem||{};window.__mem[k]=v;}}
function fetchS(k){try{return localStorage.getItem(k);}catch(e){return (window.__mem||{})[k];}}
let CFG={mode:'tp',trackId:'bahrain',laps:30,weather:'dry',playerTeam:'Scarlatti Corse',seed:(Math.random()*1e9)|0,abrasion:1,minStops:0,allowed:['S','M','H','I','W']};
let scene=null,camera=null,renderer=null,carObjs=[],scObj=null,debObjs={},trackGroup=null,rainPts=null;
let camMode='tv',orb={th:0.8,ph:0.9,r:2600,auto:true},SPEED=1,accum=0,wallT=0,uiT=0;
const TY=()=>ENGINE.TYRES;

/* ================= setup screen ================= */
function svgOutline(tr){
  const T=ENGINE.buildTrack(tr);
  const xs=T.xy.map(p=>p[0]),ys=T.xy.map(p=>p[1]);
  const mnx=Math.min(...xs),mxx=Math.max(...xs),mny=Math.min(...ys),mxy=Math.max(...ys);
  const sc=Math.min(150/(mxx-mnx),64/(mxy-mny));
  const pts=T.xy.filter((_,i)=>i%6===0).map(p=>
    `${((p[0]-mnx)*sc+5).toFixed(1)},${((mxy-p[1])*sc+5).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 160 74"><polyline points="${pts}" fill="none" stroke="#00e5ff" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/></svg>`;
}
function buildSetup(){
  const tl=$('tracklist');
  ENGINE.TRACKS.forEach(tr=>{
    const b=document.createElement('button');
    b.className='tk'+(tr.id===CFG.trackId?' on':'');b.dataset.t=tr.id;
    b.innerHTML=svgOutline(tr)+`<b>${tr.name}</b><span>${tr.country} · ${tr.km} km</span>`;
    b.onclick=()=>{CFG.trackId=tr.id;
      document.querySelectorAll('.tk').forEach(x=>x.classList.toggle('on',x===b));};
    tl.appendChild(b);
  });
  const teams=[...new Set(ENGINE.GRID.map(g=>g[2]))];
  const tml=$('teamlist');
  teams.forEach(tm=>{
    const col='#'+ENGINE.GRID.find(g=>g[2]===tm)[3].toString(16).padStart(6,'0');
    const b=document.createElement('button');
    b.className='team'+(tm===CFG.playerTeam?' on':'');
    b.innerHTML=`<span class="sw" style="background:${col}"></span>${tm}`;
    b.onclick=()=>{CFG.playerTeam=tm;
      document.querySelectorAll('.team').forEach(x=>x.classList.toggle('on',x===b));};
    tml.appendChild(b);
  });
  document.querySelectorAll('.mode-card').forEach(b=>b.onclick=()=>{
    CFG.mode=b.dataset.mode;
    document.querySelectorAll('.mode-card').forEach(x=>x.classList.toggle('on',x===b));
    $('teamsect').style.display=CFG.mode==='tp'?'':'none';
    $('teamlist').style.display=CFG.mode==='tp'?'':'none';
  });
  $('laps').oninput=e=>{CFG.laps=+e.target.value;$('lapsVal').textContent=e.target.value;};
  document.querySelectorAll('#wxset .pill').forEach(b=>b.onclick=()=>{
    CFG.weather=b.dataset.w;
    document.querySelectorAll('#wxset .pill').forEach(x=>x.classList.toggle('on',x===b));});
  document.querySelectorAll('#glen .pill').forEach(b=>b.onclick=()=>{
    GAMELEN=b.dataset.g;
    document.querySelectorAll('#glen .pill').forEach(x=>x.classList.toggle('on',x===b));
    $('gpNote').textContent=GAMELEN==='season'?'— season opener; the calendar then runs all 23 rounds':'';
  });
  $('abr').oninput=e=>{CFG.abrasion=e.target.value/100;$('abrVal').textContent=CFG.abrasion.toFixed(1)+'×';};
  let SLOT=1;
  document.querySelectorAll('#slots [data-slot]').forEach(b=>b.onclick=()=>{
    SLOT=+b.dataset.slot;window.__slot=SLOT;
    document.querySelectorAll('#slots [data-slot]').forEach(x=>x.classList.toggle('on',x===b));
    CAR=null;});
  window.__slot=1;
  $('ptsPreset').onchange=e=>{CFG.points=e.target.value==='classic'?[10,8,6,5,4,3,2,1]
    :e.target.value==='winner'?[40,18,15,12,10,8,6,4,2,1]:null;};
  $('revGrid').onchange=e=>CFG.reverseGrid=e.target.checked;
  $('btnFull').onclick=()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}catch(e){}};
  $('btnNames').onclick=nameEditor;
  $('btnScen').onclick=scenarioMenu;
  $('minStops').onchange=e=>CFG.minStops=Math.max(0,Math.min(6,+e.target.value||0));
  document.querySelectorAll('#tyAlloc input').forEach(cb=>cb.onchange=()=>{
    CFG.allowed=[...document.querySelectorAll('#tyAlloc input:checked')].map(x=>x.dataset.ty);});
  $('btnLoad').onclick=()=>$('loadFile').click();
  $('loadFile').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{CAR=CAREER.load(rd.result);GAMELEN='season';openHub();};
    rd.readAsText(f);
  };
  const saved=fetchS('ra_career');
  if(saved){const b=document.createElement('button');b.className='pill';
    b.textContent='▶ Resume career ('+(JSON.parse(saved).year)+')';
    b.onclick=()=>{CAR=CAREER.load(saved);GAMELEN='season';openHub();};
    $('btnLoad').after(b);}
  $('go').onclick=async()=>{
    if(GAMELEN==='season'){
      const fresh=!CAR;
      if(!CAR)CAR=CAREER.newCareer(CFG.seed,+($('seasonLen')?$('seasonLen').value:23)||23);
      if(fresh&&CFG.mode==='tp'){CAR.playerTeamHint=CFG.playerTeam;CAREER.setBoardTarget(CAR,CFG.playerTeam);await sponsorDraft();}
      openHub();
    }
    else startRace();
  };
}

/* ================= career hub ================= */
function openHub(){
  wireChrome();
  if(CAR&&CFG.mode==='tp')CAR.playerTeamHint=CFG.playerTeam;
  $('setup').style.display='none';$('results').classList.remove('show');
  document.querySelectorAll('.hud').forEach(h=>h.style.display='none');
  $('hub').style.display='';
  const C=CAR;
  const rIdx=C.raceIdx,tr=ENGINE.TRACKS.find(t=>t.id===C.calendar[rIdx%23]);
  $('hubSeason').textContent=`${C.year} · Round ${rIdx%23+1}/23 — next: ${tr.name}, ${tr.country} · mode: ${CFG.mode==='fia'?'RACE CONTROL':CFG.mode==='tp'?CFG.playerTeam:'BROADCAST'}`;
  const st=CAREER.standings(C);
  $('hubStand').innerHTML='<b style="color:var(--cyan)">DRIVERS</b><br>'+
    st.drivers.slice(0,8).map(([c,p],i)=>`${i+1}. ${c} — ${p}`).join('<br>')+
    '<br><br><b style="color:var(--cyan)">CONSTRUCTORS</b><br>'+
    st.teams.slice(0,8).map(([t,p],i)=>`${i+1}. ${t} — ${p}`).join('<br>');
  // team card (TP mode) / IMA oversight (RC mode)
  const showTeam=CFG.mode==='tp';
  $('hubTeamCard').style.display='';
  if(CFG.mode==='fia'){
    $('hubTeamCard').querySelector('h4').textContent='IMA OVERSIGHT — TEAM FINANCES';
    $('hubTeam').innerHTML='<table class="restab" style="font-size:11.5px"><tr><th>TEAM</th><th>BUDGET</th><th>CAP USED</th><th>PERF</th><th></th></tr>'+
      Object.values(C.teams).map(T=>
        `<tr><td>${T.name}<br><span style="color:var(--dim);font-size:10px">${T.engine}</span></td>
         <td class="mono">$${T.budget.toFixed(0)}m</td>
         <td class="mono" style="color:${T.capUsed>(CAR?CAR.costCap:135)?'var(--red)':'inherit'}">$${T.capUsed.toFixed(0)}/${(CAR?CAR.costCap:135)}m</td>
         <td class="mono">${((T.perf-1)*100).toFixed(1)}%</td>
         <td><button class="bx" data-fine="${T.name}" style="padding:3px 8px;font-size:10px">FINE</button></td></tr>`).join('')+'</table>';
    $('hubTeam').querySelectorAll('[data-fine]').forEach(b=>b.onclick=async()=>{
      const v=await modal({title:'IMA FINE — '+b.dataset.fine,
        fields:[{k:'amt',label:'Fine amount ($m)',type:'number',def:5},
                {k:'why',label:'Reason',def:'procedural breach'}],
        buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'ISSUE FINE',val:1,cls:'red'}]});
      if(!v||!v.val)return;
      C.teams[b.dataset.fine].budget-=v.fields.amt;
      CAREER.news(C,'fia',`IMA fine ${b.dataset.fine} $${v.fields.amt}m — ${v.fields.why}.`);
      openHub();});
  }
  if(showTeam){
    const T=C.teams[CFG.playerTeam];
    const capPct=Math.min(T.capUsed/(CAR?CAR.costCap:135)*100,130);
    $('hubTeam').innerHTML=`
      <div class="mono">💰 Budget <b style="color:var(--green)">$${T.budget.toFixed(1)}m</b> · sponsors +$${CAREER.sponsorIncome(T)}m/yr · wages −$${CAREER.wageBill(C,CFG.playerTeam).toFixed(0)}m/yr · staff ${T.staff} · ATR ${T.atr.toFixed(2)}×</div>
      <div style="margin:6px 0 2px;font-size:11px;color:var(--dim)">COST CAP $${T.capUsed.toFixed(1)}m / $${(CAR?CAR.costCap:135)}m ${T.capUsed>(CAR?CAR.costCap:135)?'<b style=\'color:var(--red)\'>BREACH!</b>':''}</div>
      <div class="wearbar"><i style="width:${capPct}%;${T.capUsed>(CAR?CAR.costCap:135)?'background:var(--red)':''}"></i></div>
      <div class="btnrow">
        <button class="bx" data-dev="aero">+ Aero $8m</button>
        <button class="bx" data-dev="chassis">+ Chassis $8m</button>
        <button class="bx" data-dev="engine">+ Engine $8m (mfr fund)</button>
        <button class="bx" data-staff="5">Hire 5 staff $4m</button>
      </div>
      <div style="margin-top:6px;font-size:11.5px;color:var(--dim)">Car perf <b class="mono" style="color:var(--cyan)">${((T.perf-1)*100).toFixed(2)}%</b> · engine: ${T.engine} (fund $${C.engines[T.engine].fund.toFixed(0)}m) · reliability ${(T.reliability*100).toFixed(1)}%</div>
      <div id="myDrivers" style="margin-top:8px"></div>
      <h4 style="margin:12px 0 6px;font-size:12px;letter-spacing:.2em;color:var(--gold)">SPONSORS</h4>
      <div style="font-size:12px">${T.sponsorships.map((sp,i)=>
        `<div style="display:flex;align-items:center;gap:6px;margin-top:3px">💼 <b>${sp.name}</b>
          <span style="color:var(--dim)">$${sp.perYear}m/yr · ${sp.years}yr${sp.clauses&&sp.clauses.results?' · results(top '+sp.clauses.results.topN+')':''}${sp.clauses&&sp.clauses.podiumBonus?' · $'+sp.clauses.podiumBonus+'m/podium':''} · exit $${sp.clauses?sp.clauses.exitFee:sp.perYear}m</span>
          <button class="bx" style="margin-left:auto;padding:2px 8px;font-size:10px" data-spx="${i}">TERMINATE</button></div>`).join('')||'<span style="color:var(--dim)">No active deals.</span>'}</div>
      <div class="btnrow" style="margin-top:6px"><button class="bx" id="spSeek">📨 SEEK NEW SPONSORS</button></div>
      <div id="spInbox" style="margin-top:7px"></div>`;
    const inbox=(C.sponsorOffers||[]).filter(o=>o.team===CFG.playerTeam);
    $('spInbox').innerHTML=inbox.map(o=>
      `<div style="display:flex;align-items:center;gap:8px;background:#1a1a12;border:1px solid #4d4416;border-radius:10px;padding:7px 10px;margin-top:5px;font-size:12px">
        📨 <b>${o.name}</b> <span style="color:var(--dim)">~$${o.base}m/yr territory · ${o.years}yr</span>
        <button class="bx" style="margin-left:auto" data-sp="${o.id}">NEGOTIATE</button></div>`).join('');
    $('spInbox').querySelectorAll('[data-sp]').forEach(b=>b.onclick=async()=>{
      const o=(C.sponsorOffers||[]).find(x=>x.id===b.dataset.sp);if(!o)return;
      await negotiateSponsorUI(o);openHub();});
    $('hubTeam').querySelectorAll('[data-spx]').forEach(b=>b.onclick=async()=>{
      const sp=T.sponsorships[+b.dataset.spx];if(!sp)return;
      const fee=sp.clauses?sp.clauses.exitFee:sp.perYear;
      const v=await modal({title:'TERMINATE — '+sp.name,
        html:`Ending this deal costs the agreed exit fee: <b>$${fee}m</b>.`,
        buttons:[{label:'KEEP DEAL',val:0,cls:'grey'},{label:'PAY & TERMINATE',val:1,cls:'red'}]});
      if(!v||!v.val)return;
      const r=CAREER.terminateSponsor(C,CFG.playerTeam,+b.dataset.spx);
      if(!r.ok)await toast('BLOCKED',r.why);
      openHub();});
    $('spSeek').onclick=async()=>{
      if(T.sponsorships.length>=5){await toast('SPONSORS','You already carry the maximum of 5 sponsors.');return;}
      if(Math.random()<0.25){await toast('SPONSORS','Your agency calls around… no brands are interested right now. Win something.');openHub();return;}
      const off=CAREER.makeSponsorOffer(C,CFG.playerTeam);
      await negotiateSponsorUI(off);openHub();};
    $('hubTeam').querySelectorAll('[data-dev]').forEach(b=>b.onclick=async()=>{
      const r=CAREER.develop(C,CFG.playerTeam,b.dataset.dev,8);
      if(!r.ok)await toast('DEVELOPMENT',r.why||'Blocked.');openHub();});
    $('hubTeam').querySelector('[data-staff]').onclick=()=>{CAREER.hireStaff(C,CFG.playerTeam,5);openHub();};
    CAREER.normalizeSeats(C);
    const T2=C.teams[CFG.playerTeam];
    const mine=T2.seats.map(sc=>C.drivers[sc]).filter(Boolean);
    const res=T2.reserve?C.drivers[T2.reserve]:null;
    $('myDrivers').innerHTML=mine.map(d=>
      `<div style="display:flex;gap:8px;align-items:center;margin-top:4px">
        <b>${d.name}</b><span class="mono" style="color:var(--dim)">$${d.salary.toFixed(0)}m · ${d.years}yr · morale ${(d.morale*100)|0}% · penPts ${d.penPts}${d.clauses.num1?' · #1':''}</span>
        <button class="bx" style="margin-left:auto" data-rel="${d.code}">RELEASE (comp)</button></div>`).join('')+
      (res?`<div style="margin-top:6px;color:var(--dim)">RESERVE: <b style="color:var(--ink)">${res.name}</b> · $${res.salary.toFixed(0)}m</div>`:'');
    $('myDrivers').querySelectorAll('[data-rel]').forEach(b=>b.onclick=async()=>{
      const d=C.drivers[b.dataset.rel];
      const comp=(d.salary*d.years*0.75).toFixed(0);
      const v=await modal({title:'TERMINATE CONTRACT — '+d.name,
        html:`Early termination requires <b>$${comp}m compensation</b> paid to the driver. Proceed?`,
        buttons:[{label:'KEEP DRIVER',val:0,cls:'grey'},{label:'PAY & RELEASE',val:1,cls:'red'}]});
      if(!v||!v.val)return;
      const r=CAREER.releaseDriver(C,CFG.playerTeam,b.dataset.rel);
      if(!r.ok)await toast('BLOCKED',r.why||'Not possible.');
      openHub();});
  }
  // media
  $('hubMedia').innerHTML=C.media.slice(0,14).map(m=>
    `<div style="margin-bottom:7px"><b style="color:${{rumour:'var(--gold)',fia:'var(--cyan)',market:'var(--green)',media:'var(--vio)',paddock:'var(--dim)'}[m.kind]||'#fff'}">[${m.kind.toUpperCase()}]</b> ${m.text}</div>`).join('')||'<span style="color:var(--dim)">Quiet week in the paddock.</span>';
  // market / contracts register
  $('hubMarketCard').style.display='';
  if(CFG.mode==='fia'){
    $('hubMarketCard').querySelector('h4').textContent='CONTRACTS REGISTER';
    $('hubMarket').innerHTML=Object.values(C.drivers).sort((a,b)=>b.salary-a.salary).map(d=>
      `<div style="margin-bottom:4px"><b>${d.code}</b> <span style="color:var(--dim)">${d.team} · $${d.salary.toFixed(0)}m × ${d.years}yr${d.clauses.num1?' · #1':''}${d.clauses.exitIfNotTopN?' · exit-if-not-top'+d.clauses.exitIfNotTopN:''} · penPts ${d.penPts}</span></div>`).join('');
  }
  if(showTeam){
    const others=Object.values(C.drivers).filter(d=>d.team!==CFG.playerTeam).sort((a,b)=>b.rating-a.rating);
    $('hubMarket').innerHTML=others.slice(0,14).map(d=>
      `<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
        <b>${d.code}</b> <span style="color:var(--dim)">${d.team==='FREE'?'FREE AGENT':d.team+' · $'+d.salary.toFixed(0)+'m · '+d.years+'yr'+(d.clauses.releaseFee?' · buyout $'+d.clauses.releaseFee+'m':'')}</span>
        <button class="bx" style="margin-left:auto" data-app="${d.code}">APPROACH</button></div>`).join('');
    $('hubMarket').querySelectorAll('[data-app]').forEach(b=>b.onclick=async()=>{
      const code=b.dataset.app,d=C.drivers[code];
      const v=await modal({title:'CONTRACT OFFER — '+d.name,
        html:`${d.team==='FREE'?'Free agent.':`Under contract at <b>${d.team}</b> ($${d.salary.toFixed(0)}m/yr, ${d.years}yr left, buyout $${d.clauses.releaseFee}m${d.clauses.num1?', has #1 status':''}).`}`,
        fields:[{k:'sal',label:'Salary ($m / yr)',type:'number',def:Math.ceil(d.salary*1.3)},
                {k:'yrs',label:'Years',type:'number',def:2},
                {k:'when',label:'Joining',type:'select',def:'Immediately',opts:['Immediately','Next season']},
                {k:'n1',label:'Guaranteed #1 status clause',type:'check',def:false},
                {k:'exitN',label:'Exit clause: may leave if team outside top-N (0 = none)',type:'number',def:0},
                {k:'buyout',label:'Release fee rivals must pay to poach him ($m)',type:'number',def:Math.round(Math.max(15,d.salary*0.8))},
                {k:'pb',label:'Podium bonus you pay him ($m per podium)',type:'number',def:0}],
        buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:d.years>0&&d.team!=='FREE'?'OFFER + PAY BUYOUT':'MAKE OFFER',val:1}]});
      if(!v||!v.val)return;
      let r;
      const when=v.fields.when==='Next season'?'nextSeason':'now';
      if(d.team==='FREE'){r=CAREER.signFree(C,CFG.playerTeam,code,{salary:v.fields.sal,years:v.fields.yrs});
        if(r.ok)r.accepted=true;}
      else r=CAREER.approachDriver(C,CFG.playerTeam,code,{salary:v.fields.sal,years:v.fields.yrs,num1:v.fields.n1,when,
        exitN:v.fields.exitN||0,releaseFee:v.fields.buyout,podiumBonus:v.fields.pb||0,releaseBuyout:d.years>0});
      if(r.accepted&&!r.deferred)await placeDriver(code,d.name);
      else await toast('NEGOTIATION',r.accepted?`<b style="color:var(--green)">PRE-CONTRACT SIGNED.</b> ${d.name} joins ${CFG.playerTeam} next season.`:
        `<b style="color:var(--red)">Declined.</b> ${r.why||'Estimated acceptance was '+Math.round((r.p||0)*100)+'%. Sweeten the offer.'}`);
      openHub();});
  }
  // stewards (pending challenges from last race)
  const pend=C.pendingIncidents.filter(i=>!i.resolved);
  $('hubStewards').innerHTML=pend.length?pend.map((inc,i)=>
    `<div style="margin-bottom:7px">Lap ${inc.lap} — <b>${inc.cars.join(' / ')}</b>: ${inc.type}${inc.penalised?` (+${inc.secs}s)`:''}
      ${CFG.mode==='fia'?`<div class="btnrow">${inc.penalised
        ?`<button class="bx" data-ch="${i}" data-a="1">ACCEPT challenge → rescind</button><button class="bx" data-ch="${i}" data-a="0">REJECT challenge</button>`
        :`<button class="bx" data-post="${i}">⚖ REVIEW CLIP → penalise</button><button class="bx" data-noact="${i}">No action</button>`}</div>`
      :inc.penalised&&window.__lastRace&&window.__lastRace.cars.find(c=>c.code===inc.cars[0]&&c.team===CFG.playerTeam)
        ?`<div class="btnrow"><button class="bx" data-pet="${i}">PETITION IMA (new data)</button></div>`:''}
    </div>`).join(''):'<span style="color:var(--dim)">No open investigations.</span>';
  $('hubStewards').querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>{
    if(window.__lastRace)stewardsRule(+b.dataset.ch,b.dataset.a==='1');openHub();});
  $('hubStewards').querySelectorAll('[data-noact]').forEach(b=>b.onclick=()=>{
    C.pendingIncidents[+b.dataset.noact].resolved=true;openHub();});
  $('hubStewards').querySelectorAll('[data-post]').forEach(b=>b.onclick=async()=>{
    const inc=C.pendingIncidents[+b.dataset.post];
    const who=await modal({title:'STEWARDS REVIEW — lap '+inc.lap,
      html:`Incident clip: <b>${inc.cars.join(' vs ')}</b> — ${inc.type}. Verdict?`,
      buttons:inc.cars.map(c=>({label:'PENALISE '+c+' +10s',val:c})).concat(
        inc.cars.map(c=>({label:'GRID PENALTY '+c+' (next race, 5 places)',val:'g:'+c,cls:'grey'})),
        [{label:'Racing incident',val:0,cls:'grey'}])});
    if(!who)return;inc.resolved=true;
    if(typeof who.val==='string'&&who.val.startsWith('g:')){
      const code=who.val.slice(2);
      C.gridPens[code]=(C.gridPens[code]||0)+5;
      CAREER.news(C,'fia',`Stewards: ${code} handed a 5-place grid penalty for the next round.`);}
    else if(who.val){applyPostPenalty(who.val,10,2);
      CAREER.news(C,'fia',`Post-race: +10s for ${who.val} (${inc.type}, lap ${inc.lap}). Results amended.`);}
    openHub();});
  $('hubStewards').querySelectorAll('[data-pet]').forEach(b=>b.onclick=async()=>{
    const ok=Math.random()<0.35;
    if(window.__lastRace)stewardsRule(+b.dataset.pet,ok);
    await toast('IMA RESPONSE',ok?'New footage reviewed… penalty <b>RESCINDED</b>. Results amended.':'"No significant new evidence." Petition rejected.');
    openHub();});
  // governance
  $('hubGov').innerHTML=(CFG.mode==='fia'?`
    <div class="btnrow">
      <button class="bx" id="govReg">Propose regulation…</button>
      <button class="bx" id="govTeam">New team entry vote…</button>
    </div>`:'<span style="color:var(--dim)">The IMA governs; watch the media feed for votes and rulings.</span>')+
    `<div style="margin-top:7px;color:var(--dim)">Active regs: ${C.regs.length?C.regs.join(' · '):'baseline 2026'}</div>`;
  if(CFG.mode==='fia'){
    $('govReg').onclick=()=>proposeRegFlow(C,true);
    $('govTeam').onclick=async()=>{
      const v=await modal({title:'NEW TEAM ENTRY — Prodrive F1',
        fields:[{k:'fee',label:'Anti-dilution entry fee ($m)',type:'number',def:200}],
        buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'PUT TO TEAM VOTE',val:1}]});
      if(!v||!v.val)return;
      const res=CAREER.addTeamVote(C,'Prodrive F1',v.fields.fee);
      const det=Object.entries(res.votes).map(([t,x])=>`<div>${t}: <b style="color:${x?'var(--green)':'var(--red)'}">${x?'FOR':'AGAINST'}</b></div>`).join('');
      await modal({title:`TEAMS VOTE ${res.yes}/11 — ${res.passed?'APPROVED':'REJECTED'}`,html:det,
        buttons:[{label:'OK',val:1}]});
      CAREER.news(C,'fia',`New-team vote: ${res.yes}/11 ${res.passed?'— entry APPROVED (future season)':'— entry rejected'} (fee $${v.fields.fee}m).`);
      openHub();};
  }
  // juniors
  $('hubJuniors').innerHTML='<b>F2</b><br>'+C.f2.slice(0,5).map((j,i)=>
    `${i+1}. ${j.name} — ${j.pts} ${showTeam?`<button class="bx" data-pj="${i}" style="padding:2px 7px;font-size:10px">SIGN</button>`:''}`).join('<br>')+
    '<br><br><b>F3</b><br>'+C.f3.slice(0,4).map((j,i)=>`${i+1}. ${j.name} — ${j.pts}`).join('<br>');
  $('hubJuniors').querySelectorAll('[data-pj]').forEach(b=>b.onclick=async()=>{
    const r=CAREER.promoteJunior(C,CFG.playerTeam,+b.dataset.pj);
    if(r.ok)await placeDriver(r.code,C.drivers[r.code].name);
    openHub();});
  $('hubSave').onclick=()=>{
    store('ra_career',CAREER.save(C));
    const blob=new Blob([CAREER.save(C)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`race_authority_${C.year}.json`;a.click();};
  $('hubNext').onclick=()=>{$('hub').style.display='none';startWeekend();};
  renderHubExtras(C);
  $('hubSim').onclick=async()=>{
    const v=await modal({title:'⚡ SIM NEXT GRAND PRIX',
      html:'Simulate the entire next race weekend instantly and jump to the results.',
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'SIM IT',val:1}]});
    if(!v||!v.val)return;
    $('hub').style.display='none';
    window.__simWeekend=true;
    await startWeekend();
    if(R&&!R.finished){R.autopilot=true;let g3=0;while(!R.finished&&g3++<4e5)ENGINE.step(R,0.25);}
    window.__simWeekend=false;
  };
}
function applyPostPenalty(code,secs,pts){
  const R2=window.__lastRace;if(!R2)return;
  const before=R2.results.map(r=>({code:r.code,pts:r.pts,team:r.team}));
  const c=R2.cars.find(x=>x.code===code);if(!c)return;
  c.penalty+=secs;
  const d=CAR.drivers[code];if(d)d.penPts+=pts;
  const order=[...R2.cars].sort((a,b)=>{if(a.retired!==b.retired)return a.retired?1:-1;
    if(a.retired)return (b.lap-a.lap)||(a.totalT-b.totalT);
    return (a.totalT+a.penalty)-(b.totalT+b.penalty);});
  R2.results=order.map((c2,i)=>({...R2.results.find(r=>r.code===c2.code),pos:i+1,
    pts:c2.retired?0:(ENGINE.POINTS[i]||0)}));
  for(const b of before){CAR.driverPts[b.code]-=b.pts;CAR.teamPts[b.team]-=b.pts;}
  for(const r of R2.results){CAR.driverPts[r.code]=(CAR.driverPts[r.code]||0)+r.pts;
    CAR.teamPts[r.team]=(CAR.teamPts[r.team]||0)+r.pts;}
}
async function negotiateSponsorUI(off){
  const C=CAR;
  const v=await modal({title:'SPONSOR TALKS — '+off.name,
    html:`They value the partnership around <b>$${off.base}m/yr</b> · ${off.years}yr territory. Set YOUR terms — every clause moves their ceiling.`,
    fields:[{k:'ask',label:'Your demand ($m / yr)',type:'number',def:off.base},
            {k:'yrs',label:'Contract years',type:'number',def:off.years},
            {k:'res',label:`Results clause: −30% payment if outside top ${off.clauseOffer.topN} (they pay ~25% more)`,type:'check',def:false},
            {k:'pb',label:'Podium bonus they pay you ($m per podium — lowers their ceiling)',type:'number',def:0},
            {k:'fee',label:'YOUR exit fee to terminate early ($m — low fee makes them nervous)',type:'number',def:off.base}],
    buttons:[{label:'WALK AWAY',val:0,cls:'grey'},{label:'PUT IT ON THE TABLE',val:1}]});
  if(!v||!v.val)return null;
  const r=CAREER.negotiateSponsor(C,CFG.playerTeam,off,
    {demand:v.fields.ask,years:v.fields.yrs,results:v.fields.res,podiumBonus:v.fields.pb||0,exitFee:v.fields.fee});
  await toast('SPONSORSHIP',r.accepted?`<b style="color:var(--green)">SIGNED!</b> ${off.name} — $${Math.round(v.fields.ask)}m/yr × ${v.fields.yrs}yr.`:
    `<b style="color:var(--red)">${r.why||'They walked.'}</b>${r.p!=null?' (acceptance was ~'+Math.round(r.p*100)+'%)':''}`);
  return r;
}
async function playQuali(PW,cfg){
  const C=CAR;
  const Q=ENGINE.createQualiSession({...cfg,carPerf:PW.carPerf,roster:PW.roster,evo:0.97});
  const myCars=CFG.mode==='tp'?PW.roster.filter(r=>r[2]===CFG.playerTeam).map(r=>r[0]):[];
  for(let seg=1;seg<=3;seg++){
    let plans={};
    if(myCars.length&&!Q.out.includes(myCars[0])||myCars.length>1&&!Q.out.includes(myCars[1])){
      const v=await modal({title:`Q${seg} — RUN PLAN (${CFG.playerTeam})`,must:true,
        html:`Knockout: slowest 5 eliminated.${Q.rain>0.15?' <b style="color:var(--cyan)">Rain in the air — gamble on timing.</b>':''}`,
        fields:[{k:'tim',label:'Timing (late = more grip, more risk)',type:'select',def:'late',opts:['early','late']},
                {k:'ty',label:'Tyre',type:'select',def:Q.rain>0.3?'I':'S',opts:['S','M','I','W']},
                {k:'bank',label:'Banker lap first (safe, costs peak pace)',type:'check',def:seg===1},
                {k:'tow',label:'Teammate tow on the final run',type:'check',def:false}],
        buttons:[{label:'SEND THEM OUT',val:1}]});
      for(const code of myCars)if(!Q.out.includes(code))
        plans[code]={timing:v.fields.tim,tyre:v.fields.ty,banker:v.fields.bank,
          tow:v.fields.tow?myCars.find(c=>c!==code):null};
    }
    const r=ENGINE.runQualiSegment(Q,plans);
    await modal({title:`Q${seg} CLASSIFICATION${r.yellow?' — ⚠ late yellow flag!':''}`,
      html:`<div class="mono" style="font-size:12px;max-height:40vh;overflow:auto">${
        r.results.map((x,i)=>`<div style="${myCars.includes(x.code)?'color:var(--cyan);font-weight:700':''}">${
          String(i+1).padStart(2)}. ${x.code} ${x.t.toFixed(3)}${r.dropped.includes(x.code)?' <span style="color:var(--red)">OUT</span>':''}</div>`).join('')}</div>`,
      buttons:[{label:seg<3?'NEXT SEGMENT ➜':'TO THE GRID ➜',val:1}]});
  }
  return Q.order;
}
async function sponsorDraft(){
  const C=CAR;
  let offers=CAREER.seasonOffers(C,CFG.playerTeam);
  C.teams[CFG.playerTeam].sponsorships=[];        // your garage, your deals
  while(true){
    const T=C.teams[CFG.playerTeam];
    const v=await modal({title:`SPONSOR DRAFT — ${CFG.playerTeam} (${T.sponsorships.length}/5 signed)`,must:true,
      html:`${offers.length?'Brands at the door — negotiate whichever you want, in any order:':'No more offers on the table.'}
        ${T.sponsorships.length?'<br><br>Signed: '+T.sponsorships.map(s=>`<b>${s.name}</b> $${s.perYear}m`).join(' · '):''}`,
      buttons:[...offers.map((o,i)=>({label:`${o.name} · ~$${o.base}m/yr · ${o.years}yr`,val:i})),
               {label:T.sponsorships.length?'DONE — GO RACING ➜':'RACE UNSPONSORED ➜',val:'done',cls:'grey'}]});
    if(!v||v.val==='done')break;
    const off=offers[v.val];
    const r=await negotiateSponsorUI(off);
    if(r)offers.splice(v.val,1);                  // signed or walked: offer consumed
    if(C.teams[CFG.playerTeam].sponsorships.length>=5)break;
  }
}
async function placeDriver(code,name){
  const C=CAR,T=C.teams[CFG.playerTeam];
  const seated=T.seats.map(sc=>C.drivers[sc]);
  const v=await modal({title:'SEAT DECISION — '+name,must:true,
    html:`${name} has joined ${CFG.playerTeam}. Who makes way?`,
    buttons:[...seated.map(sd=>({label:`REPLACE ${sd.name} (pay $${(sd.salary*sd.years*0.75).toFixed(0)}m comp)`,val:sd.code})),
             {label:'RESERVE DRIVER',val:'reserve',cls:'grey'}]});
  const choice=v?v.val:'reserve';
  if(choice==='reserve')CAREER.assignSeat(C,CFG.playerTeam,code,'reserve');
  else{
    const r=CAREER.assignSeat(C,CFG.playerTeam,code,'replace',choice);
    if(!r.ok){await toast('BLOCKED',r.why||'Cannot complete.');CAREER.assignSeat(C,CFG.playerTeam,code,'reserve');}
  }
}
async function proposeRegFlow(C,isRC){
  const teams=Object.keys(C.teams);
    const v=await modal({title:'📜 PROPOSE REGULATION',
      html:isRC?'Draft it, put it to the teams, then honour the vote — or overrule it.':'Propose it; the teams vote; the IMA decides whether to honour the result.',
      fields:[{k:'ty',label:'Regulation',type:'select',def:CAREER.REG_TYPES[0].title,opts:CAREER.REG_TYPES.map(t=>t.title)},
              {k:'x',label:'Parameter (e.g. new customer cap)',type:'number',def:3},
              ...teams.map((t,i)=>({k:'b'+i,label:'Beneficiary: '+t,type:'check',def:false}))],
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'PUT TO THE VOTE',val:1}]});
    if(!v||!v.val)return;
    const ty=CAREER.REG_TYPES.find(t=>t.title===v.fields.ty);
    const bens=teams.filter((t,i)=>v.fields['b'+i]);
    const reg=CAREER.proposeReg(C,ty.id,bens,isRC?'IMA':CFG.playerTeam,v.fields.x);
    const detail=Object.entries(reg.votes).map(([t,y])=>`${y?'🟢':'🔴'} ${t}`).join('<br>');
    if(isRC){
      const weak=C.imaWeak&&C.imaWeak>C.year;
      const d2=await modal({title:`VOTE: ${reg.yes}/${reg.total} IN FAVOUR — ${reg.passed?'PASSES':'FAILS'}`,
        html:detail+(weak?'<br><b style="color:var(--red)">Caretaker presidency: you must honour the vote.</b>':''),
        buttons:weak?[{label:'HONOUR THE VOTE',val:'honour'}]
          :[{label:'HONOUR THE VOTE',val:'honour'},{label:'FORCE THROUGH',val:'force',cls:'red'},{label:'VETO',val:'block',cls:'grey'}]});
      CAREER.applyReg(C,reg,d2?d2.val:'honour');
    }else{
      const ima=C.fiaTemper>1?(reg.passed&&Math.random()<0.7?'honour':'block'):(reg.passed?'honour':(Math.random()<0.2?'force':'honour'));
      CAREER.applyReg(C,reg,ima);
      await modal({title:`VOTE: ${reg.yes}/${reg.total} — IMA ${ima.toUpperCase()}`,html:detail,buttons:[{label:'OK',val:1}]});
    }
  openHub();
}
function renderHubExtras(C){
  let ex=$('hubExtras');
  if(!ex){ex=document.createElement('div');ex.id='hubExtras';ex.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-top:14px';
    $('hub').querySelector('.wrap').appendChild(ex);}
  const isRC=CFG.mode==='fia';
  const dev=C.engineDev,ems=Object.entries(dev).sort((a,b)=>b[1].perf-a[1].perf);
  const mn=Math.min(...ems.map(([,d])=>d.perf)),mx=Math.max(...ems.map(([,d])=>d.perf));
  ex.innerHTML=`
  <div class="card"><h3>🔧 ENGINE ROOM</h3>
    ${ems.map(([em,d])=>`<div style="margin-bottom:7px">
      <div style="display:flex;font-size:11.5px"><b>${em}</b><span style="margin-left:auto" class="mono">${d.perf.toFixed(4)}${d.bannedUntil>C.year?' · <b style="color:var(--red)">DEV BANNED→'+d.bannedUntil+'</b>':''}${d.edt?' · EDT×'+d.edt:''}</span></div>
      <div style="height:8px;background:#141824;border-radius:4px"><i style="display:block;height:100%;border-radius:4px;width:${8+92*(d.perf-mn)/Math.max(mx-mn,1e-4)}%;background:linear-gradient(90deg,var(--cyan),var(--vio))"></i></div>
      <div style="font-size:10px;color:var(--dim)">${CAREER.engineCustomers(C,em).join(' · ')||'no customers'}</div>
      ${isRC?`<div class="btnrow" style="margin-top:3px"><button class="bx" data-eban="${em}">BAN DEV</button><button class="bx" data-eedt="${em}">GRANT EDT</button></div>`:''}
    </div>`).join('')}
    ${!isRC?`<div class="btnrow"><button class="bx" id="eDev">DEVELOP ENGINE $30m</button><button class="bx" id="eSwitch">SWITCH SUPPLIER</button><button class="bx" id="eWorks">BECOME MANUFACTURER $150m</button></div>`:''}
    <div style="font-size:10px;color:var(--dim);margin-top:4px">Customer cap: ${C.customerCap} per manufacturer (changeable by regulation)</div>
  </div>
  <div class="card"><h3>🏛 PROPOSALS & DEVICES</h3>
    <div class="btnrow"><button class="bx" id="regNew">📜 PROPOSE REGULATION</button>
      ${isRC?'<button class="bx" id="dirBtn">⚙ ISSUE TECHNICAL DIRECTIVE</button>':'<button class="bx" id="devFile">🧪 FILE NOVEL DEVICE</button>'}</div>
    <div style="font-size:11.5px;margin-top:6px">${C.deviceCases.filter(d=>!d.ruled).map(d=>
      `<div style="margin-top:4px">🧪 <b>${d.team}</b> — "${d.name}" ${d.challenged?'· challenged by '+d.challenged:''}
        ${isRC?`<span class="btnrow"><button class="bx" data-dvr="${d.id}|legal">LEGAL</button><button class="bx" data-dvr="${d.id}|legal-season">THIS SEASON ONLY</button><button class="bx" data-dvr="${d.id}|ban">BAN</button></span>`
          :(!d.challenged&&d.team!==CFG.playerTeam?`<button class="bx" data-dvc="${d.id}">CHALLENGE LEGALITY</button>`:'<i style="color:var(--dim)">awaiting IMA ruling</i>')}</div>`).join('')||'<span style="color:var(--dim)">No open cases.</span>'}</div>
    ${isRC?`<div class="btnrow" style="margin-top:8px"><span style="font-size:11px;color:var(--dim);align-self:center">COST CAP $</span>
      <input type="number" id="capSet" value="${C.costCap}" style="width:70px;background:#1a1f2e;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px">
      <button class="bx" id="capBtn">SET FOR THIS SEASON</button></div>`:''}
  </div>
  ${!isRC&&C.negotiations.filter(n=>n.team===CFG.playerTeam).length?`<div class="card"><h3>🤝 NEGOTIATIONS</h3>
    ${C.negotiations.filter(n=>n.team===CFG.playerTeam).map(n=>`<div style="font-size:12px;margin-bottom:6px">
      <b>${C.drivers[n.code].name}</b> — round ${n.round}${n.hijack?' · <b style="color:var(--red)">'+n.hijack+' hijacking!</b>':''}<br>
      Camp demands <b class="mono">$${n.demand}m/yr</b> (your offer: $${n.offer.salary}m)
      <span class="btnrow"><button class="bx" data-nraise="${n.id}">MEET DEMAND</button><button class="bx" data-nwalk="${n.id}">WALK AWAY</button></span></div>`).join('')}</div>`:''}
  ${!isRC?`<div class="card"><h3>🎓 ACADEMY <span style="font-size:10px;color:var(--dim)">funded $${C.academy.level}m/yr</span></h3>
    <div class="btnrow">${[0,2,5].map(l=>`<button class="bx ${C.academy.level===l?'on':''}" data-acad="${l}">$${l}m</button>`).join('')}</div>
    <div style="font-size:11.5px;margin-top:5px">${C.academy.karters.map((k,i)=>
      `<div>🏎 ${k.name} (${k.age}) — ${k.shown} <button class="bx" data-kpr="${i}">→ F3</button></div>`).join('')||'<span style="color:var(--dim)">Scouts find karters over time (fund more, find more).</span>'}</div>
  </div>
  <div class="card"><h3>👥 STAR STAFF</h3>
    ${C.starStaff.map(st=>`<div style="font-size:11.5px;margin-bottom:4px">${st.role==='AERO'?'🌀':'🎧'} <b>${st.name}</b>
      · skill ${(st.skill*100)|0} · ${st.team||'FREE'}${st.garden?' <i style="color:var(--gold)">(gardening '+st.garden+' rounds)</i>':''}
      ${st.team!==CFG.playerTeam?`<button class="bx" data-poach="${st.name}">POACH</button>`:''}</div>`).join('')}
  </div>`:''}
  <div class="card"><h3>📜 ARCHIVE & BOARD</h3>
    ${!isRC&&C.boardTarget?`<div style="font-size:12px">Board target: <b>P${C.boardTarget}</b> in the constructors · reputation ${(C.rep*100)|0}%</div>`:''}
    <div class="btnrow" style="margin-top:5px"><button class="bx" id="histBtn">VIEW PAST SEASONS</button></div>
  </div>`;
  const on=(sel,fn)=>ex.querySelectorAll(sel).forEach(b=>b.onclick=()=>fn(b));
  on('[data-eban]',async b=>{const v=await modal({title:'BAN DEVELOPMENT — '+b.dataset.eban,
    fields:[{k:'y',label:'Years',type:'number',def:1}],buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'BAN',val:1,cls:'red'}]});
    if(v&&v.val){CAREER.banEngineDev(C,b.dataset.eban,Math.max(1,v.fields.y|0));openHub();}});
  on('[data-eedt]',async b=>{const v=await modal({title:'GRANT EDT — '+b.dataset.eedt,
    html:'Each token allows one major development while banned. Stack as many as you judge fair.',
    fields:[{k:'n',label:'Tokens',type:'number',def:1}],buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'GRANT',val:1}]});
    if(v&&v.val){CAREER.grantEDT(C,b.dataset.eedt,Math.max(1,v.fields.n|0));openHub();}});
  const q=id=>ex.querySelector('#'+id);
  if(q('eDev'))q('eDev').onclick=async()=>{const r=CAREER.developEngine(C,CFG.playerTeam,30);
    await toast('ENGINE',r.ok?(r.edt?'EDT burned — major upgrade delivered.':'Development applied (+perf).'):r.why);openHub();};
  if(q('eSwitch'))q('eSwitch').onclick=async()=>{
    const v=await modal({title:'SWITCH ENGINE SUPPLIER',fields:[{k:'em',label:'Manufacturer',type:'select',def:ems[0][0],opts:ems.map(([em])=>em)}],
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'SIGN SUPPLY DEAL $15m',val:1}]});
    if(v&&v.val){const r=CAREER.switchEngine(C,CFG.playerTeam,v.fields.em);
      await toast('ENGINE DEAL',r.ok?'Done — new power from next weekend.':r.why);openHub();}};
  if(q('eWorks'))q('eWorks').onclick=async()=>{const r=CAREER.becomeManufacturer(C,CFG.playerTeam);
    await toast('WORKS PROJECT',r.ok?`<b style="color:var(--green)">${r.name}</b> is born. You start at the back of the engine ladder — develop it.`:r.why);openHub();};
  if(q('capBtn'))q('capBtn').onclick=async()=>{C.costCap=Math.max(60,Math.min(300,+q('capSet').value||135));
    await toast('IMA','Cost cap set to $'+C.costCap+'m for this season.');openHub();};
  if(q('regNew'))q('regNew').onclick=()=>proposeRegFlow(C,isRC);

  if(q('dirBtn'))q('dirBtn').onclick=async()=>{
    const v=await modal({title:'⚙ TECHNICAL DIRECTIVE',
      html:'Mid-season clampdown — hits the three teams who developed this area hardest.',
      buttons:[{label:'AERO (flexi-wing tolerances)',val:'aero'},{label:'CHASSIS (flexibility clamp)',val:'chassis'},{label:'CANCEL',val:0,cls:'grey'}]});
    if(v&&v.val){const hit=CAREER.issueDirective(C,v.val);
      await toast('DIRECTIVE ISSUED','Hit hardest: '+hit.join(', '));openHub();}};
  if(q('devFile'))q('devFile').onclick=async()=>{
    const v=await modal({title:'🧪 FILE A NOVEL DEVICE',fields:[{k:'n',label:'Device name',type:'text',def:'Double-deck diffuser'}],
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'BRING IT TO THE TRACK',val:1}]});
    if(v&&v.val){CAREER.fileDevice(C,CFG.playerTeam,v.fields.n||'Mystery device');openHub();}};
  on('[data-dvr]',b=>{const [id,verdict]=b.dataset.dvr.split('|');CAREER.ruleDevice(C,id,verdict);openHub();});
  on('[data-dvc]',b=>{const d=C.deviceCases.find(x=>x.id===b.dataset.dvc);
    if(d){d.challenged=CFG.playerTeam;CAREER.news(C,'fia',`${CFG.playerTeam} formally challenge ${d.team}'s "${d.name}".`);
      setTimeout(()=>{if(!d.ruled)CAREER.ruleDevice(C,d.id,Math.random()<0.45?'ban':(Math.random()<0.5?'legal-season':'legal'));},50);}
    openHub();});
  on('[data-nraise]',b=>{const n=C.negotiations.find(x=>x.id===b.dataset.nraise);
    if(n){const r=CAREER.respondNegotiation(C,n.id,'raise',n.demand);
      if(r.resolved)toast('NEGOTIATION',r.result.accepted?'<b style="color:var(--green)">DEAL DONE.</b>':(r.result.why||'He turned it down at the last.')).then(()=>{
        if(r.result.accepted&&!r.result.deferred)placeDriver(n.code,C.drivers[n.code].name).then(openHub);else openHub();});
      else openHub();}});
  on('[data-nwalk]',b=>{CAREER.respondNegotiation(C,b.dataset.nwalk,'walk');openHub();});
  on('[data-acad]',b=>{CAREER.setAcademy(C,+b.dataset.acad);openHub();});
  on('[data-kpr]',b=>{CAREER.promoteKarter(C,+b.dataset.kpr);openHub();});
  on('[data-poach]',async b=>{const st=C.starStaff.find(x=>x.name===b.dataset.poach);
    const v=await modal({title:'POACH — '+st.name,fields:[{k:'s',label:'Salary offer ($m/yr, currently $'+st.salary+'m)',type:'number',def:Math.ceil(st.salary*1.4)}],
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'MAKE THE CALL',val:1}]});
    if(v&&v.val){const r=CAREER.poachStaff(C,CFG.playerTeam,st.name,v.fields.s);
      await toast('STAFF',r.accepted?'<b style="color:var(--green)">Signed.</b>'+(st.garden?' Gardening leave applies.':''):(r.why||'Declined.'));openHub();}});
  if(q('histBtn'))q('histBtn').onclick=async()=>{
    if(!C.history.length){await toast('ARCHIVE','No completed seasons yet.');return;}
    for(const h of [...C.history].reverse()){
      const cont=await modal({title:`📜 SEASON ${h.year} — CHAMPION: ${h.champion||'—'}`,
        html:`<div class="mono" style="font-size:12px;max-height:44vh;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:2px 18px">
          <div><b>DRIVERS</b>${(h.drivers||[]).slice(0,12).map((d,i)=>`<div>${i+1}. ${d[0]} — ${Math.round(d[1])}</div>`).join('')}</div>
          <div><b>CONSTRUCTORS</b>${(h.teams||[]).map((t,i)=>`<div>${i+1}. ${t[0]} — ${t[1]}</div>`).join('')}</div></div>`,
        buttons:[{label:'OLDER ⏮',val:1,cls:'grey'},{label:'CLOSE',val:0}]});
      if(!cont||!cont.val)break;
    }};
}
function stewardsRule(idx,accept){
  const before=window.__lastRace.results.map(r=>({code:r.code,pts:r.pts,team:r.team}));
  const res=CAREER.challengePenalty(CAR,window.__lastRace,idx,accept);
  if(res.reversed){
    for(const b of before){CAR.driverPts[b.code]-=b.pts;CAR.teamPts[b.team]-=b.pts;}
    for(const r of window.__lastRace.results){
      CAR.driverPts[r.code]=(CAR.driverPts[r.code]||0)+r.pts;
      CAR.teamPts[r.team]=(CAR.teamPts[r.team]||0)+r.pts;}
  }
}
async function startWeekend(){
  const C=CAR,tid=C.calendar[C.raceIdx%23];
  const tr=ENGINE.TRACKS.find(t=>t.id===tid);
  CFG.trackId=tid;CFG.laps=tr.laps;CFG.seed=(Math.random()*1e9)|0;
  PW=CAREER.preWeekend(C,{...CFG});
  if(CFG.mode==='tp'&&!window.__simWeekend){
    const fp=PW.practice[CFG.playerTeam];
    const mine=Object.values(C.drivers).filter(d=>d.team===CFG.playerTeam).map(d=>d.code);
    const qtext=mine.map(m=>`${m} P${PW.grid.indexOf(m)+1||'—'}`).join(' · ');
    const v=await modal({title:'RACE WEEKEND — '+tr.name,must:true,
      html:`<b>PRACTICE</b><br>${fp.crashed?'<b style="color:var(--red)">⚠ Crash in FP — degraded data.</b><br>':''}${fp.suggestion}
        <br><br><b>QUALIFYING</b>: ${qtext}<br><br>Parc fermé is now in force.`,
      buttons:[{label:'RESPECT PARC FERMÉ — TO THE GRID',val:0},
               {label:'🏁 PLAY QUALIFYING',val:'quali',cls:'grey'},
               {label:'⚡ SIM THIS RACE',val:'sim',cls:'grey'},
               {label:'BREACH IT: change setup → PIT-LANE START',val:1,cls:'red'}]});
    if(v&&v.val==='quali'){
      PW.grid=await playQuali(PW,cfgW);
    }
    if(CFG.reverseGrid)PW.grid=PW.grid.slice().reverse();
    if(v&&v.val==='sim'){
      startRace({gridOrder:PW.grid,carPerf:PW.carPerf,reliability:PW.reliability,roster:PW.roster,rivalries:PW.rivalries});
      R.autopilot=true;
      let g3=0;while(!R.finished&&g3++<4e5)ENGINE.step(R,0.25);
      return;
    }
    if(v&&v.val===1){
      PW.grid=PW.grid.filter(c=>!mine.includes(c)).concat(mine);
      CAREER.news(C,'fia',`${CFG.playerTeam} breach parc fermé — both cars start from the pit lane.`);
    }
  }
  startRace({gridOrder:PW.grid,carPerf:PW.carPerf,reliability:PW.reliability,roster:PW.roster,rivalries:PW.rivalries});
}

/* ================= 3D scene ================= */
function init3D(){
  try{
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x07080d);
    scene.fog=new THREE.Fog(0x07080d,3000,9000);
    camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,1,20000);
    renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
    const cv=$('gl');
    let down=null;
    cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};orb.auto=false;});
    cv.addEventListener('pointermove',e=>{if(!down)return;
      orb.th+=(e.clientX-down.x)*0.005;orb.ph-=(e.clientY-down.y)*0.005;
      orb.ph=Math.max(0.15,Math.min(1.45,orb.ph));down={x:e.clientX,y:e.clientY};});
    addEventListener('pointerup',()=>down=null);
    cv.addEventListener('wheel',e=>{e.preventDefault();
      orb.r=Math.max(300,Math.min(8000,orb.r*Math.pow(1.0012,e.deltaY)));},{passive:false});
  }catch(e){scene=null;console.warn('3D unavailable',e);}
}
function glowTex(hex){
  const cv=document.createElement('canvas');cv.width=cv.height=128;
  const g=cv.getContext('2d');
  const gr=g.createRadialGradient(64,64,3,64,64,64);
  gr.addColorStop(0,hex);gr.addColorStop(0.4,hex+'66');gr.addColorStop(1,hex+'00');
  g.fillStyle=gr;g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(cv);
}
function labelSprite(txt,color){
  const cv=document.createElement('canvas');cv.width=192;cv.height=72;
  const g=cv.getContext('2d');g.textAlign='center';
  g.shadowColor='rgba(0,0,0,.95)';g.shadowBlur=7;
  g.fillStyle=color;g.font='800 42px Segoe UI, sans-serif';g.fillText(txt,96,50);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),
    transparent:true,depthWrite:false}));
  sp.scale.set(150,56,1);return sp;
}
function buildScene(){
  if(!scene)return;
  if(trackGroup)scene.remove(trackGroup);
  carObjs=[];debObjs={};
  trackGroup=new THREE.Group();scene.add(trackGroup);
  const T=R.track,N=T.N;
  // center track
  const cx=T.xy.reduce((a,p)=>a+p[0],0)/N, cy=T.xy.reduce((a,p)=>a+p[1],0)/N;
  R._c=[cx,cy];
  // ribbon
  const W=13, posArr=[], colArr=[], idx=[];
  for(let i=0;i<N;i++){
    const p=T.xy[i],q=T.xy[(i+1)%N];
    let nx=-(q[1]-p[1]),ny=q[0]-p[0];
    const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
    posArr.push(p[0]-cx+nx*W,0,p[1]-cy+ny*W, p[0]-cx-nx*W,0,p[1]-cy-ny*W);
    const k=Math.min(T.curv[i]*260,1);      // corners tinted
    const r2=0.10+k*0.05,g2=0.11+k*0.02,b2=0.15;
    colArr.push(r2,g2,b2,r2,g2,b2);
    const a=i*2,b3=((i+1)%N)*2;
    idx.push(a,a+1,b3, a+1,b3+1,b3);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(posArr,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colArr,3));
  geo.setIndex(idx);
  R._trackMat=new THREE.MeshBasicMaterial({vertexColors:true});
  trackGroup.add(new THREE.Mesh(geo,R._trackMat));
  // glowing edges
  for(const side of[1,-1]){
    const pts=[];
    for(let i=0;i<=N;i++){
      const j=i%N,p=T.xy[j],q=T.xy[(j+1)%N];
      let nx=-(q[1]-p[1]),ny=q[0]-p[0];const nl=Math.hypot(nx,ny)||1;
      pts.push(new THREE.Vector3(p[0]-cx+nx/nl*W*side,1.2,p[1]-cy+ny/nl*W*side));
    }
    trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0x1b90a8,transparent:true,opacity:0.85})));
  }
  // start/finish
  const sf=fracXY(0);
  const sfm=new THREE.Mesh(new THREE.BoxGeometry(30,2,6),
    new THREE.MeshBasicMaterial({color:0xffffff}));
  sfm.position.set(sf[0],1.5,sf[1]);trackGroup.add(sfm);
  // kerbs: red/white studs at high-curvature edges
  {const kerbG=new THREE.Group();
   for(let i=0;i<N;i+=3){
     if(T.curv[i]<0.006)continue;
     const p=T.xy[i],q=T.xy[(i+1)%N];
     let nx=-(q[1]-p[1]),ny=q[0]-p[0];const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
     for(const side of[1,-1]){
       const m=new THREE.Mesh(new THREE.BoxGeometry(7,1.6,4.5),
         new THREE.MeshBasicMaterial({color:(i>>2)%2?0xd8303c:0xe8e8ea}));
       m.position.set(p[0]-cx+nx*(W+3.5)*side,0.8,p[1]-cy+ny*(W+3.5)*side);
       m.rotation.y=Math.atan2(q[0]-p[0],q[1]-p[1]);
       kerbG.add(m);
     }
   }
   trackGroup.add(kerbG);}
  // DRS zone: glow strip on the longest straight
  {let best={len:0};let run=0,start=0;
   for(let i=0;i<N*2;i++){const j=i%N;
     if(T.curv[j]<0.0035){if(!run)start=j;run++;}
     else{if(run>best.len)best={len:run,start};run=0;}}
   if(best.len>12){
     const pts=[];
     for(let k=0;k<best.len;k++){const j=(best.start+k)%N;
       pts.push(new THREE.Vector3(T.xy[j][0]-cx,2.2,T.xy[j][1]-cy));}
     trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
       new THREE.LineBasicMaterial({color:0x3ce87a,transparent:true,opacity:0.9})));
     R._drsAt=best.start/N;
   }}
  // start gantry
  {const sf2=fracXY(0.0015);
   const g2=new THREE.Group();
   const bar=new THREE.Mesh(new THREE.BoxGeometry(W*2.6,3,4),new THREE.MeshBasicMaterial({color:0x1c2436}));
   bar.position.y=26;g2.add(bar);
   for(const sx of[-W-4,W+4]){const leg=new THREE.Mesh(new THREE.BoxGeometry(3,26,3),
     new THREE.MeshBasicMaterial({color:0x1c2436}));leg.position.set(sx,13,0);g2.add(leg);}
   for(let i=0;i<5;i++){const l=new THREE.Mesh(new THREE.SphereGeometry(1.6),
     new THREE.MeshBasicMaterial({color:0x330a10}));l.position.set(-14+i*7,23,-2.2);g2.add(l);}
   g2.position.set(sf2[0],0,sf2[1]);
   const sf3=fracXY(0.004);
   g2.rotation.y=Math.atan2(sf3[0]-sf2[0],sf3[1]-sf2[1])+Math.PI/2;
   trackGroup.add(g2);}
  // horizon glow dome
  {const dome=new THREE.Mesh(new THREE.SphereGeometry(8600,24,12),
    new THREE.MeshBasicMaterial({color:0x0b1220,side:THREE.BackSide,transparent:true,opacity:0.9}));
   dome.position.y=-300;trackGroup.add(dome);}
  // pit lane: inner offset path from entry to exit
  const pp=[];
  {const steps=46;
   for(let k=0;k<=steps;k++){
     let f=T.pitEntry+(1-T.pitEntry+T.pitExit)*k/steps;f=((f%1)+1)%1;
     const [px,pz]=rawXY(f);
     const cx2=0,cz2=0; // toward centroid
     const dx=cx2-px,dz=cz2-pz,dl=Math.hypot(dx,dz)||1;
     const off=k===0||k===steps?W*1.2:W*2.6;
     pp.push(new THREE.Vector3(px+dx/dl*off,0.6,pz+dz/dl*off));}
   R._pitPath=pp;
   trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp),
     new THREE.LineBasicMaterial({color:0x3a4460})));
   // pit building + boxes
   const mid=pp[Math.floor(pp.length/2)];
   const bl=new THREE.Mesh(new THREE.BoxGeometry(170,16,20),
     new THREE.MeshBasicMaterial({color:0x141a28}));
   const midDir=pp[Math.floor(pp.length/2)+2].clone().sub(pp[Math.floor(pp.length/2)-2]);
   bl.position.copy(mid);bl.position.y=8;
   bl.rotation.y=Math.atan2(midDir.x,midDir.z);
   trackGroup.add(bl);
   for(let i=0;i<11;i++){
     const t2=0.30+i*0.038,idx=Math.floor(t2*pp.length);
     const bx=new THREE.Mesh(new THREE.PlaneGeometry(9,7),
       new THREE.MeshBasicMaterial({color:0x2a3350,side:THREE.DoubleSide}));
     bx.rotation.x=-Math.PI/2;bx.position.copy(pp[Math.min(idx,pp.length-1)]);bx.position.y=0.7;
     trackGroup.add(bx);}
  }
  // ground grid
  const gr=new THREE.GridHelper(9000,60,0x15202c,0x0d141d);
  gr.position.y=-2;trackGroup.add(gr);
  // cars
  for(const c of R.cars){
    const g=new THREE.Group();
    const hex='#'+c.color.toString(16).padStart(6,'0');
    const body=new THREE.Mesh(new THREE.BoxGeometry(11,5,26),
      new THREE.MeshBasicMaterial({color:c.color}));
    body.position.y=3;g.add(body);
    const gl2=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(hex),
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0.9}));
    gl2.scale.set(85,85,1);g.add(gl2);
    const lb=labelSprite(c.code,hex);lb.position.y=42;lb.visible=false;g.add(lb);
    g.userData={car:c,label:lb,body};
    trackGroup.add(g);carObjs.push(g);
  }
  // safety car
  const sg=new THREE.Group();
  sg.add(new THREE.Mesh(new THREE.BoxGeometry(12,6,26),
    new THREE.MeshBasicMaterial({color:0xf2f2f2})));
  const sgl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('#ffb020'),
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  sgl.scale.set(120,120,1);sg.add(sgl);
  sg.userData={glow:sgl};sg.visible=false;
  trackGroup.add(sg);scObj=sg;
  // rain
  const rp=new Float32Array(900*3);
  for(let i=0;i<900;i++){rp[i*3]=(Math.random()-0.5)*5000;rp[i*3+1]=Math.random()*1600;rp[i*3+2]=(Math.random()-0.5)*5000;}
  const rg=new THREE.BufferGeometry();
  rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
  rainPts=new THREE.Points(rg,new THREE.PointsMaterial({color:0x7fb8ff,size:3,
    transparent:true,opacity:0.0,sizeAttenuation:false,depthWrite:false}));
  trackGroup.add(rainPts);
}
function rawXY(f){
  const T=R.track;let lo=0,hi=T.N-1;const fr=((f%1)+1)%1;
  while(lo<hi){const m=(lo+hi)>>1;if(T.arc[m]<fr)lo=m+1;else hi=m;}
  const i=Math.max(lo-1,0),j=(i+1)%T.N;
  const f0=T.arc[i],f1=i+1<T.N?T.arc[i+1]:1;
  const k=f1>f0?(fr-f0)/(f1-f0):0;
  return [T.xy[i][0]*(1-k)+T.xy[j][0]*k-R._c[0],T.xy[i][1]*(1-k)+T.xy[j][1]*k-R._c[1]];
}
function fracXY(f){
  const T=R.track;
  // arc[] is fraction at each sample: binary search
  let lo=0,hi=T.N-1;
  const fr=((f%1)+1)%1;
  while(lo<hi){const m=(lo+hi)>>1;if(T.arc[m]<fr)lo=m+1;else hi=m;}
  const i=Math.max(lo-1,0),j=(i+1)%T.N;
  const f0=T.arc[i],f1=i+1<T.N?T.arc[i+1]:1;
  const k=f1>f0?(fr-f0)/(f1-f0):0;
  return [T.xy[i][0]*(1-k)+T.xy[j][0]*k-R._c[0],
          T.xy[i][1]*(1-k)+T.xy[j][1]*k-R._c[1]];
}
function updateScene(t){
  if(!scene)return;
  const order=ENGINE.runningOrder(R);
  const sel=window.__selCar;
  const redOrder=R.red.active?ENGINE.runningOrder(R):null;
  carObjs.forEach(g=>{
    const c=g.userData.car;
    if(c.retired){g.visible=false;return;}
    g.visible=true;
    if(R.red.active&&R._pitPath){                 // parked in the pit lane
      const i=Math.max(redOrder.indexOf(c),0);
      const p=R._pitPath[Math.min(10+i*1.6|0,R._pitPath.length-1)];
      g.position.set(p.x,0,p.z);g.userData.label.visible=false;return;}
    if(c.inPit&&R._pitPath){                      // drive the pit lane
      const prog=Math.max(0,Math.min(1,1-(c.pitT/(c.pitT0||24))));
      const p=R._pitPath[Math.floor(prog*(R._pitPath.length-1))];
      g.position.set(p.x,0.4,p.z);
      g.userData.label.visible=c.code===sel;return;}
    if(c.inPit){g.visible=false;return;}
    const [x,z]=fracXY(c.s);
    g.position.set(x,0,z);
    const [x2,z2]=fracXY(c.s+0.002);
    g.userData.body.rotation.y=Math.atan2(x2-x,z2-z);
    const rank=order.indexOf(c);
    const lb=g.userData.label;
    lb.visible=(rank>=0&&rank<3)||c.code===sel;
    if(lb.visible&&camera){const d=camera.position.distanceTo(g.position);
      const sc=Math.min(Math.max(d*0.062,20),150);lb.scale.set(sc,sc*0.37,1);
      if(camMode==='onboard'&&c.code===sel)lb.visible=false;}
  });
  if(R.sc.active){scObj.visible=true;
    const [x,z]=fracXY(R.sc.s);scObj.position.set(x,0,z);
    scObj.userData.glow.material.opacity=0.5+0.5*Math.sin(t*9);
  }else scObj.visible=false;
  // debris markers
  for(const d of R.debris){
    if(!debObjs[d.id]){
      const m=new THREE.Mesh(new THREE.OctahedronGeometry(9),
        new THREE.MeshBasicMaterial({color:0xff8b1a}));
      trackGroup.add(m);debObjs[d.id]=m;
    }
    const [x,z]=fracXY(d.s);
    debObjs[d.id].position.set(x,5+2*Math.sin(t*5),z);
    debObjs[d.id].rotation.y=t*2;
  }
  for(const id in debObjs)if(!R.debris.some(d=>String(d.id)===String(id))){
    trackGroup.remove(debObjs[id]);delete debObjs[id];}
  // weather visuals
  rainPts.material.opacity=Math.min(R.rain*1.2,0.85);
  if(R.rain>0.03){
    const p=rainPts.geometry.attributes.position;
    for(let i=0;i<p.count;i++){let y=p.getY(i)-26-R.rain*30;if(y<0)y=1600;p.setY(i,y);}
    p.needsUpdate=true;
  }
  const wet=R.wetness;
  scene.background.setRGB(0.027*(1-wet*0.5),0.031*(1-wet*0.4),0.051);
  // camera
  if(camMode==='tv'){tvCam(t);}
  else if(camMode==='orbit'){
    if(orb.auto)orb.th+=0.0011;
    camera.position.set(Math.sin(orb.ph)*Math.cos(orb.th)*orb.r,Math.cos(orb.ph)*orb.r,
                        Math.sin(orb.ph)*Math.sin(orb.th)*orb.r);
    camera.lookAt(0,0,0);
  }else if(camMode==='chase'&&order.length){
    const c=(window.__selCar&&R.cars.find(x=>x.code===window.__selCar&&!x.retired))||order[0];
    const [x,z]=fracXY(c.s),[x2,z2]=fracXY(c.s-0.006);
    camera.position.set(x2,110,z2);camera.lookAt(x,10,z);
  }else if(camMode==='onboard'&&window.__selCar){
    const c=R.cars.find(x=>x.code===window.__selCar);
    if(c&&!c.retired){const [x,z]=fracXY(c.s),[x2,z2]=fracXY(c.s+0.004);
      camera.position.set(x,26,z);camera.lookAt(x2,14,z2);}
  }else if(camMode==='top'){
    camera.position.set(0,4200,1);camera.lookAt(0,0,0);
  }
  renderer.render(scene,camera);
}

/* ================= UI ================= */
const TYCOL={S:'#ff6b6b',M:'#ffcf4d',H:'#e8e8e8',I:'#3ce87a',W:'#5aa0ff'};
function renderTower(){
  const order=ENGINE.runningOrder(R);
  const lead=order[0];const leadProg=lead?lead.lap+lead.s:0;
  const el=$('towerlist');el.innerHTML='';
  const all=[...order,...R.cars.filter(c=>c.retired)];
  all.forEach((c,i)=>{
    const row=document.createElement('div');
    row.className='trow mono'+(c.retired?' rt':'')+(window.__selCar===c.code?' sel':'');
    const gap=c.retired?'OUT':(i===0?'LEADER':'+'+((leadProg-(c.lap+c.s))*R.track.baseLap).toFixed(1));
    const st=c.inPit?'PIT':(c.punct?'PUNCT':(c.pitReq?'BOX':c.stops+' stop'));
    row.innerHTML=`<span class="p">${c.retired?'—':i+1}</span>`+
      `<span class="sw" style="background:#${c.color.toString(16).padStart(6,'0')}"></span>`+
      `<span class="cd">${c.code}</span><span class="gap">${gap}</span>`+
      `<span class="ty" style="color:${TYCOL[c.tyre]};border:1px solid ${TYCOL[c.tyre]}55">${c.tyre} ${Math.max(0,Math.round(100-c.wear))}%</span>`+
      `<span class="st" style="color:${c.inPit||c.pitReq?'var(--gold)':'var(--dim)'}">${st}</span>`;
    row.onclick=()=>{window.__selCar=window.__selCar===c.code?null:c.code;};
    el.appendChild(row);
  });
  const lg=lead?lead.lap+1:1;
  $('lapNow').textContent=Math.min(lg,R.laps);
}
function renderDeck(){
  const el=$('deckbody');
  if(document.querySelector('.fa-modal'))return;
  if(document.activeElement&&$('deck').contains(document.activeElement)
     &&['SELECT','INPUT'].includes(document.activeElement.tagName))return;
  if(R.mode==='tp'){
    $('deckTitle').textContent='STRATEGY — '+R.playerTeam.toUpperCase();
    el.innerHTML='';
    for(const c of R.cars.filter(c=>c.team===R.playerTeam)){
      const card=document.createElement('div');card.className='card2';
      const hex='#'+c.color.toString(16).padStart(6,'0');
      card.innerHTML=`<h4><span class="sw" style="width:5px;height:16px;border-radius:2px;background:${hex};display:inline-block"></span>
        <b>${c.code}</b> <span style="color:var(--dim)">${c.driver}</span>
        <span style="margin-left:auto;color:${TYCOL[c.tyre]}" class="mono">${TY()[c.tyre].name} · ${Math.max(0,Math.round(100-c.wear))}% life</span></h4>
        <div class="wearbar"><i style="width:${Math.max(0,100-c.wear)}%"></i></div>
        ${(()=>{const o=ENGINE.runningOrder(R),i=o.indexOf(c);
          if(i>0&&!c.retired){const ah=o[i-1];
            const gap=((ah.lap+ah.s)-(c.lap+c.s))*R.track.baseLap;
            const bh=o[i+1];
            if(bh&&!bh.inPit&&c.wear>42&&bh.wear<c.wear-15&&((c.lap+c.s)-(bh.lap+bh.s))*R.track.baseLap<R.track.pitLoss+6)
              return '<div style="font-size:11px;color:var(--gold)">⚠ UNDERCUT THREAT — '+bh.code+' on fresher tyres behind</div>';
            if(gap<R.track.pitLoss&&ah.wear>c.wear+14)
              return '<div style="font-size:11px;color:var(--green)">▲ UNDERCUT WINDOW — box now to jump '+ah.code+'</div>';}
          return '';})()}
        <div style="font-size:11.5px;color:var(--dim)" class="mono">last ${c.lastLapT?c.lastLapT.toFixed(2)+'s':'—'} · ${c.stops} stop${c.stops===1?'':'s'} · dmg ${(c.dmg*100)|0}%${c.punct?' · <b style="color:var(--red)">PUNCTURE</b>':''}${c.retired?' · <b style="color:var(--red)">OUT</b>':''}</div>
        <div class="btnrow">${[0,1,2].map(p=>`<button class="bx push ${c.push===p?'on':''}" data-cd="${c.code}" data-p="${p}">${['CONSERVE','NEUTRAL','ATTACK'][p]}</button>`).join('')}
          <button class="bx ${c.counter?'on':''}" data-cnt="${c.code}">🪞 COUNTER AHEAD</button>
          <button class="bx" data-foc="${c.code}">📷 FOCUS</button></div>
        <div class="btnrow">${c.pitReq?`<button class="bx on" data-cancel="${c.code}">BOXING → ${c.pitReq} (tap to cancel)</button>`:
          ['S','M','H','I','W'].map(k=>`<button class="bx ty${k}" data-box="${c.code}" data-ty="${k}">BOX ${k}</button>`).join('')}</div>`;
      el.appendChild(card);
    }
    el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>ENGINE.setPush(R,b.dataset.cd,+b.dataset.p));
    el.querySelectorAll('[data-box]').forEach(b=>b.onclick=()=>ENGINE.boxCar(R,b.dataset.box,b.dataset.ty));
    el.querySelectorAll('[data-cnt]').forEach(b=>b.onclick=()=>{
      const c=R.cars.find(x=>x.code===b.dataset.cnt);ENGINE.setCounter(R,b.dataset.cnt,!c.counter);});
    el.querySelectorAll('[data-foc]').forEach(b=>b.onclick=()=>{
      window.__selCar=b.dataset.foc;camMode='chase';
      document.querySelectorAll('#camsel button').forEach(x=>x.classList.toggle('on',x.dataset.c==='chase'));});
    el.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{
      const c=R.cars.find(x=>x.code===b.dataset.cancel);if(c&&!c.inPit)c.pitReq=null;});
    const ev=document.createElement('div');ev.className='card2';
    ev.innerHTML=`<h4>RACE EVENTS</h4><div style="font-size:11.5px">${
      (R.incidents||[]).slice(-5).reverse().map(i=>
        `<div style="margin-bottom:3px">L${i.lap} <b>${i.cars.join('/')}</b> — ${i.type}${i.penalised?` <span style="color:var(--gold)">+${i.secs}s</span>`:i.investigated?'':' · <i style="color:var(--gold)">IMA investigating</i>'}</div>`).join('')
      ||'<span style="color:var(--dim)">clean race</span>'}
      ${R.debris.length?`<div style="color:var(--gold);margin-top:4px">⚠ ${R.debris.length} debris field${R.debris.length>1?'s':''} on track</div>`:''}</div>`;
    el.appendChild(ev);
    const extra=document.createElement('div');extra.className='card2';
    const myPen=(R.incidents||[]).filter(i=>i.penalised&&!i.challenged&&R.cars.find(c=>c.code===i.cars[0]&&c.team===R.playerTeam));
    extra.innerHTML=`<h4>TEAM WALL</h4><div class="btnrow">
      <button class="bx" id="tOrder">🔁 TEAM ORDER: SWAP CARS</button>
      ${myPen.length?`<button class="bx" id="tChal">📻 CHALLENGE PENALTY (${myPen[0].cars[0]})</button>`:''}</div>`;
    el.appendChild(extra);
    $('tOrder').onclick=()=>{const r2=ENGINE.teamOrder(R,R.playerTeam,'swap');};
    const tc=$('tChal');
    if(tc)tc.onclick=()=>{const inc=myPen[0];inc.challenged=true;
      const ok=Math.random()<0.28;
      if(ok){ENGINE.reversePenalty(R,inc.cars[0],inc.secs||5);
        R.msgs.push({t:R.t,kind:'fia',text:`Race Control: on review, penalty for ${inc.cars[0]} is RESCINDED.`});}
      else R.msgs.push({t:R.t,kind:'fia',text:`Race Control: penalty for ${inc.cars[0]} STANDS. Noted for post-race review.`});};
  }else if(R.mode==='fia'){
    $('deckTitle').textContent='RACE EVENTS';
    const sig='E'+R.debris.map(d=>d.id).join(',')+'|'+R.incidents.length+'|'+R.marshals.length+'|'+(R.msgs.length&&0);
    const sel=$('penDrv')?$('penDrv').value:null;
    if(el.dataset.sig===sig&&sel!==null){
      // only refresh marshal countdowns
      el.querySelectorAll('[data-mt]').forEach(sp=>{
        const m=R.marshals.find(x=>String(x.debrisId)===sp.dataset.mt);
        if(m)sp.textContent='clearing… '+Math.ceil(m.timer)+'s';});
      return;
    }
    el.dataset.sig=sig;
    el.innerHTML=`
      <h4 style="margin:2px 0 8px;font-size:12px;letter-spacing:.2em;color:var(--gold)">DEBRIS ON TRACK</h4>
      <div id="deblist">${R.debris.length?'':'<div style="color:var(--dim);font-size:12.5px">Track is clean.</div>'}</div>
      <h4 style="margin:14px 0 8px;font-size:12px;letter-spacing:.2em;color:var(--vio)">STEWARDS</h4>
      <div class="btnrow"><select id="penDrv">${R.cars.map(c=>`<option>${c.code}</option>`).join('')}</select>
        <button class="bx" id="pen5">+5s</button><button class="bx" id="pen10">+10s</button>
        <button class="bx" id="penDT">DRIVE-THRU</button>
        <button class="bx" id="penBW">⬛⬜ B&W</button><button class="bx" id="penBO">🟠 B&O</button>
        <button class="bx" id="penBLK" style="color:var(--red)">⬛ BLACK FLAG</button></div>
      <h4 style="margin:12px 0 6px;font-size:12px;letter-spacing:.2em;color:var(--cyan)">INCIDENTS — click to rule</h4>
      <div style="font-size:11.5px">${(R.incidents||[]).slice(-6).reverse().map(i=>{
        const idx=R.incidents.indexOf(i);
        return `<div style="margin-bottom:4px">L${i.lap} <b>${i.cars.join('/')}</b> — ${i.type}
          ${i.penalised?' <span style=\'color:var(--gold)\'>✓ penalised</span>':i.ruled?' <span style=\'color:var(--dim)\'>no action</span>':
          `<button class="bx" data-rule="${idx}" style="padding:2px 8px;font-size:10px;margin-left:6px">⚖ RULE</button>`}</div>`;}).join('')
        ||'<span style="color:var(--dim)">clean race so far</span>'}</div>`;
    const dl=$('deblist');
    for(const d of R.debris){
      const m=R.marshals.find(m2=>m2.debrisId===d.id);
      const div=document.createElement('div');div.className='debitem'+(m?' clr':'');
      div.innerHTML=`⚠ Debris — Turn ${d.turn} · size ${(d.size*100)|0}%
        ${m?`<span style="margin-left:auto;color:var(--gold)" data-mt="${d.id}">clearing… ${Math.ceil(m.timer)}s</span>`
           :`<button data-deb="${d.id}">SEND MARSHALS</button>`}`;
      dl.appendChild(div);
    }
    if(sel&&$('penDrv'))$('penDrv').value=sel;
    const on=(id,fn)=>{const b=$(id);if(b)b.onclick=fn;};
    on('pen5',()=>ENGINE.givePenalty(R,$('penDrv').value,5,1,'race control'));
    on('pen10',()=>ENGINE.givePenalty(R,$('penDrv').value,10,2,'race control'));
    on('penDT',()=>ENGINE.driveThrough(R,$('penDrv').value));
    on('penBW',()=>ENGINE.blackWhite(R,$('penDrv').value));
    on('penBO',()=>ENGINE.blackOrange(R,$('penDrv').value));
    on('penBLK',async()=>{const code=$('penDrv').value;
      const v=await modal({title:'BLACK FLAG — '+code,html:'Disqualify this car from the race?',
        buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'DISQUALIFY',val:1,cls:'red'}]});
      if(v&&v.val)ENGINE.blackFlag(R,code);});
    el.querySelectorAll('[data-deb]').forEach(b=>b.onclick=()=>{
      const d=R.debris.find(x=>String(x.id)===b.dataset.deb);if(d)ENGINE.sendMarshals(R,d.id);});
    el.querySelectorAll('[data-rule]').forEach(b=>b.onclick=async()=>{
      const inc=R.incidents[+b.dataset.rule];if(!inc)return;
      const who=inc.cars.length>1?await modal({title:'STEWARDS — '+inc.type,
        html:`Lap ${inc.lap}: <b>${inc.cars.join(' vs ')}</b>. Who is at fault?`,
        buttons:inc.cars.map(c=>({label:c,val:c})).concat([{label:'RACING INCIDENT',val:null,cls:'grey'}])}):{val:inc.cars[0]};
      if(!who){inc.ruled=true;return;}
      if(who.val===null){inc.ruled=true;R.msgs.push({t:R.t,kind:'fia',text:`Stewards: ${inc.cars.join('/')} — racing incident, no further action.`});return;}
      const v=await modal({title:'PENALTY — '+who.val,html:`${inc.type}, lap ${inc.lap}`,
        buttons:[{label:'+5s · 1pt',val:5},{label:'+10s · 2pts',val:10},
                 {label:'DRIVE THROUGH (+20s) · 2pts',val:20},{label:'B&W warning',val:'bw'},{label:'No action',val:0,cls:'grey'}]});
      if(!v)return;inc.ruled=true;
      if(v.val==='bw')ENGINE.blackWhite(R,who.val);
      else if(v.val)ENGINE.givePenalty(R,who.val,v.val,v.val>=10?2:1,inc.type);
      else R.msgs.push({t:R.t,kind:'fia',text:`Stewards: no further action for ${who.val}.`});});
  }else{
    $('deckTitle').textContent='BROADCAST';
    el.innerHTML=`<div style="color:var(--dim);font-size:13px;line-height:1.7">AI teams strategise, AI race control governs.
      Overtakes <b class="mono">${R.stats.overtakes}</b> · Collisions <b class="mono">${R.stats.collisions}</b> ·
      Punctures <b class="mono">${R.stats.punctures}</b> · SC <b class="mono">${R.stats.scCount}</b> · VSC <b class="mono">${R.stats.vscCount}</b></div>`;
  }
}
function renderTicker(){
  const el=$('tickBody');
  const n=$('ticker').classList.contains('big')?40:3;
  el.innerHTML=R.msgs.slice(-n).reverse().map(m=>
    `<div class="m ${m.kind}"><b>${fmtT(m.t)}</b> ${m.text}</div>`).join('');
}
function fmtT(t){const m=(t/60)|0;return m+':'+String((t|0)%60).padStart(2,'0');}
let cmdSig='';
function renderCmdbar(){
  const cb=$('cmdbtns');if(!cb||!R)return;
  if(R.mode!=='fia'){
    const sig='x'+R.flag+R.sc.active;
    if(sig!==cmdSig){cmdSig=sig;
      cb.innerHTML=`<span style="font-size:11px;color:var(--dim);letter-spacing:.14em">IMA (AI): <b style="color:var(--cyan)">${R.flag==='SC'?'SAFETY CAR':R.flag}</b> · overtakes <b class="mono">${R.stats.overtakes}</b> · SC ×${R.stats.scCount}</span>`;}
    return;
  }
  const sig=[R.flag,R.sc.active,R.sc.phase,R.lappedMayPass,R.pitOpen===false,R.red.active].join('|');
  if(sig===cmdSig)return;cmdSig=sig;
  cb.innerHTML=`
    ${R.sc.active?'<button class="cb b-in" id="b_scin">SC IN THIS LAP</button>':'<button class="cb b-sc" id="b_sc">🚨 SAFETY CAR</button>'}
    ${R.flag==='VSC'?'<button class="cb b-in" id="b_vscend">END VSC</button>':'<button class="cb b-vsc" id="b_vsc">VSC</button>'}
    <button class="cb b-yel" id="b_yel">🟡 YELLOW</button>
    <button class="cb b-red" id="b_red">🔴 RED FLAG</button>
    <button class="cb b-grn" id="b_grn">🟢 GREEN</button>
    ${R.sc.active&&!R.lappedMayPass?'<button class="cb b-in" id="b_lap">LAPPED CARS OVERTAKE</button>':''}
    <span class="sep"></span>
    <button class="cb b-in" id="b_pit">${R.pitOpen===false?'OPEN PIT LANE':'CLOSE PIT LANE'}</button>
    <button class="cb b-in" id="b_chq">🏁 CHEQUERED</button>`;
  const on=(id,fn)=>{const b=$(id);if(b)b.onclick=fn;};
  on('b_sc',()=>ENGINE.deploySC(R,'race control'));
  on('b_scin',()=>ENGINE.scIn(R));
  on('b_vsc',()=>ENGINE.deployVSC(R));
  on('b_vscend',()=>ENGINE.endVSC(R));
  on('b_yel',()=>ENGINE.deployYellow(R,R.debris.length?ENGINE.sectorOf(R,R.debris[0].s):0));
  on('b_red',()=>ENGINE.redFlag(R));
  on('b_grn',async()=>{
    if(R.red&&R.red.active){
      const v=await modal({title:'🔴 RESTART PROCEDURE',
        html:'The field is held. How does this race resume?',
        buttons:[{label:'STANDING START — back to the grid',val:'standing'},
                 {label:'ROLLING START — behind the Safety Car',val:'rolling',cls:'grey'}]});
      ENGINE.resumeRed(R,v&&v.val?v.val:'rolling');
      if(v&&v.val==='standing')lightsOut();
      return;
    }
    ENGINE.greenFlag(R);});
  on('b_lap',()=>ENGINE.lappedOvertake(R));
  on('b_pit',()=>ENGINE.setPitOpen(R,R.pitOpen===false));
  on('b_chq',async()=>{const v=await modal({title:'CHEQUERED FLAG',
    html:'End the race at the conclusion of this lap?',
    buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'END THE RACE',val:1,cls:'red'}]});
    if(v&&v.val)ENGINE.chequered(R);});
}
function renderWeather(){
  const w=R.rain,wet=R.wetness;
  $('wxnow').textContent=w>0.6?'⛈ STORM':w>0.25?'🌧 RAIN':w>0.08?'🌦 DRIZZLE':'☀ DRY';
  $('wxtrack').textContent='track wet '+Math.round(wet*100)+'%';
  const fc=$('forecast');
  const fi=Math.min(Math.floor(R.t/120),R.forecast.length-1);
  fc.innerHTML=R.forecast.slice(fi,fi+12).map(v=>
    `<i style="height:${Math.max(v*26,2)}px;opacity:${0.4+v*0.6}"></i>`).join('');
}
function renderFlag(){
  const b=$('flagbanner');
  b.className='';b.classList.add(R.flag);
  b.textContent=R.flag==='SC'?'SAFETY CAR':R.flag==='VSC'?'VIRTUAL SC':R.flag;
}

/* ================= results + championship ================= */
async function podiumCeremony(){
  const top3=R.results.filter(r=>!r.retired).slice(0,3);
  if(top3.length<3)return;
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:69;background:rgba(4,5,10,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px';
  ov.innerHTML=`<div style="font-size:13px;letter-spacing:.4em;color:var(--gold)">PODIUM CEREMONY</div>
    <div style="display:flex;align-items:flex-end;gap:14px">
      ${[1,0,2].map(i=>{const r=top3[i];const h=[124,92,68][i];
        return `<div style="text-align:center">
          <div style="font-size:${i===1?26:19}px;font-weight:800;margin-bottom:8px;color:#fff">${r.code}</div>
          <div style="font-size:11px;color:var(--dim);margin-bottom:6px">${r.team}</div>
          <div style="width:92px;height:${h}px;background:linear-gradient(#232a3d,#141824);border:1px solid var(--line);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:var(--gold)">${r.pos}</div></div>`;}).join('')}
    </div>
    <div id="champagne"></div>
    <button class="pill on" id="podDone">CONTINUE ➜</button>`;
  document.body.appendChild(ov);
  try{sfx('go');setTimeout(()=>sfx('light'),350);setTimeout(()=>sfx('go'),700);}catch(e){}
  const ch=ov.querySelector('#champagne');
  for(let i=0;i<40;i++){const p=document.createElement('i');
    p.style.cssText=`position:fixed;left:${30+Math.random()*40}%;top:52%;width:5px;height:5px;border-radius:50%;
      background:${Math.random()<0.5?'#ffe9a3':'#cfe6ff'};pointer-events:none;
      animation:pop ${0.9+Math.random()*0.9}s ease-out ${Math.random()*0.6}s forwards`;
    ov.appendChild(p);}
  await new Promise(res=>{ov.querySelector('#podDone').onclick=()=>{ov.remove();res();};
    setTimeout(()=>{if(ov.parentNode){ov.remove();res();}},9000);});
}
async function maybeProtest(){
  if(!CAR||CFG.mode!=='tp'||GAMELEN!=='season')return;
  const pr=CAREER.fileProtest(CAR,R);
  if(!pr)return;
  const v=await modal({title:'⚖ LEGALITY PROTEST — '+pr.by,must:true,
    html:`${pr.by} protest your car's legality after ${pr.against} finished P${pr.pos}. The IMA convene a hearing. Your defence?`,
    buttons:[{label:'FULL TECHNICAL DISCLOSURE (safe — costs a little wind-tunnel time)',val:'disclose'},
             {label:'STONEWALL — reveal nothing (25% risk of DSQ)',val:'stonewall',cls:'red'}]});
  const out=CAREER.resolveProtest(CAR,R,pr,v?v.val:'disclose');
  if(out.dsq)await toast('VERDICT','<b style="color:var(--red)">DISQUALIFIED.</b> The results have been amended.');
}
async function showResults(){
  await podiumCeremony();
  await maybeProtest();
  showResultsInner();
}
function showResultsInner(){
  const res=R.results;
  $('resTitle').textContent='🏁 '+res[0].driver.toUpperCase()+' WINS THE '+R.track.name.toUpperCase()+' GP';
  $('resSub').textContent=`${R.laps} laps · ${R.stats.overtakes} overtakes · ${R.stats.collisions} collisions · SC ×${R.stats.scCount} · VSC ×${R.stats.vscCount}`;
  let h='<tr><th>P</th><th>DRIVER</th><th>TEAM</th><th>RESULT</th><th>STOPS</th><th>PTS</th></tr>';
  const t0=res[0].time;
  for(const r of res){
    h+=`<tr><td class="mono">${r.pos}</td><td><b style="color:#${r.color.toString(16).padStart(6,'0')}">${r.code}</b> ${r.driver}</td>
      <td>${r.team}</td><td class="mono">${r.retired?'DNF':(r.pos===1?fmtRace(r.time):'+'+(r.time-t0).toFixed(1)+'s')}</td>
      <td class="mono">${r.stops}</td><td class="mono"><b>${r.pts||''}</b></td></tr>`;
  }
  $('resTable').innerHTML=h;
  // championship table: career mode reads the career (resets each season); quick races show none
  let ds=[],ts=[];
  if(GAMELEN==='season'&&CAR){
    const st=CAREER.standings(CAR);
    ds=st.drivers.slice(0,10);ts=st.teams;
    $('champWrap').style.display='';
    $('champTitle').textContent=`CHAMPIONSHIP — ${CAR.year} · after round ${CAR.raceIdx}/${CAR.calendar.length}`;
  }else{
    $('champWrap').style.display='none';
  }
  let ch='<tr><th>DRIVERS</th><th>PTS</th><th style="padding-left:30px">CONSTRUCTORS</th><th>PTS</th></tr>';
  for(let i=0;i<Math.max(ds.length,ts.length);i++){
    ch+=`<tr><td>${ds[i]?ds[i][0]:''}</td><td class="mono"><b>${ds[i]?ds[i][1]:''}</b></td>
      <td style="padding-left:30px">${ts[i]?ts[i][0]:''}</td><td class="mono"><b>${ts[i]?ts[i][1]:''}</b></td></tr>`;
  }
  $('champTable').innerHTML=ch;
  $('results').classList.add('show');
}
function fmtRace(t){const h=(t/3600)|0,m=((t%3600)/60)|0;return `${h}:${String(m).padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;}
$('btnSave').onclick=()=>{
  const blob=new Blob([JSON.stringify(SEASON,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='apex_season.json';a.click();
};
$('btnAgain').onclick=()=>{$('results').classList.remove('show');showSetup(true);};
$('btnNext').onclick=()=>{
  $('results').classList.remove('show');
  if(GAMELEN==='season'&&CAR){
    if(CAR.raceIdx%23===0&&CAR.raceIdx>0)endOfSeason();
    else openHub();
    return;
  }
  const i=ENGINE.TRACKS.findIndex(t=>t.id===CFG.trackId);
  CFG.trackId=ENGINE.TRACKS[(i+1)%ENGINE.TRACKS.length].id;
  CFG.seed=(Math.random()*1e9)|0;
  startRace();
};
$('btnStewards').onclick=()=>{$('results').classList.remove('show');
  if(GAMELEN==='season'&&CAR)openHub();};
async function endOfSeason(){
  const se=CAREER.seasonEnd(CAR);
  let extra='';
  for(const rev of se.capReviews){
    if(CFG.mode==='fia'){
      const v=await modal({title:'COST CAP TRIBUNAL — '+rev.team,must:true,
        html:`Audit finds <b>$${rev.over.toFixed(1)}m over the cap</b>.<br>Their defence: <i>"unexpected inflation and catering costs."</i>`,
        buttons:[{label:'ACCEPT EXCUSE',val:'a'},{label:'MINOR BREACH: fine + ATR cut',val:'m'},{label:'MATERIAL: exclude constructors points',val:'x',cls:'red'}]});
      const c=v?v.val:'m';
      if(c==='a')CAREER.judgeCapBreach(CAR,rev.team,true);
      else CAREER.judgeCapBreach(CAR,rev.team,false,c==='m'?'minor':'material');
    }else{
      const acc=Math.random()<0.25;
      CAREER.judgeCapBreach(CAR,rev.team,acc,Math.random()<0.8?'minor':'material');
      if(rev.team===CFG.playerTeam)extra+=`<br><b style="color:var(--red)">⚠ Your breach: ${acc?'excuse accepted':'penalised'}.</b>`;
    }
  }
  const rv=se&&se.review;
  if(rv){
    await modal({title:`📊 ${rv.year} SEASON REPORT`,must:true,
      html:`<div style="font-size:12.5px;max-height:52vh;overflow:auto">
        <div style="font-size:16px;margin-bottom:6px">🏆 <b>${rv.champion||'—'}</b> — ${Math.round(rv.champPts)} pts</div>
        <b>TOP 3:</b> ${rv.top3.map(d=>d[0]+' ('+Math.round(d[1])+')').join(' · ')}<br>
        <b>CONSTRUCTORS:</b> ${rv.constructors.slice(0,5).map((t,i)=>(i+1)+'. '+t[0]).join(' · ')}<br><br>
        <b>ENGINE POWER RANKING</b>${rv.engines.map(e=>`<div class="mono" style="font-size:11.5px">${e.em} — ${e.perf}${e.banned?' <span style="color:var(--red)">BANNED</span>':''}${e.edt?' EDT×'+e.edt:''} · $${e.spend}m dev spend</div>`).join('')}
        <br><b>MARKET MOVES</b>${rv.marketMoves.map(m=>`<div style="font-size:11px;color:var(--dim)">• ${m}</div>`).join('')||'<div style="font-size:11px;color:var(--dim)">quiet year</div>'}
        <br><b>RECORDS:</b> ${rv.records.map(r2=>r2.text).join(' · ')||'—'}<br>
        <span style="color:var(--dim);font-size:11px">Cost cap $${rv.costCap}m · engine customer cap ${rv.customerCap}</span></div>`,
      buttons:[{label:'CONTINUE ➜',val:1}]});
  }
  if(CAR.electionDue){
    if(CFG.mode==='fia'){
      const v=await modal({title:'🗳 IMA PRESIDENTIAL ELECTION — your seat is on the line',must:true,
        html:`Reputation: <b>${(CAR.rep*100)|0}%</b>. The teams vote on your presidency. How do you play it?`,
        buttons:[{label:'RUN A CLEAN CAMPAIGN',val:'clean'},
                 {label:'PROMISE FAVOURS TO THE BACKMARKERS (+votes, 30% leak risk)',val:'favours',cls:'grey'},
                 {label:'RIG THE COUNT (guaranteed win… 25% scandal)',val:'rig',cls:'red'}]});
      const r=CAREER.runElection(CAR,'rc',v?v.val:'clean');
      await toast('ELECTION NIGHT',r.won?'<b style="color:var(--green)">You keep the presidency.</b>'+(r.scandal?'<br>…but the scandal will follow you.':'')
        :'<b style="color:var(--red)">DEFEATED.</b> A caretaker now rubber-stamps every vote — your FORCE and VETO powers are gone for 4 years.');
    }else{
      const v=await modal({title:'🗳 IMA PRESIDENTIAL ELECTION',must:true,
        html:'The hard-line incumbent vs a reformist challenger. Stricter audits, or a lighter touch? You hold one vote — and a chequebook.',
        buttons:[{label:'VOTE INCUMBENT (strict)',val:'incumbent'},
                 {label:'VOTE CHALLENGER (lenient)',val:'challenger'},
                 {label:'BACK CHALLENGER + $20m LOBBYING (20% scandal)',val:'lobby',cls:'red'}]});
      const ch=v?v.val:'challenger';
      const r=CAREER.runElection(CAR,'tp',{vote:ch==='lobby'?'challenger':ch,lobby:ch==='lobby'?20:0});
      if(r.scandal)await toast('SCANDAL','Your lobbying leaked. $15m fine and a reputation dent.');
    }
  }
  if(CAR.sacked&&CFG.mode==='tp'){
    CAR.sacked=false;
    const offers=Object.keys(CAR.teams).filter(t=>t!==CFG.playerTeam).filter(()=>Math.random()<0.3+CAR.rep*0.5);
    const v=await modal({title:'💼 YOU HAVE BEEN SACKED',must:true,
      html:offers.length?'The board have terminated your contract. But the paddock talks — offers are in:':'The board have terminated your contract. No offers yet… you take a sabbatical and return to your old post (they couldn\'t find anyone better).',
      buttons:offers.length?offers.map(t=>({label:'JOIN '+t,val:t})).concat([{label:'RETIRE TO THE COMMENTARY BOX',val:'retire',cls:'grey'}]):[{label:'CARRY ON',val:0}]});
    if(v&&v.val==='retire'){goMainMenu();return;}
    if(v&&v.val&&v.val!=='retire'&&CAR.teams[v.val]){CFG.playerTeam=v.val;CAR.playerTeamHint=v.val;
      await toast('NEW CHAPTER','You take over at '+v.val+'. Prove them all wrong.');}
  }
  if(CFG.mode==='tp')CAREER.setBoardTarget(CAR,CFG.playerTeam);
  await toast('SEASON COMPLETE',`🏆 <b>${CAR.history[CAR.history.length-1].champion}</b> is WORLD CHAMPION ${CAR.year-1}!<br>Prize money paid · wind-tunnel time reallocated (leaders get least).${extra}`);
  store('ra_career',CAREER.save(CAR));
  openHub();
}

/* ================= flow ================= */
function showSetup(back){
  $('setup').style.display='';
  document.querySelectorAll('.hud').forEach(h=>h.style.display='none');
  if(back)document.querySelectorAll('.tk').forEach(x=>x.classList.toggle('on',x.dataset.t===CFG.trackId));
}
function goMainMenu(){R=null;document.querySelectorAll('.hud').forEach(h=>h.style.display='none');
  $('hub').style.display='none';$('results').classList.remove('show');showSetup(true);}
function renameTeamEverywhere(oldN,newN){
  if(!newN||oldN===newN)return;
  for(const g2 of ENGINE.GRID)if(g2[2]===oldN)g2[2]=newN;
  for(const em in ENGINE.ENGINES){const i=ENGINE.ENGINES[em].teams.indexOf(oldN);
    if(i>=0)ENGINE.ENGINES[em].teams[i]=newN;}
  if(CAR){
    if(CAR.teams[oldN]){CAR.teams[newN]=CAR.teams[oldN];delete CAR.teams[oldN];}
    for(const code in CAR.drivers)if(CAR.drivers[code].team===oldN)CAR.drivers[code].team=newN;
    if(CAR.teamPts[oldN]!=null){CAR.teamPts[newN]=CAR.teamPts[oldN];delete CAR.teamPts[oldN];}
    if(CAR.playerTeamHint===oldN)CAR.playerTeamHint=newN;
  }
  if(CFG.playerTeam===oldN)CFG.playerTeam=newN;
}
async function nameEditor(){
  const cat=await modal({title:'✏ EDIT NAMES — make this universe yours',
    html:'Every name is editable — changes apply everywhere: races, career, saves.',
    buttons:[{label:'TEAMS',val:'t'},{label:'DRIVERS',val:'d'},{label:'TRACKS',val:'k'},{label:'DONE',val:0,cls:'grey'}]});
  if(!cat||!cat.val)return;
  if(cat.val==='t'){
    const teams=[...new Set(ENGINE.GRID.map(g2=>g2[2]))];
    const v=await modal({title:'TEAM NAMES',fields:teams.map((t,i)=>({k:'t'+i,label:t,type:'text',def:t})),
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'APPLY',val:1}]});
    if(v&&v.val)teams.forEach((t,i)=>renameTeamEverywhere(t,(v.fields['t'+i]||t).trim()||t));
  }else if(cat.val==='d'){
    const v=await modal({title:'DRIVER NAMES',fields:ENGINE.GRID.map((g2,i)=>({k:'d'+i,label:g2[0],type:'text',def:g2[1]})),
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'APPLY',val:1}]});
    if(v&&v.val)ENGINE.GRID.forEach((g2,i)=>{const n=(v.fields['d'+i]||'').trim();
      if(n){g2[1]=n;if(CAR&&CAR.drivers[g2[0]])CAR.drivers[g2[0]].name=n;}});
  }else{
    const v=await modal({title:'TRACK NAMES',fields:ENGINE.TRACKS.map((t,i)=>({k:'k'+i,label:t.id,type:'text',def:t.name})),
      buttons:[{label:'CANCEL',val:0,cls:'grey'},{label:'APPLY',val:1}]});
    if(v&&v.val)ENGINE.TRACKS.forEach((t,i)=>{const n=(v.fields['k'+i]||'').trim();if(n)t.name=n;});
  }
  return nameEditor();
}
async function scenarioMenu(){
  const v=await modal({title:'🎬 SCENARIO MODE — rewrite history',
    html:'Drop into infamous situations. Your call this time.',
    buttons:[{label:'THE YAS ISLAND DECIDER — you are Race Control, SC out, 5 laps left, title rivals P1-P2',val:'ad21'},
             {label:'MONTE CARLO RAIN GAMBLE — Team Principal, rain coming, your cars P1 & P4',val:'mon'},
             {label:'SÃO PAULO STORM — Team Principal, storm mid-race, chaos guaranteed',val:'braz'},
             {label:'BACK',val:0,cls:'grey'}]});
  if(!v||!v.val)return;
  GAMELEN='quick';
  if(v.val==='ad21'){
    CFG.mode='fia';startRace({trackId:'yas',laps:58,weather:'dry',seed:2121});
    setTimeout(()=>{ if(!R)return;
      const o=ENGINE.runningOrder(R);
      R.cars.forEach((c,i)=>{c.lap=53;c.s=0.5-o.indexOf(c)*0.004;c.wear=o.indexOf(c)===0?62:(o.indexOf(c)===1?12:35);
        c.tyre=o.indexOf(c)===1?'S':'H';c.launched=true;});
      R.startT=0;R._fieldAway=true;
      ENGINE.deploySC(R,'late crash');
      R.msgs.push({t:R.t,kind:'fia',text:'SCENARIO: Safety car with 5 to go. The championship rivals run P1-P2. Every decision is yours.'});
    },900);
  }else if(v.val==='mon'){
    CFG.mode='tp';startRace({trackId:'monaco',laps:64,weather:'mixed',seed:777});
    setTimeout(()=>{if(!R)return;
      R.cars.forEach(c=>{c.lap=32;c.launched=true;});R.startT=0;R._fieldAway=true;
      R.forecast=R.forecast.map((f,i)=>i>1?0.7:f);
      R.msgs.push({t:R.t,kind:'pit',text:'SCENARIO: Radar says heavy rain in ~4 minutes. Inters early, or hold?'});},900);
  }else{
    CFG.mode='tp';startRace({trackId:'interlagos',laps:60,weather:'storm',seed:1212});
  }
}
async function navMenu(){
  const inRace=R&&!R.finished;
  const v=await modal({title:'RACE AUTHORITY',html:inRace?'Race in progress.':'',
    buttons:[{label:'▶ RESUME',val:'r',cls:'grey'},
             ...(GAMELEN==='season'&&CAR?[{label:'🏠 MY HUB'+(CFG.mode==='fia'?' (RACE CONTROL)':CFG.mode==='tp'?' (TEAM)':''),val:'h'}]:[]),
             {label:'🏁 MAIN MENU',val:'m',cls:'red'}]});
  if(!v||v.val==='r')return;
  if(inRace){
    const c=await modal({title:'ABANDON RACE?',html:'The session will be lost — no points scored.',
      buttons:[{label:'KEEP RACING',val:0,cls:'grey'},{label:'ABANDON',val:1,cls:'red'}]});
    if(!c||!c.val)return;
  }
  if(v.val==='h'){R=null;document.querySelectorAll('.hud').forEach(h=>h.style.display='none');
    $('results').classList.remove('show');openHub();}
  else goMainMenu();
}
function wireChrome(){
  if(window.__chromeWired)return;window.__chromeWired=true;
  document.querySelectorAll('.navBtn').forEach(b=>b.onclick=navMenu);
  $('btnExit').onclick=navMenu;
  $('btnSkip').onclick=nextEvent;
  $('btnSim').onclick=async()=>{
    if(!R||R.finished)return;
    const v=await modal({title:'⚡ SIMULATE TO THE FLAG',
      html:'The AI plays out the rest of the race instantly. In Team Principal mode your current strategies stay set.',
      buttons:[{label:'KEEP RACING',val:0,cls:'grey'},{label:'SIM TO THE END',val:1}]});
    if(!v||!v.val)return;
    R.autopilot=true;
    let g2=0;while(!R.finished&&g2++<4e5)ENGINE.step(R,0.25);
  };
  $('btnSnd').onclick=()=>{SND=!SND;$('btnSnd').textContent=SND?'🔊':'🔇';};
  $('tickHead').onclick=()=>$('ticker').classList.toggle('big');
  $('twCol').onclick=e=>{e.stopPropagation();$('towerlist').style.display=$('towerlist').style.display==='none'?'':'none';};
  $('dkCol').onclick=e=>{e.stopPropagation();$('deckbody').style.display=$('deckbody').style.display==='none'?'':'none';};
}
function startRace(extra={}){
  wireChrome();
  R=ENGINE.createRace({...CFG,...extra});
  window.APEX={get race(){return R;},ENGINE};
  $('setup').style.display='none';
  document.querySelectorAll('.hud').forEach(h=>h.style.display='');
  $('lapTot').textContent=R.laps;
  $('trackName').textContent=R.track.name;
  window.__selCar=null;SPEED=1;accum=0;
  document.querySelectorAll('#speedctl button').forEach(b=>
    b.classList.toggle('on',b.dataset.s==='1'));
  buildScene();cmdSig='';lastOrder=[];battle=null;TV={target:null,until:0};lastMsgN=0;
  audioInit();
  renderDeck();renderTower();renderFlag();renderWeather();renderCmdbar();
  msgBoot();
  lightsOut();
}
function msgBoot(){R.msgs.push({t:0,kind:'fia',text:`Lights out at ${R.track.name} — ${R.laps} laps. ${R.mode==='fia'?'You are Race Control.':R.mode==='tp'?'You run '+R.playerTeam+'.':'Broadcast mode.'}`});}
document.querySelectorAll('#speedctl button').forEach(b=>b.onclick=()=>{
  SPEED=+b.dataset.s;
  document.querySelectorAll('#speedctl button').forEach(x=>x.classList.toggle('on',x===b));});
document.querySelectorAll('#camsel button').forEach(b=>b.onclick=()=>{
  camMode=b.dataset.c;orb.auto=camMode==='orbit';
  document.querySelectorAll('#camsel button').forEach(x=>x.classList.toggle('on',x===b));});

/* ================= broadcast: TV director, battles, spotlight, sfx ================= */
let TV={target:null,until:0,mode:'battle'},lastOrder=[],battle=null;
function hottestStory(t){
  const order=ENGINE.runningOrder(R).filter(c=>!c.inPit&&!c.retired&&!c.done);
  // incidents & flags first
  if(R.sc.active)return{mode:'sc',car:order[0]};
  if(R.debris.length&&Math.random()<0.3)return{mode:'debris',deb:R.debris[0]};
  // closest battle in the field, weighted to the front
  let best=null,bestScore=99;
  for(let i=1;i<Math.min(order.length,14);i++){
    const gap=((order[i-1].lap+order[i-1].s)-(order[i].lap+order[i].s))*R.track.baseLap;
    const score=gap+i*0.14;
    if(gap<2.2&&score<bestScore){bestScore=score;best={mode:'battle',a:order[i-1],b:order[i],gap,pos:i};}
  }
  if(best)return best;
  return{mode:'leader',car:order[0]};
}
function tvCam(t){
  if(t<TV.until&&TV.target){
    const c=TV.target;
    if(!c.retired&&!c.inPit){
      const [x,z]=fracXY(c.s),[x2,z2]=fracXY(c.s+0.008);
      const [bx,bz]=fracXY(c.s-0.0035);
      camera.position.set(bx+(x2-x)*0.3,42+TV.h,bz+(z2-z)*0.3);
      camera.lookAt(x2,6,z2);
      return;
    }
  }
  const st=hottestStory(t);
  TV.until=t+7+Math.random()*4;TV.h=Math.random()*70;
  if(st.mode==='battle'){TV.target=st.b;battle=st;}
  else if(st.mode==='debris'){TV.target=null;battle=null;
    const [x,z]=fracXY(st.deb.s);camera.position.set(x+160,120,z+160);camera.lookAt(x,0,z);TV.until=t+4;}
  else {TV.target=st.car;battle=null;}
}
function renderSpotlight(){
  const el=$('spot');if(!el)return;
  const order=ENGINE.runningOrder(R);
  if(battle&&!battle.a.retired&&!battle.b.retired&&!battle.a.done){
    const gap=((battle.a.lap+battle.a.s)-(battle.b.lap+battle.b.s))*R.track.baseLap;
    if(gap<2.6&&gap>0){
      el.style.display='';
      el.innerHTML=`<span class="sp-p">BATTLE FOR P${order.indexOf(battle.a)+1}</span>
        <b style="color:#${battle.a.color.toString(16).padStart(6,'0')}">${battle.a.code}</b>
        <span class="sp-gap mono">${gap.toFixed(1)}s</span>
        <b style="color:#${battle.b.color.toString(16).padStart(6,'0')}">${battle.b.code}</b>
        ${gap<1.0?'<span class="drs">DRS</span>':''}`;
      return;
    }
  }
  el.style.display='none';
}
function positionFlashes(){
  const order=ENGINE.runningOrder(R).map(c=>c.code);
  if(lastOrder.length){
    order.forEach((code,i)=>{
      const prev=lastOrder.indexOf(code);
      if(prev>=0&&prev!==i){
        const row=[...document.querySelectorAll('#towerlist .trow .cd')].find(x=>x.textContent===code);
        if(row){const tr=row.closest('.trow');
          tr.classList.remove('up','down');void tr.offsetWidth;
          tr.classList.add(i<prev?'up':'down');
          if(i<prev&&i<5)sfx('overtake');}
      }});
  }
  lastOrder=order;
}
/* ---- synthesized sound (no assets) ---- */
let AC=null,engOsc=null,engGain=null,SND=true;
function audioInit(){
  if(AC)return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    engOsc=AC.createOscillator();engOsc.type='sawtooth';
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=320;
    engGain=AC.createGain();engGain.gain.value=0.0;
    engOsc.connect(f);f.connect(engGain);engGain.connect(AC.destination);
    engOsc.start();
  }catch(e){AC=null;}
}
function sfx(kind){
  if(!AC||!SND)return;
  try{
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);
    const t=AC.currentTime;
    if(kind==='radio'){o.type='square';o.frequency.value=1250;g.gain.setValueAtTime(0.05,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.09);}
    else if(kind==='alert'){o.type='sawtooth';o.frequency.setValueAtTime(520,t);o.frequency.linearRampToValueAtTime(240,t+0.35);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);}
    else if(kind==='overtake'){o.type='triangle';o.frequency.setValueAtTime(600,t);o.frequency.linearRampToValueAtTime(950,t+0.12);g.gain.setValueAtTime(0.07,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.16);}
    else if(kind==='light'){o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.14);}
    else if(kind==='go'){o.type='sine';o.frequency.value=1320;g.gain.setValueAtTime(0.14,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);}
    o.start(t);o.stop(t+0.6);
  }catch(e){}
}
let lastMsgN=0;
function audioTick(){
  if(!AC||!R)return;
  try{
    const focus=TV.target||ENGINE.runningOrder(R)[0];
    const v=focus?focus.v:0;
    engOsc.frequency.setTargetAtTime(40+v*2.1,AC.currentTime,0.15);
    engGain.gain.setTargetAtTime(R.finished||SPEED===0||!SND?0:0.045,AC.currentTime,0.2);
    if(R.msgs.length>lastMsgN){
      const m=R.msgs[R.msgs.length-1];
      if(m.kind==='radio')sfx('radio');
      else if(m.kind==='alert')sfx('alert');
      else if(m.kind==='fia'&&/SAFETY CAR|RED FLAG/.test(m.text))sfx('alert');
      lastMsgN=R.msgs.length;
    }
  }catch(e){}
}
/* ---- lights out ---- */
async function lightsOut(){
  const el=$('lights');if(!el)return;
  el.style.display='flex';el.innerHTML='';
  SPEED=0;
  let greenAt=null,launched=false;
  const myCodes=(CFG.mode==='tp'&&R)?R.cars.filter(c=>c.team===R.playerTeam).map(c=>c.code):[];
  if(myCodes.length){
    const lb=document.createElement('button');
    lb.id='launchBtn';lb.textContent='LAUNCH';lb.className='colBtn';
    lb.style.cssText='position:fixed;bottom:18vh;left:50%;transform:translateX(-50%);z-index:75;padding:16px 44px;font-size:20px;font-weight:800;color:var(--green);border-color:var(--green)';
    document.body.appendChild(lb);
    lb.onclick=()=>{
      if(launched)return;launched=true;
      const delta=greenAt===null?-1:(performance.now()-greenAt);
      let res;
      for(const code of myCodes)res=ENGINE.playerLaunch(R,code,delta).result;
      lb.textContent=res==='jump'?'JUMP START! +10s':res==='mega'?'MEGA START!':res==='antistall'?'ANTI-STALL!':'AWAY';
      lb.style.color=res==='jump'?'var(--red)':'var(--green)';
      setTimeout(()=>lb.remove(),1400);
    };
  }
  for(let i=0;i<5;i++){const d=document.createElement('i');el.appendChild(d);
    await new Promise(r=>setTimeout(r,650));d.classList.add('on');sfx('light');}
  await new Promise(r=>setTimeout(r,500+Math.random()*900));
  el.querySelectorAll('i').forEach(d=>d.classList.remove('on'));sfx('go');
  greenAt=performance.now();
  setTimeout(()=>{const lb=$('launchBtn');if(lb&&!launched){launched=true;lb.remove();}},2500);
  R.msgs.push({t:0,kind:'fia',text:"IT'S LIGHTS OUT AND AWAY WE GO!"});
  setTimeout(()=>el.style.display='none',600);
  SPEED=2;
  document.querySelectorAll('#speedctl button').forEach(b=>b.classList.toggle('on',b.dataset.s==='2'));
}
/* ---- skip to next event ---- */
function nextEvent(){
  if(!R||R.finished)return;
  const deb0=R.debris.length,inc0=R.incidents.length,flag0=R.flag,sc0=R.sc.active;
  let guard=0;
  const order0=ENGINE.runningOrder(R).slice(0,6).map(c=>c.code).join('');
  while(guard++<14000&&!R.finished){
    ENGINE.step(R,0.25);
    if(R.incidents.length>inc0||R.debris.length>deb0||R.flag!==flag0||R.sc.active!==sc0)break;
    const o=ENGINE.runningOrder(R);
    if(o.length>1){
      const g=((o[0].lap+o[0].s)-(o[1].lap+o[1].s))*R.track.baseLap;
      let mn=9;for(let i=1;i<Math.min(o.length,10);i++){
        const gg=((o[i-1].lap+o[i-1].s)-(o[i].lap+o[i].s))*R.track.baseLap;if(gg<mn)mn=gg;}
      if(mn<0.65)break;
      if(o.slice(0,6).map(c=>c.code).join('')!==order0)break;
      if(R.laps-o[0].lap<=2)break;
    }
  }
  TV.until=0;
  R.msgs.push({t:R.t,kind:'fia',text:'⏩ …picking up the action'});
}
let nextRadioT=120;
function radioQA(){
  if(!R||R.mode!=='tp'||R.finished||R.autopilot)return;
  if(R.t<nextRadioT)return;
  nextRadioT=R.t+100+Math.random()*80;
  const mine=R.cars.filter(c=>c.team===R.playerTeam&&!c.retired&&!c.done);
  if(!mine.length)return;
  const c=mine[Math.floor(Math.random()*mine.length)];
  let q,opts;
  if(c.temp>0.8){q=`${c.code}: "Temps are climbing, I'm cooking back here. What's the plan?"`;
    opts=[['Back off, cool the car',()=>{ENGINE.setFuel(R,c.code,0);bumpMorale(c.code,0.01);}],
          ['Stay in the fight',()=>{bumpMorale(c.code,-0.01);}]];}
  else if(c.wear>60){q=`${c.code}: "These tyres are DEAD. Plan B?"`;
    opts=[['Box this lap',()=>{ENGINE.boxCar(R,c.code,R.wetness>0.3?'I':'M');bumpMorale(c.code,0.02);}],
          ['Extend — trust me',()=>{bumpMorale(c.code,-0.015);}]];}
  else{q=`${c.code}: "Where am I losing time? Talk to me."`;
    opts=[['Sector 2 — hit your marks',()=>bumpMorale(c.code,0.01)],
          ['You\'re doing great, keep it up',()=>bumpMorale(c.code,0.02)]];}
  const card=document.createElement('div');card.className='card2';card.id='radioQA';
  card.style.cssText='border-color:var(--cyan);animation:pulse 2s infinite';
  card.innerHTML=`<h4 style="color:var(--cyan)">📻 RADIO</h4><div style="font-size:12px;margin-bottom:6px">${q}</div>
    <div class="btnrow">${opts.map((o,i)=>`<button class="bx" data-qa="${i}">${o[0]}</button>`).join('')}</div>`;
  const deck=$('deck');deck.insertBefore(card,deck.firstChild.nextSibling);
  card.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>{opts[+b.dataset.qa][1]();card.remove();sfx('radio');});
  setTimeout(()=>{if(card.parentNode)card.remove();},22000);
  sfx('radio');
}
function bumpMorale(code,d){if(CAR&&CAR.drivers[code])CAR.drivers[code].morale=Math.max(0,Math.min(1,CAR.drivers[code].morale+d));}
/* ---- weather radar minimap ---- */
function drawRadar(){
  const cv=$('radar');if(!cv||!R)return;
  let ctx=null;try{ctx=cv.getContext('2d');}catch(e){}if(!ctx)return;ctx.clearRect(0,0,90,90);
  const T=R.track,N=T.N;
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(const [x,y] of T.xy){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
  const sc=76/Math.max(maxx-minx,maxy-miny);
  const px=i=>7+((T.xy[i][0]-minx)*sc),py=i=>7+((T.xy[i][1]-miny)*sc);
  // rain shading per sector
  for(let sec=0;sec<3;sec++){
    const w=R.sectorRain[sec];if(w<0.05)continue;
    ctx.strokeStyle=`rgba(70,140,255,${Math.min(w,1)*0.9})`;ctx.lineWidth=5;
    ctx.beginPath();
    for(let i=Math.floor(sec/3*N);i<Math.floor((sec+1)/3*N);i+=2){
      i===Math.floor(sec/3*N)?ctx.moveTo(px(i),py(i)):ctx.lineTo(px(i),py(i));}
    ctx.stroke();
  }
  ctx.strokeStyle='rgba(200,210,230,0.8)';ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<N;i+=2)i===0?ctx.moveTo(px(i),py(i)):ctx.lineTo(px(i),py(i));
  ctx.closePath();ctx.stroke();
  // storm cell marker
  if(R.rain>0.1){const ci=Math.floor(R.cell.pos*N)%N;
    ctx.fillStyle='rgba(90,160,255,0.9)';
    ctx.beginPath();ctx.arc(px(ci),py(ci),4,0,7);ctx.fill();}
}
/* ================= main loop ================= */
function loop(now){
  requestAnimationFrame(loop);
  const t=now/1000;
  const dtw=Math.min(t-(wallT||t),0.1);wallT=t;
  if(R&&!R.finished){
    accum+=dtw*4*SPEED;                     // engine dt 0.25 → 4 steps = 1 s race time
    let n=Math.min(accum|0,260);accum-=n;
    while(n--)ENGINE.step(R,0.25);
  }
  if(R&&R.finished&&!R._shown){R._shown=true;renderTower();
    if(GAMELEN==='season'&&CAR){window.__lastRace=R;CAREER.postRace(CAR,R);store('ra_career',CAREER.save(CAR));}
    showResults();
  }
  if(R&&t-uiT>0.25){uiT=t;
    renderTower();renderTicker();renderWeather();renderFlag();renderCmdbar();
    renderSpotlight();positionFlashes();radioQA();drawRadar();
    if(!$('results').classList.contains('show'))renderDeck();
  }
  audioTick();
  if(R)updateScene(t);
}
buildSetup();
init3D();
requestAnimationFrame(loop);
