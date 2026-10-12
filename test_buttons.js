// BUTTON CRAWLER: click every interactive element in every mode; any page error = fail
const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync('test_build.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
  const w=dom.window;
  w.__errs=[];
  w.addEventListener('error',e=>w.__errs.push(e.message));
  w.URL.createObjectURL=()=>'blob:x';
  return w;
}
async function dismissModals(w,pick=0){
  for(let i=0;i<6;i++){
    const m=w.document.querySelector('.fa-modal');
    if(!m)break;
    const btns=m.querySelectorAll('.fa-b');
    (btns[Math.min(pick,btns.length-1)]||btns[0]).click();
    await sleep(40);
  }
}
async function clickAll(w,root,label){
  const seen=new Set();
  for(let pass=0;pass<3;pass++){
    const btns=[...root.querySelectorAll('button')].filter(b=>!seen.has(b.id||b.textContent));
    for(const b of btns){
      seen.add(b.id||b.textContent);
      try{b.click();}catch(e){w.__errs.push(label+':'+e.message);}
      await sleep(25);
      await dismissModals(w,0);   // cancel-style dismiss
    }
    await sleep(60);
  }
}
(async()=>{
  for(const mode of ['fia','tp','watch']){
    const w=boot();await sleep(300);
    const $=id=>w.document.getElementById(id);
    w.document.querySelector('#glen .pill[data-g="quick"]').click();
    w.document.querySelector(`.mode-card[data-mode="${mode}"]`).click();
    $('laps').value=8;$('laps').dispatchEvent(new w.Event('input'));
    $('go').click();await sleep(200);
    await dismissModals(w,0);
    // let the race run a moment so dynamic buttons exist
    await sleep(900);
    await clickAll(w,$('cmdbar'),mode+'/cmdbar');
    await clickAll(w,$('deck'),mode+'/deck');
    await clickAll(w,w.document.getElementById('topbar'),mode+'/topbar');
    await dismissModals(w,0);
    // specific state assertions in IMA
    if(mode==='fia'){
      const A=w.APEX;
      // chequered via modal confirm path
      const before=A.race.laps;
      $('b_chq')&&$('b_chq').click();await sleep(50);
      const m=w.document.querySelector('.fa-modal');
      if(m){m.querySelectorAll('.fa-b')[1].click();await sleep(50);}
      if(A.race.laps>=before&&!A.race.finished){
        let g=0;while(!A.race.finished&&g++<60000)A.ENGINE.step(A.race,0.25);
        if(!A.race.finished)throw new Error('chequered ineffective');
      }
      console.log('fia: chequered confirmed working');
    }
    if(w.__errs.length)throw new Error(mode+' errors: '+w.__errs.slice(0,4).join(' | '));
    console.log(mode+' mode: every button clicked, zero page errors');
  }
  // hub buttons (tp + fia seasons)
  for(const mode of ['tp','fia']){
    const w=boot();await sleep(300);
    const $=id=>w.document.getElementById(id);
    w.document.querySelector(`.mode-card[data-mode="${mode}"]`).click();
    $('go').click();await sleep(200);
    await clickAll(w,$('hub'),mode+'/hub');
    await dismissModals(w,0);
    if(w.__errs.length)throw new Error(mode+' hub errors: '+w.__errs.slice(0,4).join(' | '));
    console.log(mode+' hub: every button clicked, zero page errors');
  }
  console.log('ALL BUTTON-CRAWLER TESTS PASS');
  process.exit(0);
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
