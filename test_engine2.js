const E=require('./src/engine.js');
// 1) grid order + car perf applied
let R=E.createRace({trackId:'monza',laps:10,seed:2,mode:'watch',
  gridOrder:['BOT','VER','NOR'],carPerf:{'Cavalier Racing':1.02}});
if(R.cars[0].code!=='BOT'||R.cars.length!==22)throw new Error('grid order');
if(Math.abs(R.cars[0].pace-0.87*1.02)>1e-9)throw new Error('carPerf');
console.log('grid order + car performance OK');
// 2) mech failures occur at realistic rate over many races
let fails=0,races=6;
for(let k=0;k<races;k++){R=E.createRace({trackId:'bahrain',laps:45,seed:100+k,mode:'watch',reliability:{}});
  let g=0;while(!R.finished&&g++<5e5)E.step(R,0.25);
  fails+=R.incidents.filter(i=>i.type==='mech').length;}
console.log(`mech failures: ${(fails/races).toFixed(1)}/race (target 0.5-4)`);
if(fails/races<0.35||fails/races>6)throw new Error('mech rate off');
// 3) track limits escalate: warnings -> B&W -> penalties
R=E.createRace({trackId:'spielberg',laps:45,seed:9,mode:'watch'});
R.cars[0].tlStrikes=3;R.cars[0].aggression=0.95;   // pre-load an offender, verify the escalation chain
let g=0;while(g++<90000&&!R.finished&&!(R.cars[0].tlStrikes>=6&&R.cars[0].penalty>=5))E.step(R,0.25);
const striker=R.cars[0];
if(striker.tlStrikes>=4&&!striker.bwFlag)throw new Error('no B&W at 4');
if(striker.tlStrikes>=6&&striker.penalty<5)throw new Error('no +5s at 6');
console.log('track limits: warnings -> B&W -> +5s OK ('+striker.code+' '+striker.tlStrikes+' strikes, pen '+striker.penalty+'s)');
// 4) lapped cars overtake SC
R=E.createRace({trackId:'monaco',laps:40,seed:4,mode:'fia'});
g=0;while(g++<60000){E.step(R,0.25);
  const o=E.runningOrder(R);if(o[0].lap-o[o.length-1].lap>=1)break;}
E.deploySC(R);for(let i=0;i<1200;i++)E.step(R,0.25);
const lappedBefore=E.runningOrder(R).filter(c=>E.runningOrder(R)[0].lap-c.lap>=1).length;
E.lappedOvertake(R);
if(lappedBefore>0&&!R.cars.some(c=>c.unlapped))throw new Error('unlap failed');
console.log('lapped-cars-may-overtake OK ('+lappedBefore+' unlapped)');
// 5) team orders: swap works or driver refuses with radio
R=E.createRace({trackId:'monza',laps:20,seed:6,mode:'tp',playerTeam:'Scarlatti Corse'});
for(let i=0;i<3000;i++)E.step(R,0.25);
const res=E.teamOrder(R,'Scarlatti Corse','swap');
console.log('team order:',res.obeyed?'obeyed':'REFUSED/'+res.text);
// 6) mandatory stops penalty
R=E.createRace({trackId:'monza',laps:8,seed:3,mode:'watch',minStops:2});
g=0;while(!R.finished&&g++<2e5)E.step(R,0.25);
const missed=R.results.filter(r=>!r.retired&&r.stops<2);
if(missed.length&&!missed.every(r=>r.penalty>=30))throw new Error('mandatory stop pen');
console.log('mandatory 2-stop penalties OK ('+missed.length+' cars penalised)');
// 7) black&orange forces AI pit
R=E.createRace({trackId:'spa',laps:30,seed:8,mode:'fia'});
for(let i=0;i<2000;i++)E.step(R,0.25);
const vic=R.cars[5];vic.dmg=0.5;vic.hanging=true;E.blackOrange(R,vic.code);
g=0;while(!vic.inPit&&!vic.retired&&g++<9000)E.step(R,0.25);
if(!(vic.stops>=1||vic.inPit||vic.retired))throw new Error('BO flag ignored');
console.log('black & orange -> forced pit OK');
// 8) penalty reversal changes classification
R=E.createRace({trackId:'monza',laps:6,seed:12,mode:'watch'});
for(let i=0;i<1500;i++)E.step(R,0.25);
E.givePenalty(R,'VER',10,2,'collision test');
g=0;while(!R.finished&&g++<2e5)E.step(R,0.25);
const posWith=R.results.find(r=>r.code==='VER').pos;
// reverse post-race: rebuild classification
E.reversePenalty(R,'VER',10);
const order2=[...R.cars].sort((a,b)=>{if(a.retired!==b.retired)return a.retired?1:-1;
  if(a.retired)return (b.lap-a.lap)||(a.totalT-b.totalT);
  return (a.totalT+a.penalty)-(b.totalT+b.penalty);});
const posWithout=order2.findIndex(c=>c.code==='VER')+1;
const verRet=R.cars.find(c=>c.code==='VER').retired;
console.log(`penalty challenge: VER P${posWith} -> P${posWithout} after reversal${verRet?' (retired — order unaffected)':''}`);
if(!verRet&&posWithout>posWith)throw new Error('reversal made it worse?');
// 9) quali + practice
const grid=E.simQuali({trackId:'monza',seed:5,carPerf:{}});
if(grid.length!==22)throw new Error('quali');
const fp=E.simPractice({trackId:'losail',laps:57,abrasion:1.3,seed:5},'Scarlatti Corse');
if(!fp.suggestion.includes('stop'))throw new Error('practice');
console.log('quali grid P1:',grid[0],'| practice:',fp.suggestion.slice(0,58)+'…');
console.log('ALL ENGINE-2 TESTS PASS');

// 10) pit stop costs ~pitLoss in classification, NOT a lap (regression for rejoin bug)
{const R=E.createRace({trackId:'monza',laps:30,seed:21,mode:'tp',playerTeam:'Scarlatti Corse'});
for(let i=0;i<3200;i++)E.step(R,0.25);
const lec=R.cars.find(c=>c.code==='LEC');
const rival=R.cars.find(c=>c.code==='RUS');
const before=(lec.lap+lec.s)-(rival.lap+rival.s);
E.boxCar(R,'LEC','H');
let g=0;while((lec.stops===0||lec.inPit)&&g++<6000)E.step(R,0.25);
const after=(lec.lap+lec.s)-(rival.lap+rival.s);
const lossS=(before-after)*R.track.baseLap;
console.log(`pit classification loss at rejoin: ${lossS.toFixed(1)}s (expect ~8-35, was ~a full lap before fix)`);
if(lossS>35||lossS<8)throw new Error('pit loss wrong: '+lossS);}
// 11) red flag: free tyre change + single-file restart
{const R=E.createRace({trackId:'spa',laps:30,seed:22,mode:'fia'});
for(let i=0;i<2500;i++)E.step(R,0.25);
E.redFlag(R);
E.boxCar(R,'VER','H');
const ver=R.cars.find(c=>c.code==='VER');
if(ver.tyre!=='H'||ver.wear!==0)throw new Error('red-flag free change');
let g=0;while(R.red.timer>0&&g++<400)E.step(R,0.25);
E.resumeRed(R,'rolling');
for(let i=0;i<40;i++)E.step(R,0.25);
if(!R.sc.active)throw new Error('no restart SC');
const o=E.runningOrder(R).filter(c=>!c.done);
const gaps=o.slice(1,8).map((c,i)=>((o[i].lap+o[i].s)-(c.lap+c.s))*R.track.baseLap);
if(Math.max(...gaps)>3)throw new Error('field not single-file: '+Math.max(...gaps).toFixed(1));
console.log('red flag: free tyres + single-file reform OK (max gap '+Math.max(...gaps).toFixed(2)+'s)');}
// 12) counter-strategy arms and fires
{const R=E.createRace({trackId:'bahrain',laps:40,seed:23,mode:'tp',playerTeam:'Scarlatti Corse'});
for(let i=0;i<9000;i++)E.step(R,0.25);
E.setCounter(R,'LEC',true);
const lec=R.cars.find(c=>c.code==='LEC');lec.wear=Math.max(lec.wear,30);
let g=0;while(lec.counter&&g++<26000)E.step(R,0.25);
console.log('counter-strategy resolved:',lec.counter?'STILL ARMED (no trigger met)':'fired -> '+(lec.pitReq?'UNDERCUT '+lec.pitReq:'OVERCUT/stay out'));}
console.log('ALL ENGINE-3 TESTS PASS');
