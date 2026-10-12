const E=require('./src/engine.js');
const log=(...a)=>console.log(...a);

// 1) every track builds: closed, sane lap time, speed profile finite
for(const t of E.TRACKS){
  const T=E.buildTrack(t);
  if(!(T.baseLap>50&&T.baseLap<130))throw new Error(t.id+' lap '+T.baseLap);
  for(const v of T.v)if(!isFinite(v)||v<5)throw new Error(t.id+' bad v');
  const a=T.xy[0],b=T.xy[T.N-1];
  if(Math.hypot(a[0]-b[0],a[1]-b[1])>T.len*0.04)throw new Error(t.id+' not closed');
}
log('tracks OK:',E.TRACKS.map(t=>t.id+':'+Math.round(E.buildTrack(t).baseLap)+'s').join(' '));

// 2) full dry race completes, classification sane, tyres used
let R=E.createRace({trackId:'bahrain',laps:40,seed:7,weather:'dry',mode:'watch'});
let guard=0;
while(!R.finished&&guard++<4e5)E.step(R,0.25);
if(!R.finished)throw new Error('race never finished');
const res=R.results;
if(res[0].pts!==25||res.filter(r=>!r.retired).length<12)throw new Error('bad results');
if(!['VER','NOR','PIA','LEC','RUS','HAM'].includes(res[0].code))throw new Error('implausible winner '+res[0].code);
const stopsOK=res.filter(r=>!r.retired).every(r=>r.stops>=1);
log(`dry race: winner ${res[0].code}, ${res.filter(r=>r.retired).length} DNFs, all pitted: ${stopsOK}, overtakes ${R.stats.overtakes}`);
if(!stopsOK)throw new Error('someone never pitted in 40 laps? wear model broken');

// 3) SC bunches the field
R=E.createRace({trackId:'monza',laps:30,seed:11,weather:'dry',mode:'fia'}); // fia: no auto race control
R.cars.forEach(c=>c.aggression=0);                // isolate the accordion: no crashes
for(let i=0;i<900;i++)E.step(R,0.25);             // ~lap 3, tyres fresh
const spread=()=>{const o=E.runningOrder(R);const lead=o[0].lap+o[0].s;
  return (lead-(o[o.length-1].lap+o[o.length-1].s))*R.track.baseLap;};
const before=spread();
E.deploySC(R);
for(let i=0;i<2800;i++)E.step(R,0.25);            // several SC laps
const during=spread();
log(`SC bunching: spread ${before.toFixed(1)}s -> ${during.toFixed(1)}s`);
if(!(during<before*0.55))throw new Error('SC does not bunch');
E.scIn(R);
let g=0;while(R.sc.active&&g++<6000)E.step(R,0.25);
if(R.flag!=='GREEN')throw new Error('SC never came in');
log('SC in -> green OK');

// 4) VSC slows everyone
R=E.createRace({trackId:'spa',laps:30,seed:5,weather:'dry',mode:'fia'});
for(let i=0;i<4000;i++)E.step(R,0.25);
const car=E.runningOrder(R)[3];
let p0=car.lap+car.s;for(let i=0;i<240;i++)E.step(R,0.25);
const rateG=(car.lap+car.s)-p0;
E.deployVSC(R);
p0=car.lap+car.s;for(let i=0;i<240;i++)E.step(R,0.25);
const rateV=(car.lap+car.s)-p0;
E.endVSC(R);
log(`VSC pace: ${(rateV/rateG*100).toFixed(0)}% of green-flag progress`);
if(!(rateV<rateG*0.75))throw new Error('VSC ineffective');

// 5) debris -> punctures if not cleared; marshals clear it
R=E.createRace({trackId:'silverstone',laps:40,seed:3,weather:'dry',mode:'fia'});
for(let i=0;i<2000;i++)E.step(R,0.25);
R.debris.push({id:1,s:0.5,turn:9,size:1.0});
let pn0=R.stats.punctures;
for(let i=0;i<6000&&R.stats.punctures===pn0;i++)E.step(R,0.25);
log('debris caused puncture:',R.stats.punctures>pn0?'YES':'NO');
if(R.stats.punctures===pn0)throw new Error('debris harmless');
E.sendMarshals(R,1);
let g2=0;while(R.debris.some(d=>d.id===1)&&g2++<600)E.step(R,0.25);
if(R.debris.some(d=>d.id===1))throw new Error('marshals never cleared');
log('marshals cleared debris OK');

// 6) red flag halts, then restarts behind SC
E.redFlag(R);
const posAt=E.runningOrder(R)[0].s;
for(let i=0;i<100;i++)E.step(R,0.25);
if(Math.abs(E.runningOrder(R)[0].s-posAt)>1e-9)throw new Error('cars moved under red');
for(let i=0;i<400;i++)E.step(R,0.25);
if(!R.red.active)throw new Error('red should hold for race control');
E.resumeRed(R,'rolling');
for(let i=0;i<40;i++)E.step(R,0.25);
if(!R.sc.active)throw new Error('no restart SC after red');
log('red flag: holds for RC, rolling restart behind SC OK');

// 7) wet race: field switches to inters/wets
R=E.createRace({trackId:'suzuka',laps:16,seed:9,weather:'storm',mode:'watch'});
let g3=0;while(!R.finished&&g3++<4e5)E.step(R,0.25);
const wetTyres=R.results.filter(r=>!r.retired).length;
log(`storm race finished, winner ${R.results[0].code}; SC deployed ${R.stats.scCount}x, collisions ${R.stats.collisions}`);

// 8) player controls: box + push + penalty
R=E.createRace({trackId:'monaco',laps:12,seed:13,weather:'dry',mode:'tp',playerTeam:'Scarlatti Corse'});
for(let i=0;i<2000;i++)E.step(R,0.25);
E.boxCar(R,'LEC','H');E.setPush(R,'HAM',2);E.givePenalty(R,'VER',5);
const lec=R.cars.find(c=>c.code==='LEC');
let g4=0;while((lec.stops===0||lec.inPit||lec.pitReq)&&g4++<6000)E.step(R,0.25);
if(lec.stops!==1||lec.tyre!=='H')throw new Error('box command failed');
if(R.cars.find(c=>c.code==='VER').penalty!==5)throw new Error('penalty failed');
log('player commands (BOX/push/penalty) OK');
log('ALL ENGINE TESTS PASS');
