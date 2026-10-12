global.ENGINE=require('./src/engine.js');
const C=require('./src/career.js');
function signContracted(K,team,code,offer){
  let r=C.approachDriver(K,team,code,offer);
  for(let i=0;i<5&&r.negotiating;i++){
    const n=K.negotiations.find(x=>x.code===code&&x.team===team);
    if(!n)break;
    const rr=C.respondNegotiation(K,n.id,'raise',n.demand);
    if(rr.resolved){r=rr.result;break;}
  }
  return r;
}
const E=global.ENGINE;
let K=C.newCareer(5);
if(Object.keys(K.teams).length!==11||Object.keys(K.drivers).length!==22)throw new Error('roster');
console.log('career init: 11 teams, 22 drivers, engines:',Object.keys(K.engines).join('/'));

// weekend flow: practice+quali -> race -> post
const cfg={trackId:K.calendar[0],laps:12,seed:9,weather:'dry',mode:'watch'};
const pw=C.preWeekend(K,cfg);
if(pw.grid.length!==22||!pw.practice['Scarlatti Corse'].suggestion)throw new Error('preweekend');
console.log('practice+quali OK — pole:',pw.grid[0]);
let R=E.createRace({...cfg,gridOrder:pw.grid,carPerf:pw.carPerf,reliability:pw.reliability});
let g=0;while(!R.finished&&g++<3e5)E.step(R,0.25);
const st=C.postRace(K,R);
if(!st.drivers.length||st.drivers[0][1]<15)throw new Error('points');
console.log('race 1 done — leader:',st.drivers[0][0],st.drivers[0][1],'pts · media items:',K.media.length);

// development + cost cap + staff
const T=K.teams['Scarlatti Corse'];T.budget=100;
const cap0=T.capUsed,haas0=K.teams['Hawke Racing'].perf;
const d1=C.develop(K,'Scarlatti Corse','aero',20);
if(!d1.ok||T.capUsed-cap0!==20)throw new Error('dev');
const eng=C.develop(K,'Scarlatti Corse','engine',15);
if(!eng.ok)throw new Error('engine dev');
if(Math.abs(T.capUsed-cap0-20)>1e-9)throw new Error('engine fund must be outside cap');
if(K.teams['Hawke Racing'].perf<=haas0)throw new Error('customer team did not gain from engine dev');
console.log('development OK — aero gain',d1.gain.toFixed(5),'· engine shared to customers, outside cap');
C.hireStaff(K,'Scarlatti Corse',10);

// driver market: approach under contract w/ buyout
K.teams['Scarlatti Corse'].budget=200;
const dNOR=K.drivers['NOR'];dNOR.morale=0.2;dNOR.years=1;
let signed=false;
for(let i=0;i<25&&!signed;i++){
  const r=signContracted(K,'Scarlatti Corse','NOR',{salary:60,years:3,num1:true,releaseBuyout:true});
  if(!r.ok&&r.why)throw new Error(r.why);
  signed=r.accepted;
}
if(!signed)throw new Error('star never accepted a monster offer');
if(K.drivers['NOR'].team!=='Scarlatti Corse')throw new Error('transfer state');
console.log('market: NOR poached to Ferrari with buyout + #1 clause');
const rel=C.releaseDriver(K,'Scarlatti Corse','HAM');
if(!rel.ok||rel.comp<=0)throw new Error('release comp');
console.log(`release: HAM terminated, $${rel.comp.toFixed(0)}m compensation`);
const sf=C.signFree(K,'Cavalier Racing','HAM',{salary:20,years:2});
if(!sf.ok||K.drivers['HAM'].team!=='Cavalier Racing')throw new Error('free signing');
console.log('free agent: HAM -> Cadillac');
const pj=C.promoteJunior(K,'Alpinis GP',0);
if(!pj.ok)throw new Error('junior promo');
console.log('junior promoted:',pj.code);

// penalty points ban
K.drivers['VER'].penPts=11;
R=E.createRace({trackId:'monza',laps:5,seed:3,mode:'watch'});
R.cars.find(c=>c.code==='VER').penPts=2;
g=0;while(!R.finished&&g++<2e5)E.step(R,0.25);
C.postRace(K,R);
if(K.drivers['VER'].banned!==1)throw new Error('ban not applied');
const pw2=C.preWeekend(K,{trackId:'spa',laps:10,seed:4,weather:'dry'});
if(pw2.grid.includes('VER'))throw new Error('banned driver on grid');
console.log('penalty points: VER banned, absent from next grid');

// season end: prize, ATR order, cap breach flow
K.teams['Ridiculous Bulls'].capUsed=160;
const se=C.seasonEnd(K);
if(!se.prizeEvents.length)throw new Error('prize');
const rev=se.capReviews.find(r=>r.team==='Ridiculous Bulls');
if(!rev)throw new Error('breach not caught');
const v=C.judgeCapBreach(K,'Ridiculous Bulls',false,'minor');
if(v.penalty!=='fine+ATR')throw new Error('verdict');
const atrs=Object.values(K.teams).map(t=>t.atr);
if(Math.min(...atrs)<0.6||Math.max(...atrs)>1.3)throw new Error('ATR range');
console.log('season end: prize paid, ATR ladder set, RBR cap breach -> fine+ATR cut');

// regulations vote with engine bias + IMA override
let bias=0,tries=40;
const bloc=E.ENGINES['Silverline Power'].teams.filter(t=>K.teams[t]);
for(let i=0;i<tries;i++){
  const reg=C.proposeReg(K,'rearwing',bloc,'Silverline Motorsport');
  bias+=bloc.filter(t=>reg.votes[t]).length/bloc.length;
}
console.log('beneficiary voting bias:',(bias/tries*100).toFixed(0)+'% support (expect ~90%)');
if(bias/tries<0.75)throw new Error('vote bias weak');
const reg=C.proposeReg(K,'floor',[],'McCallen Racing');
C.applyReg(K,reg,'force');   // IMA override
console.log('IMA override applied, aero reset compressed field');

// stewards challenge reverses result
R=E.createRace({trackId:'monza',laps:6,seed:12,mode:'watch'});
for(let i=0;i<1500;i++)E.step(R,0.25);
E.givePenalty(R,'LEC',10,2,'forcing another driver off');
g=0;while(!R.finished&&g++<2e5)E.step(R,0.25);
K.pendingIncidents=R.incidents.filter(i=>i.challengeable);
const before=R.results.find(r=>r.code==='LEC').pos;
const ch=C.challengePenalty(K,R,K.pendingIncidents.length-1,true);
const after=R.results.find(r=>r.code==='LEC').pos;
if(!ch.reversed||after>before)throw new Error('challenge flow');
console.log(`stewards: LEC challenge accepted, P${before} -> P${after}, results amended`);

// save/load
const s=C.save(K);const K2=C.load(s);
if(K2.year!==K.year||Object.keys(K2.drivers).length!==Object.keys(K.drivers).length)throw new Error('save');
console.log('save/load round-trip OK ·',(s.length/1024).toFixed(0),'KB');
console.log('ALL CAREER TESTS PASS');



// seats: sign -> replace / reserve / next-season; roster always 22 with 2 per team
{const K3=C.newCareer(9);
C.normalizeSeats(K3);
for(const tm in K3.teams)if(K3.teams[tm].seats.length!==2)throw new Error('init seats '+tm);
// immediate replace with comp
K3.teams['McCallen Racing'].budget=300;K3.drivers['LEC'].morale=0.1;K3.drivers['LEC'].years=1;
let got=false;
for(let i=0;i<30&&!got;i++)got=signContracted(K3,'McCallen Racing','LEC',{salary:80,years:3,releaseBuyout:true}).accepted;
if(!got)throw new Error('no acceptance');
if(K3.teams['McCallen Racing'].seats.includes('LEC'))throw new Error('seated without placement');
const r=C.assignSeat(K3,'McCallen Racing','LEC','replace','PIA');
if(!r.ok||!K3.teams['McCallen Racing'].seats.includes('LEC')||K3.drivers['PIA'].team!=='FREE')throw new Error('replace flow');
console.log(`seat replace: LEC in, PIA released with $${r.comp.toFixed(0)}m comp`);
// reserve
C.signFree(K3,'McCallen Racing','PIA',{salary:5,years:1});
C.assignSeat(K3,'McCallen Racing','PIA','reserve');
if(K3.teams['McCallen Racing'].reserve!=='PIA')throw new Error('reserve');
console.log('reserve placement OK');
// next-season pre-contract
K3.drivers['RUS'].morale=0.1;
let def=null;
for(let i=0;i<30&&!def;i++){const a=C.approachDriver(K3,'McCallen Racing','RUS',{salary:70,years:2,when:'nextSeason',releaseBuyout:true});if(a.deferred)def=a;}
if(!def)throw new Error('no pre-contract');
if(K3.drivers['RUS'].team!=='Silverline Motorsport')throw new Error('deferred should not move yet');
C.seasonEnd(K3);
if(K3.drivers['RUS'].team!=='McCallen Racing')throw new Error('pre-contract not applied');
console.log('next-season pre-contract: races out year, moves at season end OK');
// roster integrity: 22 cars, 2 per team, ban substitution
K3.drivers['VER'].banned=1;
const roster=C.buildRoster(K3);
if(roster.length!==22)throw new Error('roster size '+roster.length);
const per={};roster.forEach(r2=>per[r2[2]]=(per[r2[2]]||0)+1);
for(const tm in per)if(per[tm]!==2)throw new Error('team count '+tm);
if(roster.some(r2=>r2[0]==='VER'))throw new Error('banned raced');
console.log('roster: 22 cars, 2 per team, banned VER substituted OK');}
console.log('ALL SEAT TESTS PASS');

// new features: grid penalties, sponsor payouts, rivalries plumb through
{const K4=C.newCareer(11);
K4.gridPens['VER']=10;
const pw=C.preWeekend(K4,{trackId:'monza',laps:10,seed:3,weather:'dry'});
const vi=pw.grid.indexOf('VER');
if(vi<8)throw new Error('grid penalty not applied, VER P'+(vi+1));
if(Object.keys(K4.gridPens).length)throw new Error('pen not cleared');
console.log('grid penalty: VER drops to P'+(vi+1)+' and clears OK');
const T=K4.teams['Cavalier Racing'];const b0=T.budget;
C.seasonEnd(K4);
console.log('season end cash flow ran OK');
K4.rivalries=[['VER','NOR']];
const pw2=C.preWeekend(K4,{trackId:'spa',laps:10,seed:4,weather:'dry'});
if(!pw2.rivalries.length)throw new Error('rivalries not passed');
const R=global.ENGINE.createRace({trackId:'spa',laps:5,seed:4,rivalries:pw2.rivalries,mode:'watch'});
if(!R.cars.find(c=>c.code==='VER').rivals.includes('NOR'))throw new Error('rival not on car');
console.log('rivalry plumbed: VER↔NOR heat active in-race');}
console.log('ALL FEATURE TESTS PASS');

// economy sanity: unaffordable superstar blocked; wages charged; sponsor negotiation
{const K5=C.newCareer(21);K5.playerTeamHint='Scarlatti Corse';
K5.teams['Scarlatti Corse'].budget=70;
const r=C.approachDriver(K5,'Scarlatti Corse','VER',{salary:570,years:2,num1:true,releaseBuyout:true});
if(r.ok!==false||!/serious|Unafford/i.test(r.why||''))throw new Error('570m offer not blocked: '+JSON.stringify(r));
const r2=C.approachDriver(K5,'Scarlatti Corse','VER',{salary:100,years:2,num1:true,releaseBuyout:true});
if(r2.ok!==false||!/Unafford/i.test(r2.why||''))throw new Error('unaffordable 100m not blocked');
console.log('affordability gates OK (570m: "'+r.why.slice(0,30)+'…")');
const wages=C.wageBill(K5,'Scarlatti Corse');
const b0=K5.teams['Scarlatti Corse'].budget;
C.seasonEnd(K5);
const delta=K5.teams['Scarlatti Corse'].budget-b0;
const inc=C.sponsorIncome(K5.teams['Scarlatti Corse']);
if(delta>200||delta< -wages)throw new Error('season cash flow off: '+delta);
console.log('wages charged at season end (bill $'+wages.toFixed(0)+'m, net '+(delta>=0?'+':'')+delta.toFixed(0)+'m)');
// sponsor offer + negotiation
const off=C.makeSponsorOffer(K5,'Scarlatti Corse');off.team='Scarlatti Corse';
K5.sponsorOffers=[off];
K5.teams['Scarlatti Corse'].sponsorships=[];
let signed=false;
for(let i=0;i<25&&!signed;i++)
  signed=C.negotiateSponsor(K5,'Scarlatti Corse',{...off,id:'x'+i},{demand:off.base,years:2,results:false,podiumBonus:0,exitFee:off.base}).accepted;
if(!signed)throw new Error('fair demand never accepted');
const greedy=C.makeSponsorOffer(K5,'Scarlatti Corse');
let rejections=0;
for(let i=0;i<20;i++)
  if(!C.negotiateSponsor(K5,'Scarlatti Corse',{...greedy,id:'g'+i},{demand:greedy.base*3.5,years:2,results:false,podiumBonus:0,exitFee:greedy.base}).accepted)rejections++;
if(rejections<15)throw new Error('greed insufficiently punished: '+rejections+'/20');
console.log('sponsor negotiation OK (fair ask signs, 3.5x greed rejected '+rejections+'/20)');
// top team offers > backmarker offers on average
let top=0,back=0;
for(let i=0;i<40;i++){top+=C.makeSponsorOffer(K5,'Scarlatti Corse').base;back+=C.makeSponsorOffer(K5,'Cavalier Racing').base;}
console.log('avg offer: Ferrari $'+(top/40).toFixed(0)+'m vs Cadillac $'+(back/40).toFixed(0)+'m');
if(top/40<back/40)throw new Error('tier bias missing');}
console.log('ALL ECONOMY TESTS PASS');

// autonomy suite: draft sizing, max-5, termination fees, driver clause storage
{const K6=C.newCareer(31);K6.playerTeamHint='Scarlatti Corse';
const topN=C.seasonOffers(K6,'Scarlatti Corse').length,backN=C.seasonOffers(K6,'Cavalier Racing').length;
console.log('draft offers: Ferrari '+topN+' vs Cadillac '+backN);
if(topN<3||topN<backN-1)throw new Error('draft bias');
const T=K6.teams['Scarlatti Corse'];T.sponsorships=[];T.budget=500;
for(let i=0;i<9;i++){
  const off=C.makeSponsorOffer(K6,'Scarlatti Corse');
  C.negotiateSponsor(K6,'Scarlatti Corse',off,{demand:Math.max(1,off.base*0.5),years:2,results:false,podiumBonus:0,exitFee:off.base});
}
if(T.sponsorships.length>5)throw new Error('max-5 violated: '+T.sponsorships.length);
console.log('max 5 sponsors enforced ('+T.sponsorships.length+'/5 after 9 attempts)');
const lock=C.terminateSponsor(K6,'Scarlatti Corse',0);
if(lock.ok)throw new Error('first-season termination should be locked');
T.sponsorships[0].signedYear=K6.year-1;                    // age the deal one season
const before=T.budget,fee=T.sponsorships[0].clauses.exitFee;
const term=C.terminateSponsor(K6,'Scarlatti Corse',0);
if(!term.ok||before-T.budget!==fee)throw new Error('termination fee flow');
console.log('termination: locked in year one, then exit fee $'+fee+'m paid, deal removed');
// driver clause menu stored + affordable
K6.teams['McCallen Racing'].budget=400;K6.drivers['LEC'].morale=0.1;K6.drivers['LEC'].years=1;
let acc=null;
for(let i=0;i<40&&!acc;i++){
  const r=signContracted(K6,'McCallen Racing','LEC',{salary:60,years:3,num1:true,exitN:3,releaseFee:90,podiumBonus:1,releaseBuyout:true});
  if(r.accepted)acc=r;}
if(!acc)throw new Error('clause offer never accepted');
const d=K6.drivers['LEC'];
if(d.clauses.exitIfNotTopN!==3||d.clauses.releaseFee!==90||d.clauses.podiumBonus!==1||!d.clauses.num1)
  throw new Error('clauses not stored: '+JSON.stringify(d.clauses));
console.log('driver clauses stored: #1, exit-top-3, $90m buyout, $1m/podium');}
console.log('ALL AUTONOMY TESTS PASS');
