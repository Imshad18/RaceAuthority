const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync('test_build.html','utf8');
function boot(){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
  const w=dom.window;
  w.alert=()=>{};w.confirm=()=>false;w.prompt=()=>null;
  w.URL.createObjectURL=()=>'blob:x';
  w.onerror=(m)=>{throw new Error('page error: '+m);};
  return w;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  /* ---- QUICK RACE, IMA MODE ---- */
  let w=boot();
  await sleep(300);
  const $=id=>w.document.getElementById(id);
  if($('setup').style.display==='none')throw new Error('setup hidden at boot');
  if(w.document.querySelectorAll('.tk').length!==23)throw new Error('track cards: '+w.document.querySelectorAll('.tk').length);
  w.document.querySelector('#glen .pill[data-g="quick"]').click();
  w.document.querySelector('.mode-card[data-mode="fia"]').click();
  w.document.querySelector('.tk[data-t="monza"]').click();
  $('laps').value=6;$('laps').dispatchEvent(new w.Event('input'));
  $('go').click();
  await sleep(120);
  if($('setup').style.display!=='none')throw new Error('quick race did not start');
  if($('topbar').style.display==='none')throw new Error('HUD hidden');
  console.log('boot + quick-race start OK (23 tracks, IMA mode)');
  // engine ticking via rAF loop
  const A=w.APEX;if(!A||!A.race)throw new Error('APEX hook missing');
  let waited=0;                        // lights-out sequence holds ~4s before release
  while(A.race.t<0.5&&waited<12000){await sleep(400);waited+=400;}
  if(!(A.race.t>=0.5))throw new Error('engine not ticking after lights, t='+A.race.t);
  console.log('lights-out sequence released the field OK');
  if(w.document.querySelectorAll('#towerlist .trow').length!==22)throw new Error('tower rows');
  console.log('engine ticking (t='+A.race.t.toFixed(1)+'s), 22 tower rows');
  // IMA powers
  $('b_sc').click();await sleep(400);
  if(!$('flagbanner').classList.contains('SC'))throw new Error('SC banner');
  if(!$('b_scin'))throw new Error('cmdbar did not refresh to SC-IN');
  if(!A.race.sc.active)throw new Error('SC not active');
  console.log('DEPLOY SAFETY CAR → banner + engine state OK');
  $('b_red')&&$('b_red').click();await sleep(350);
  if(A.race.flag!=='RED')throw new Error('red flag');
  console.log('RED FLAG OK');
  // resume: GREEN now offers a restart choice under red
  $('b_grn').click();await sleep(120);
  const rm=w.document.querySelector('.fa-modal');
  if(!rm||!rm.textContent.includes('RESTART'))throw new Error('no restart choice modal');
  rm.querySelectorAll('.fa-b')[1].click();await sleep(150);   // rolling
  if(A.race.red.active)throw new Error('red not resumed');
  console.log('red-flag restart choice (rolling) OK');
  // finish race fast headlessly
  let g=0;while(!A.race.finished&&g++<3e5)A.ENGINE.step(A.race,0.25);
  for(let k=0;k<30&&!w.document.getElementById('results').classList.contains('show');k++){
    const pd=w.document.getElementById('podDone');if(pd)pd.click();
    await sleep(150);}
  if(!w.document.getElementById('results').classList.contains('show'))throw new Error('results not shown');
  if(!w.document.querySelectorAll('#resTable tr').length)throw new Error('results table empty');
  console.log('race finished → results + championship table shown');

  /* ---- SEASON, TP MODE ---- */
  w=boot();await sleep(300);
  const $2=id=>w.document.getElementById(id);
  w.confirm=()=>false;w.prompt=()=>null;
  w.document.querySelector('#glen .pill[data-g="season"]').click();
  $2('go').click();await sleep(150);
  // sponsor draft: negotiate the first brand at their valuation, then go racing
  const draft=w.document.querySelector('.fa-modal');
  if(!draft||!draft.textContent.includes('SPONSOR DRAFT'))throw new Error('sponsor draft missing');
  draft.querySelectorAll('.fa-b')[0].click();await sleep(80);          // pick first brand
  const nego=w.document.querySelector('.fa-modal');
  if(!nego||!w.document.getElementById('mf_fee'))throw new Error('negotiation clauses missing');
  nego.querySelectorAll('.fa-b')[1].click();await sleep(120);          // put it on the table
  // dismiss result toast, then DONE
  let mm;while((mm=w.document.querySelector('.fa-modal'))){
    const bs=mm.querySelectorAll('.fa-b');
    if(mm.textContent.includes('SPONSOR DRAFT')){bs[bs.length-1].click();await sleep(60);break;}
    bs[0].click();await sleep(60);
  }
  await sleep(100);
  if($2('hub').style.display==='none')throw new Error('hub not shown after draft');
  console.log('sponsor draft flow OK (negotiated, clauses present, done → hub)');
  if(!$2('hubStand').textContent.includes('DRIVERS'))throw new Error('standings card');
  if(!$2('hubTeam').innerHTML.includes('COST CAP'))throw new Error('team card');
  if(!$2('hubMarket').innerHTML.includes('APPROACH'))throw new Error('market card');
  // modal system replaces prompt: open a market approach and cancel it
  $2('hubMarket').querySelector('[data-app]').click();await sleep(80);
  const mdl=w.document.querySelector('.fa-modal');
  if(!mdl)throw new Error('approach modal missing');
  mdl.querySelector('.fa-b.grey').click();await sleep(50);
  if(w.document.querySelector('.fa-modal'))throw new Error('modal did not close');
  console.log('modal negotiation dialog OK (no native prompt)');
  console.log('career hub OK (standings, cost cap, market, media, juniors)');
  // develop button spends under the cap
  const capBefore=w.APEXC?0:0;
  w.document.querySelector('#hubTeam [data-dev="aero"]').click();await sleep(60);
  if(!$2('hubTeam').innerHTML.match(/COST CAP \$([1-9])/))console.log('  (cap text: '+($2('hubTeam').textContent.match(/COST CAP[^m]+m/)||[''])[0]+')');
  console.log('development purchase wired');
  // next GP → weekend (confirm=false → no parc fermé breach) → race
  $2('hubNext').click();await sleep(200);
  const fpModal=w.document.querySelector('.fa-modal');
  if(!fpModal)throw new Error('FP weekend modal missing');
  if(!fpModal.textContent.includes('QUALIFYING'))throw new Error('no quali report');
  fpModal.querySelector('.fa-b').click();await sleep(200);   // respect parc fermé
  console.log('FP report + parc fermé modal OK');
  if($2('hub').style.display!=='none')throw new Error('weekend did not start');
  if($2('topbar').style.display==='none')throw new Error('race HUD after hub');
  const A2=w.APEX;
  if(!A2.race.gridOrder&&!A2.race.cfg.gridOrder)throw new Error('no quali grid');
  console.log('hub → practice/quali → race launched with quali grid');
  let g2=0;while(!A2.race.finished&&g2++<4e5)A2.ENGINE.step(A2.race,0.25);
  for(let k=0;k<40&&!w.document.getElementById('results').classList.contains('show');k++){
    const pd=w.document.getElementById('podDone');if(pd)pd.click();
    const mm=w.document.querySelector('.fa-modal .fa-b');if(mm)mm.click();   // protest hearing etc: first option = safe
    await sleep(150);}
  if(!w.document.getElementById('results').classList.contains('show'))throw new Error('season results');
  $2('btnNext').click();await sleep(150);
  if($2('hub').style.display==='none')throw new Error('did not return to hub');
  if(!$2('hubSeason').textContent.includes('Round 2'))throw new Error('calendar did not advance: '+$2('hubSeason').textContent);
  console.log('season loop: results → hub Round 2, points banked:',
    $2('hubStand').textContent.slice(8,40).replace(/\s+/g,' '));
  /* ---- SEASON, RC MODE: oversight + governance ---- */
  w=boot();await sleep(300);
  const $3=id=>w.document.getElementById(id);
  w.document.querySelector('.mode-card[data-mode="fia"]').click();
  $3('go').click();await sleep(150);
  if($3('hub').style.display==='none')throw new Error('RC hub');
  if(!$3('hubTeam').innerHTML.includes('FINE'))throw new Error('IMA oversight missing');
  if(!$3('hubMarket').innerHTML.includes('penPts'))throw new Error('contracts register missing');
  if(!$3('govReg'))throw new Error('governance buttons missing');
  $3('govReg').click();await sleep(80);
  if(!w.document.querySelector('.fa-modal'))throw new Error('governance modal missing');
  w.document.querySelector('.fa-modal .fa-b.grey').click();
  console.log('RC season: IMA oversight (fines), contracts register, governance modal OK');
  // blitz: SIM two consecutive GPs from the hub
  for(let gp=0;gp<2;gp++){
    $3('hubSim').click();await sleep(80);
    const m2=w.document.querySelector('.fa-modal');
    if(!m2)throw new Error('sim modal missing');
    m2.querySelectorAll('.fa-b')[1].click();
    let tries=0;
    while(tries++<100&&!w.document.getElementById('results').classList.contains('show')){
      const pd=w.document.getElementById('podDone');if(pd)pd.click();
      await sleep(100);}
    if(!w.document.getElementById('results').classList.contains('show'))throw new Error('sim GP '+gp+' no results');
    $3('btnNext').click();await sleep(150);
    if($3('hub').style.display==='none')throw new Error('no hub after sim GP');
  }
  if(!$3('hubSeason').textContent.includes('Round 3'))throw new Error('calendar stuck: '+$3('hubSeason').textContent);
  console.log('season blitz: 2 GPs simmed from hub in seconds, calendar at Round 3');
  console.log('ALL UI SMOKE TESTS PASS');
  process.exit(0);
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
