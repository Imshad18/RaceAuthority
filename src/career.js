/* RACE AUTHORITY — career layer (economy, contracts, politics). Pure logic. */
'use strict';
const CAREER=(()=>{
const E=(typeof ENGINE!=='undefined')?ENGINE:require('./engine.js');
function RNG(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/* prize money by constructors' position (USD m) */
const PRIZE=[140,131,122,113,104,95,86,77,68,59,52,46];
                       // dev+ops cap (m). salaries excluded
const FIRST_NAMES=['Luca','Theo','Kenji','Rafael','Noah','Dries','Marco','Jules','Elias','Santiago','Felix','Aiden','Nikita','Tomas','Hugo','Enzo'];
const LAST_NAMES=['Moreau','Vestergaard','Sato','Duarte','Kellner','van Dijk','Rinaldi','Okafor','Larsen','Vidal','Novak','Byrne','Petrov','Silva','Meyer','Costa'];

function newCareer(seed=1,races){
  const rng=RNG(seed);
  const teams={};
  const basePerf={'McCallen Racing':1.012,'Scarlatti Corse':1.009,'Ridiculous Bulls':1.010,'Silverline Motorsport':1.008,'Emerald Martinez':1.000,
    'Williamson Racing':0.999,'Velocity Racing':0.997,'Alpinis GP':0.995,'Hawke Racing':0.996,'Auris Motorsport':0.992,'Cavalier Racing':0.990};
  const teamNames=[...new Set(E.GRID.map(g=>g[2]))];
  teamNames.forEach((tm,i)=>{
    teams[tm]={name:tm,engine:E.engineOf(tm),
      budget:60+rng()*40,
      sponsorships:[{name:['Apex Energy','Vortex Telecom','Helios Bank','Nimbus Air','Ionix Motors','Quantum Oil','Stellar Watches'][i%7],perYear:Math.round(18+rng()*16),years:1+Math.round(rng()*2),signedYear:2025,paidThisSeason:false,clauses:{results:null,podiumBonus:0,exitFee:20}}],
      devSpend:0, capUsed:0, capBreached:false, breachExcused:null,
      perf:basePerf[tm]||1.0, devPts:{aero:0,chassis:0},
      staff:55+Math.round(rng()*25), atr:1.0,            // wind-tunnel multiplier (set by standings)
      reliability:0.982+rng()*0.010, principalMood:0.7,
      engineSeasons:2, facility:0.5+rng()*0.5,
      reserve:null, seats:E.GRID.filter(g=>g[2]===tm).map(g=>g[0])};
  });
  const drivers={};
  E.GRID.forEach(g=>{
    const star=g[4]>0.94;
    drivers[g[0]]={code:g[0],name:g[1],team:g[2],cons:g[5],agg:g[6],color:g[3],
      salary:star?38+rng()*45:(g[4]>0.89?12+rng()*14:3+rng()*6),
      years:1+Math.round(rng()*2),
      clauses:{num1:g[4]>0.96&&rng()<0.5, exitIfNotTopN:rng()<0.35?(star?4:8):0, releaseFee:20+Math.round(rng()*40)},
      morale:0.6+rng()*0.3, penPts:0, banned:0, rating:g[4]};
  });
  const engines={};
  for(const en in E.ENGINES)engines[en]={fund:80,dev:0,perf:E.ENGINES[en].perf};
  return {seed,year:2026,raceIdx:0,calendar:['bahrain','jeddah','monaco','silverstone','spa','monza','suzuka','interlagos','melbourne','shanghai','miami','montreal','madrid','spielberg','hungaroring','zandvoort','baku','singapore','cota','mexico','vegas','losail','yas'].slice(0,Math.max(3,Math.min(23,races||23))),
    teams,drivers,engines,
    driverPts:{},teamPts:{},media:[],pendingIncidents:[],regs:[],futureMoves:[],rivalries:[],gridPens:{},
    components:Object.fromEntries(E.GRID.map(g=>[g[0],{ice:4,wear:0}])),
    negotiations:[],academy:{level:0,karters:[]},
    starStaff:[
      {name:'Elena Vasquez',role:'AERO',skill:0.9,team:'Ridiculous Bulls',salary:8,garden:0},
      {name:'Marcus Chen',role:'RE',skill:0.85,team:'Scarlatti Corse',salary:6,garden:0},
      {name:'Yuki Tanaka',role:'AERO',skill:0.8,team:'McCallen Racing',salary:6,garden:0},
      {name:'Sofia Lindqvist',role:'RE',skill:0.82,team:'Silverline Motorsport',salary:5.5,garden:0},
      {name:'Otto Weber',role:'AERO',skill:0.72,team:null,salary:4,garden:0},
      {name:'Priya Nair',role:'RE',skill:0.75,team:null,salary:4,garden:0}],
    boardTarget:null,rep:0.5,sacked:false,fiaTemper:1.0,prizeMode:'weighted',
    costCap:135,customerCap:4,
    engineDev:Object.fromEntries(Object.keys(E.ENGINES).map(k=>[k,{perf:E.ENGINES[k].perf,bannedUntil:0,edt:0,spend:0}])),
    engineHistory:{},fineAppeals:[],deviceCases:[],
    hall:{wins:{},poles:{},titles:{}},seasonRecords:[],
    f2:junior(rng,'F2'),f3:junior(rng,'F3'),history:[]};
}
function junior(rng,cat){
  const out=[];
  for(let i=0;i<10;i++){
    const nm=FIRST_NAMES[Math.floor(rng()*FIRST_NAMES.length)]+' '+LAST_NAMES[Math.floor(rng()*LAST_NAMES.length)];
    out.push({name:nm,cat,pts:0,rating:0.78+rng()*(cat==='F2'?0.14:0.10),talent:rng()});
  }
  return out;
}

function sponsorIncome(T){return (T.sponsorships||[]).reduce((a,s)=>a+s.perYear,0);}
function wageBill(C,tm){
  let w=0;
  for(const code in C.drivers){const d=C.drivers[code];if(d.team===tm)w+=d.salary;}
  return w;
}
const SPONSOR_BRANDS=[['Meridian Card',1],['Aramax Energy',1],['Orbita Cloud',1],['Petronova',1],['Crypto.hex',2],
 ['Dartline Express',2],['Pirotta Lifestyle',2],['Coinway',2],['Baltora Watches',2],['Kick Energy',3],
 ['Zenith Tools',3],['Rakonn',2],['Velo Foods',3],['Airstream Hotels',3],['BytePlay',2]];
function makeSponsorOffer(C,tm,exclude){
  const ts=Object.keys(C.teams).map(t=>[t,C.teamPts[t]||0]).sort((a,b)=>b[1]-a[1]);
  let pos=ts.findIndex(([t])=>t===tm)+1;if(pos<=0)pos=6;
  const topBrandBias=pos<=4?2.2:0.35;
  const mega=Math.random()<(pos<=4?0.22:0.06);
  const excl=new Set([...(exclude||[]),
    ...((C.teams[tm].sponsorships||[]).map(s=>s.name)),
    ...((C.sponsorOffers||[]).filter(o=>o.team===tm).map(o=>o.name))]);
  const pool=SPONSOR_BRANDS.filter(([n])=>!excl.has(n));
  const src=pool.length?pool:SPONSOR_BRANDS;
  const weights=src.map(([n,t])=>t===1?topBrandBias:t===2?1:0.8);
  let r=Math.random()*weights.reduce((a,b)=>a+b,0),pick=src[0];
  for(let i=0;i<src.length;i++){r-=weights[i];if(r<=0){pick=src[i];break;}}
  const base=mega?80+Math.round(Math.random()*40)
    :pos<=4?35+Math.round(Math.random()*45)
    :pos<=8?12+Math.round(Math.random()*26)
    :5+Math.round(Math.random()*14);
  return {id:Math.random().toString(36).slice(2,8),name:pick[0],base,years:1+Math.round(Math.random()*2),
    clauseOffer:{desc:`results clause: -30% payment if outside top ${Math.min(pos+2,10)}`,topN:Math.min(pos+2,10),bonusPct:0.2},
    expires:C.raceIdx+3};
}
function negotiateSponsor(C,tm,off,terms){
  // terms:{demand,years,results:bool,podiumBonus:$m|0,exitFee:$m}
  const T=C.teams[tm];
  if((T.sponsorships||[]).length>=5)return{ok:false,why:'Maximum 5 sponsors per team'};
  let mult=1;
  if(terms.results)mult+=0.25;                       // they pay more for downside protection
  if(terms.podiumBonus>0)mult-=Math.min(terms.podiumBonus/off.base*0.5,0.15);
  const feeRatio=(terms.exitFee||0)/Math.max(terms.demand,1);
  mult+=feeRatio>=1?0.10:(feeRatio<=0.25?-0.12:0);   // easy exits make sponsors nervous
  const ceiling=off.base*mult;
  const p=Math.max(0.03,Math.min(0.95,0.92-Math.max(0,(terms.demand-ceiling))/off.base*1.4));
  if(C.sponsorOffers)C.sponsorOffers=C.sponsorOffers.filter(o=>o.id!==off.id);
  if(Math.random()<p){
    const pay1=Math.round(terms.demand);
    T.budget+=pay1;                                        // year one lands in the bank NOW
    T.sponsorships.push({name:off.name,perYear:pay1,years:terms.years||off.years,
      signedYear:C.year,paidThisSeason:true,
      clauses:{results:terms.results?{topN:off.clauseOffer.topN,cutPct:0.3}:null,
               podiumBonus:terms.podiumBonus||0,
               exitFee:Math.round(terms.exitFee??terms.demand)}});
    news(C,'market',`${off.name} sign with ${tm}: $${Math.round(terms.demand)}m/yr × ${terms.years||off.years}yr${terms.results?' · results clause':''}${terms.podiumBonus?' · $'+terms.podiumBonus+'m/podium':''}.`);
    return{ok:true,accepted:true,p};
  }
  news(C,'rumour',`${off.name} walk away from ${tm} talks — terms too rich.`);
  return{ok:true,accepted:false,p,why:'Sponsor declined your terms'};
}
function terminateSponsor(C,tm,idx){
  const T=C.teams[tm];const sp=(T.sponsorships||[])[idx];
  if(!sp)return{ok:false};
  if(sp.signedYear===C.year)return{ok:false,why:'Deals cannot be terminated in their first season — serve the year out.'};
  const fee=sp.clauses&&sp.clauses.exitFee!=null?sp.clauses.exitFee:sp.perYear;
  if(T.budget<fee)return{ok:false,why:`Exit fee is $${fee}m — insufficient budget`};
  T.budget-=fee;T.sponsorships.splice(idx,1);
  news(C,'market',`${tm} terminate their ${sp.name} deal — $${fee}m exit fee paid.`);
  return{ok:true,fee};
}
function seasonOffers(C,tm){
  const rank=Object.keys(C.teams).map(t=>[t,C.teams[t].perf]).sort((a,b)=>b[1]-a[1]).findIndex(([t])=>t===tm)+1;
  const lastChamp=C.history.length&&C.history[C.history.length-1].teams[0][0]===tm;
  const n=Math.min(6,(rank<=4?4:rank<=8?3:2)+(lastChamp?2:0)+(Math.random()<0.4?1:0));
  const out=[],used=new Set();
  for(let i=0;i<n;i++){const o=makeSponsorOffer(C,tm,used);used.add(o.name);out.push(o);}
  return out;
}
/* ---------------- seats & roster ---------------- */
function teamColor(C,tm){
  const g=E.GRID.find(x=>x[2]===tm);
  if(g)return g[3];
  const d=Object.values(C.drivers).find(x=>x.team===tm&&x.color);
  return d?d.color:0x8899AA;
}
function normalizeSeats(C){
  for(const tm in C.teams){
    const T=C.teams[tm];
    T.seats=(T.seats||[]).filter(code=>C.drivers[code]&&C.drivers[code].team===tm);
    while(T.seats.length>2){const out=T.seats.pop();
      if(!T.reserve)T.reserve=out;else{C.drivers[out].team='FREE';
        news(C,'market',`${C.drivers[out].name} left without a seat at ${tm} — released to the market.`);}}
    while(T.seats.length<2){
      let pick=null;
      if(T.reserve&&C.drivers[T.reserve]&&C.drivers[T.reserve].team===tm){pick=T.reserve;T.reserve=null;
        news(C,'market',`${C.drivers[pick].name} promoted from reserve to a race seat at ${tm}.`);}
      else{
        const free=Object.values(C.drivers).filter(d=>d.team==='FREE').sort((a,b)=>b.rating-a.rating)[0];
        if(free){free.team=tm;free.salary=Math.max(2,free.salary*0.6);free.years=1;pick=free.code;
          news(C,'market',`${free.name} signs a short-term deal to fill ${tm}'s vacant seat.`);}
        else{const j=C.f2.shift();
          const code=uniqueCode(C,j.name);
          C.drivers[code]={code,name:j.name,team:tm,cons:0.8,agg:0.75,salary:1.5,years:2,
            clauses:{num1:false,exitIfNotTopN:0,releaseFee:8},morale:0.85,penPts:0,banned:0,rating:j.rating};
          pick=code;
          news(C,'market',`${tm} draft F2 driver ${j.name} straight into a race seat!`);}
      }
      T.seats.push(pick);
    }
  }
}
function uniqueCode(C,name){
  let base=(name.split(' ').pop()||'JNR').slice(0,3).toUpperCase(),code=base,n=2;
  while(C.drivers[code])code=base.slice(0,2)+(n++);
  return code;
}
function assignSeat(C,team,code,mode,outCode){
  const T=C.teams[team],d=C.drivers[code];
  if(!T||!d)return{ok:false};
  if(mode==='replace'){
    const out=C.drivers[outCode];
    if(!out||out.team!==team)return{ok:false,why:'invalid seat'};
    const comp=out.salary*out.years*0.75;
    if(T.budget<comp)return{ok:false,why:`Releasing ${out.name} costs $${comp.toFixed(0)}m compensation — insufficient budget`};
    T.budget-=comp;out.team='FREE';out.morale=0.3;
    T.seats[T.seats.indexOf(outCode)]=code;
    news(C,'market',`${out.name}'s contract terminated early ($${comp.toFixed(0)}m compensation) — ${d.name} takes the seat with immediate effect.`);
    return{ok:true,comp};
  }
  if(mode==='reserve'){
    if(T.reserve&&C.drivers[T.reserve])C.drivers[T.reserve].team='FREE';
    T.reserve=code;
    news(C,'market',`${d.name} joins ${team} as official reserve driver.`);
    return{ok:true};
  }
  return{ok:false};
}
function buildRoster(C){
  normalizeSeats(C);
  const roster=[];
  for(const tm in C.teams){
    const T=C.teams[tm];
    for(const code of T.seats){
      let d=C.drivers[code];
      if(d.banned>0){
        let sub=(T.reserve&&C.drivers[T.reserve]&&C.drivers[T.reserve].banned===0)?C.drivers[T.reserve]
          :Object.values(C.drivers).filter(x=>x.team==='FREE'&&!x.banned).sort((a,b)=>b.rating-a.rating)[0];
        if(!sub){const j=C.f2.shift();const sc=uniqueCode(C,j.name);
          C.drivers[sc]={code:sc,name:j.name,team:'FREE',cons:0.8,agg:0.75,salary:1,years:1,
            clauses:{num1:false,exitIfNotTopN:0,releaseFee:5},morale:0.85,penPts:0,banned:0,rating:j.rating};
          sub=C.drivers[sc];}
        d=sub;news(C,'fia',`${C.drivers[code].name} is banned — ${d.name} substitutes at ${tm} this weekend.`);
      }
      roster.push([d.code,d.name.split(' ').pop(),tm,teamColor(C,tm),d.rating,d.cons||0.85,d.agg||0.75]);
    }
  }
  return roster;
}

/* ---------------- media ---------------- */
function news(C,kind,text){C.media.unshift({r:C.raceIdx,kind,text});if(C.media.length>60)C.media.pop();}
const TP_QUOTES=[
 t=>`"${t} need to look at their own driving before pointing fingers." — rival team principal`,
 t=>`"What ${t} did today was completely unacceptable. The stewards were asleep." — rival TP`,
 t=>`"If ${t} think that's racing, we'll be having words with the IMA." — rival TP`,
];

/* ---------------- pre-weekend ---------------- */
function componentTick(C){
  for(const code in C.components){const k=C.components[code];
    k.wear+=7+Math.random()*6;
    if(k.wear>100){k.ice--;k.wear=15;
      if(k.ice<0){C.gridPens[code]=(C.gridPens[code]||0)+10;k.ice=0;k.wear=0;
        news(C,'fia',`${C.drivers[code]?C.drivers[code].name:code} exceeds the 4-ICE pool — 10-place grid penalty.`);}
    }}
}
function takeFreshUnit(C,code){
  const k=C.components[code];if(!k)return{ok:false};
  k.ice--;k.wear=0;
  if(k.ice<0){k.ice=0;C.gridPens[code]=(C.gridPens[code]||0)+10;
    news(C,'fia',`${C.drivers[code].name} takes a 5th power unit — 10-place grid penalty.`);
    return{ok:true,penalty:10};}
  news(C,'paddock',`${C.drivers[code].name} takes a fresh power unit from the pool (${k.ice} remaining).`);
  return{ok:true,penalty:0};
}
function preWeekend(C,cfg){
  componentTick(C);
  // practice for every team; player gets the suggestion text
  const out={};
  for(const tm in C.teams){
    const fp=E.simPractice({...cfg,seed:cfg.seed+C.raceIdx*31+tm.length},tm);
    out[tm]=fp;
    if(fp.crashed&&Math.random()<0.6)news(C,'paddock',`${tm} lose track time after a heavy FP crash — limited data for Sunday.`);
  }
  // quali on the actual seated roster (bans -> substitutes)
  const carPerf={};for(const tm in C.teams){
    const em=C.teams[tm].engine||E.engineOf(tm);
    const eperf=C.engineDev&&C.engineDev[em]?C.engineDev[em].perf:1;
    carPerf[tm]=C.teams[tm].perf*(0.5+eperf*0.5);
  }
  const roster=buildRoster(C);
  let grid=E.simQuali({...cfg,carPerf,roster});
  for(const code in C.gridPens){
    const i=grid.indexOf(code);
    if(i>=0){grid.splice(i,1);grid.splice(Math.min(i+C.gridPens[code],grid.length),0,code);
      news(C,'fia',`${C.drivers[code]?C.drivers[code].name:code} drops ${C.gridPens[code]} places on the grid (penalty applied).`);}
  }
  C.gridPens={};
  const relAdj={};
  for(const tm in C.teams){
    let worst=0;
    for(const code of C.teams[tm].seats){const k=C.components[code];if(k&&k.wear>worst)worst=k.wear;}
    relAdj[tm]=C.teams[tm].reliability-(worst>70?(worst-70)*0.0004:0);
  }
  const re=C.starStaff.find(st=>st.role==='RE'&&st.garden===0);
  return {practice:out,grid,carPerf,roster,rivalries:C.rivalries.slice(),
    components:JSON.parse(JSON.stringify(C.components)),
    reliability:relAdj};
}

/* ---------------- post-race ---------------- */
function postRace(C,R){
  const res=R.results;
  for(const r of res){
    C.driverPts[r.code]=(C.driverPts[r.code]||0)+r.pts;
    C.teamPts[r.team]=(C.teamPts[r.team]||0)+r.pts;
    const d=C.drivers[r.code];
    if(d){d.penPts+=r.penPts||0;
      if(d.penPts>=12){d.penPts=0;d.banned=1;
        news(C,'fia',`RACE BAN — ${d.name} reaches 12 penalty points and will miss the next Grand Prix.`);}
    }
  }
  for(const code in C.drivers)if(C.drivers[code].banned>0&&!res.some(r=>r.code===code))C.drivers[code].banned--;
  // morale: beaten by teammate, clause pressure
  for(const code in C.drivers){
    const d=C.drivers[code];
    const mine=res.find(r=>r.code===code),mate=res.find(r=>r.code!==code&&r.team===d.team);
    if(mine&&mate)d.morale+= mine.pos<mate.pos?0.03:-0.05;
    d.morale=Math.max(0,Math.min(1,d.morale));
    if(d.morale<0.35&&Math.random()<0.4)
      news(C,'rumour',`Paddock talk: ${d.name} increasingly frustrated at ${d.team}. Exit clause chatter grows.`);
  }
  // crash repair bills land on the cost cap
  const repairs={};
  for(const inc of (R.incidents||[]).filter(i=>i.type==='collision')){
    for(const code of inc.cars){const car=R.cars.find(x=>x.code===code);
      if(!car)continue;
      const bill=car.retired?5+Math.random()*4:1+Math.random()*2;
      repairs[car.team]=(repairs[car.team]||0)+bill;}}
  for(const tm in repairs){const T=C.teams[tm];if(!T)continue;
    T.capUsed+=repairs[tm];
    if(repairs[tm]>4)news(C,'paddock',`${tm}'s repair bill: $${repairs[tm].toFixed(1)}m — straight onto the cost cap.`);}
  // podium money: sponsor bonuses in, driver bonuses out
  for(const r of res.slice(0,3)){
    const T=C.teams[r.team];if(!T)continue;
    for(const sp of T.sponsorships||[])if(sp.clauses&&sp.clauses.podiumBonus){
      T.budget+=sp.clauses.podiumBonus;
      if(C.playerTeamHint===r.team)news(C,'market',`${sp.name} podium bonus: +$${sp.clauses.podiumBonus}m for ${r.team}.`);}
    const d=C.drivers[r.code];
    if(d&&d.clauses.podiumBonus){T.budget-=d.clauses.podiumBonus;d.morale=Math.min(1,d.morale+0.02);}
  }
  // rivalries spark rarely from repeated flashpoints
  for(const inc of (R.incidents||[]).filter(i=>i.type==='collision'&&i.cars.length===2)){
    const [a,b]=inc.cars;
    if(C.drivers[a]&&C.drivers[b]&&!C.rivalries.some(rv=>rv.includes(a)&&rv.includes(b))&&Math.random()<0.10){
      C.rivalries.push([a,b]);
      news(C,'media',`FEUD: ${C.drivers[a].name} and ${C.drivers[b].name} exchange barbs after another clash — "He knows what he did. Next time I won't lift."`);
    }
  }
  // component damage -> grid penalties next round
  for(const inc of (R.incidents||[]).filter(i=>i.type==='mech')){
    if(Math.random()<0.35){const code=inc.cars[0],places=Math.random()<0.5?5:10;
      C.gridPens[code]=(C.gridPens[code]||0)+places;
      news(C,'fia',`${C.drivers[code]?C.drivers[code].name:code} takes a fresh power unit — ${places}-place grid penalty for the next round.`);}
  }
  // TP scathing quotes after collisions
  const bigInc=(R.incidents||[]).filter(i=>i.type==='collision');
  if(bigInc.length&&Math.random()<0.7){
    const t=R.cars.find(c=>c.code===bigInc[0].cars[0]).team;
    news(C,'media',TP_QUOTES[Math.floor(Math.random()*TP_QUOTES.length)](t));
  }
  // challengeable incidents stored for stewards room
  C.pendingIncidents=(R.incidents||[]).filter(i=>i.challengeable||(i.type==='collision'&&!i.investigated));
  // juniors advance + talents
  for(const cat of [C.f2,C.f3]){
    cat.forEach(j=>j.pts+=Math.max(0,Math.round((j.rating-0.75)*80+ (Math.random()-0.5)*8)));
    cat.sort((a,b)=>b.pts-a.pts);
  }
  if(Math.random()<0.25){const star=C.f2[0];
    news(C,'media',`Junior watch: ${star.name} dominating F2 — F1 teams monitoring the situation.`);}
  // hall of records
  const w=res[0];if(w&&!w.retired){
    C.hall.wins[w.code]=(C.hall.wins[w.code]||0)+1;
    const n=C.hall.wins[w.code];
    if(n%5===0)news(C,'media',`RECORD WATCH: ${w.driver} takes career win #${n}.`);
    C.seasonRecords.push({race:C.raceIdx,text:`${w.code} wins`});
  }
  C.raceIdx++;
  for(const st of C.starStaff)if(st.garden>0)st.garden--;
  C.sponsorOffers=(C.sponsorOffers||[]).filter(o=>o.expires>C.raceIdx);
  for(const tm in C.teams){
    if(Math.random()<0.16){
      const off=makeSponsorOffer(C,tm);
      if(C.playerTeamHint&&tm===C.playerTeamHint){C.sponsorOffers.push({...off,team:tm});
        news(C,'market',`${off.name} want to talk sponsorship with ${tm} — offer on the table.`);}
      else if(Math.random()<0.5&&C.teams[tm].sponsorships.length<5){
        C.teams[tm].budget+=off.base;
        C.teams[tm].sponsorships.push({name:off.name,perYear:off.base,years:off.years,signedYear:C.year,paidThisSeason:true,clauses:{results:null,podiumBonus:0,exitFee:off.base}});
        if(off.base>=60)news(C,'market',`BLOCKBUSTER: ${off.name} announce a $${off.base}m/yr deal with ${tm}.`);
      }
    }
  }
  if(C.raceIdx===Math.floor(C.calendar.length/2)&&Math.random()<0.5&&C.playerTeamHint)
    issueDirective(C,Math.random()<0.5?'aero':'chassis');
  advanceNegotiations(C);
  academyTick(C);
  aiMarket(C);
  normalizeSeats(C);
  return standings(C);
}
function standings(C){
  const ds=Object.entries(C.driverPts).sort((a,b)=>b[1]-a[1]);
  const ts=Object.entries(C.teamPts).sort((a,b)=>b[1]-a[1]);
  return {drivers:ds,teams:ts};
}

/* ---------------- season end: money, ATR, cost cap review ---------------- */
function setBoardTarget(C,team){
  const rank=Object.keys(C.teams).map(t=>[t,C.teams[t].perf]).sort((a,b)=>b[1]-a[1]).findIndex(([t])=>t===team)+1;
  C.boardTarget=Math.max(1,rank-(C.rep>0.7?1:0));
  return C.boardTarget;
}
function seasonEnd(C){
  const ts=Object.keys(C.teams).map(tm=>[tm,C.teamPts[tm]||0]).sort((a,b)=>b[1]-a[1]);
  const events=[];
  ts.forEach(([tm,pts],i)=>{
    const T=C.teams[tm];
    const prize=C.prizeMode==='flat'?90:(PRIZE[i]||40);
    let income=0;
    for(const sp of T.sponsorships){
      let pay=sp.paidThisSeason?0:sp.perYear;             // year-1 money was banked at signing
      const rc=sp.clauses&&sp.clauses.results;
      if(pay&&rc&&i+1>rc.topN){pay=Math.round(pay*(1-rc.cutPct));
        news(C,'market',`${sp.name} cut ${tm}'s payment to $${pay}m — results clause triggered (P${i+1}).`);}
      sp.paidThisSeason=false;
      income+=pay;sp.years--;
      if(sp.years<=0)news(C,'market',`${sp.name}'s deal with ${tm} has expired.`);
    }
    T.sponsorships=T.sponsorships.filter(sp=>sp.years>0);
    const wages=wageBill(C,tm);
    T.budget+=prize+income-wages;
    if(T.budget<0){news(C,'media',`FINANCIAL CRISIS at ${tm}: wage bill exceeds income. The board demands cuts.`);T.budget=Math.max(T.budget,-30);}
    T.atr=0.7+0.05*i;                                     // P1 gets least tunnel time
    events.push({team:tm,prize,pos:i+1});
  });
  // cost cap review
  const reviews=[];
  for(const tm in C.teams){
    const T=C.teams[tm];
    if(T.capUsed>(C.costCap||135)){
      T.capBreached=true;
      reviews.push({team:tm,over:T.capUsed-(C.costCap||135),excuse:null,verdict:null});
      news(C,'fia',`IMA AUDIT: ${tm} exceeded the $${(C.costCap||135)}m cost cap by $${(T.capUsed-(C.costCap||135)).toFixed(1)}m. Investigation opened.`);
    }
    T.capUsed=0;T.devSpend=0;
  }
  // engine funds refresh
  for(const en in C.engines)C.engines[en].fund=80;
  // contracts tick down; expiries hit the market
  for(const code in C.drivers){
    const d=C.drivers[code];d.years--;
    if(d.years<=0){d.years=0;news(C,'market',`${d.name} is OUT OF CONTRACT at ${d.team} — free agent for ${C.year+1}.`);}
    d.penPts=Math.max(0,d.penPts-4);                      // points expire
  }
  // pre-contracts take effect
  for(const mv of C.futureMoves){
    const d=C.drivers[mv.code];if(!d)continue;
    const oldT=C.teams[d.team];if(oldT){const i=oldT.seats.indexOf(mv.code);if(i>=0)oldT.seats.splice(i,1);}
    d.team=mv.team;d.salary=mv.salary;d.years=mv.years;d.clauses.num1=mv.num1;d.morale=0.85;
    news(C,'market',`${d.name} officially starts at ${mv.team} for ${C.year+1}.`);
  }
  C.futureMoves=[];
  C.rivalries=C.rivalries.filter(()=>Math.random()<0.5);
  normalizeSeats(C);
  if(C.academy.level)for(const tm0 in C.teams)break;
  if(C.academy.level&&C.playerTeamHint&&C.teams[C.playerTeamHint])C.teams[C.playerTeamHint].budget-=C.academy.level;
  engineTick(C);
  C.year++;C.raceIdx=0;
  const fullD=standings(C).drivers;
  C.history.push({year:C.year,champion:fullD[0]?.[0],drivers:fullD.slice(0,22),teams:ts.map(([t,p])=>[t,Math.round(p)])});
  // the board judges you
  if(C.playerTeamHint&&C.boardTarget){
    const pos=ts.findIndex(([t])=>t===C.playerTeamHint)+1;
    const delta=C.boardTarget-pos;
    C.rep=Math.max(0,Math.min(1,C.rep+delta*0.07));
    if(delta<=-3){C.sacked=true;
      news(C,'media',`BREAKING: ${C.playerTeamHint} part ways with their team principal after finishing P${pos} against a P${C.boardTarget} target.`);}
    else if(delta>=1)news(C,'media',`The board praises a P${pos} finish — target was P${C.boardTarget}. Your stock rises.`);
  }
  // IMA presidential election every 4 seasons
  if((C.year-2026)%4===3){
    const strictVotes=Object.keys(C.teams).filter(()=>Math.random()<0.5).length;
    C.fiaTemper=strictVotes>Object.keys(C.teams).length/2?1.25:0.8;
    news(C,'fia',`IMA ELECTION: the ${C.fiaTemper>1?'hard-line':'reformist'} candidate wins. Expect ${C.fiaTemper>1?'stricter stewarding and audits':'a lighter regulatory touch'}.`);
  }
  // Concorde renegotiation every 3 seasons
  if((C.year-2026)%3===2){
    const flatVotes=ts.slice(5).filter(()=>Math.random()<0.85).length+ts.slice(0,5).filter(()=>Math.random()<0.15).length;
    C.prizeMode=flatVotes>5?'flat':'weighted';
    news(C,'fia',`CONCORDE AGREEMENT: prize money will be ${C.prizeMode==='flat'?'FLATTENED — small teams win the vote':'kept performance-weighted — the big teams hold the line'}.`);
  }
  const ds=standings(C).drivers;
  const champ=ds[0]?ds[0][0]:null;
  if(champ)C.hall.titles[champ]=(C.hall.titles[champ]||0)+1;
  const review={year:C.year-1,champion:champ,champPts:ds[0]?ds[0][1]:0,
    top3:ds.slice(0,3),constructors:ts.slice(0,8),
    mostWins:Object.entries(C.hall.wins).sort((a,b)=>b[1]-a[1])[0],
    records:C.seasonRecords.slice(-6),
    engines:Object.entries(C.engineDev).map(([em,d])=>({em,perf:+d.perf.toFixed(4),spend:Math.round(d.spend),banned:d.bannedUntil>C.year,edt:d.edt})).sort((a,b)=>b.perf-a.perf),
    marketMoves:C.media.filter(m=>m.kind==='market').slice(-8).map(m=>m.text),
    costCap:C.costCap,customerCap:C.customerCap};
  C.seasonRecords=[];
  C.driverPts={};C.teamPts={};
  return {prizeEvents:events,capReviews:reviews,review};
}
function judgeCapBreach(C,team,excuseAccepted,severity){
  const T=C.teams[team];
  if(excuseAccepted){T.capBreached=false;
    news(C,'fia',`IMA accepts ${team}'s explanation (inflation & catering). No penalty.`);
    return {penalty:'none'};}
  if(severity==='minor'){T.atr*=0.9;T.budget-=7;
    news(C,'fia',`${team} found in MINOR breach: $7m fine + 10% aero testing reduction.`);
    return {penalty:'fine+ATR'};}
  C.teamPts[team]=0;
  news(C,'fia',`${team} found in MATERIAL breach: constructors' points EXCLUDED this season.`);
  return {penalty:'exclusion'};
}

/* ---------------- development ---------------- */
function develop(C,team,area,spend){
  const T=C.teams[team];
  if(spend<=0||T.budget<spend)return{ok:false,why:'Insufficient budget'};
  T.budget-=spend;T.devSpend+=spend;T.capUsed+=spend;
  const chief=C.starStaff.find(st=>st.role==='AERO'&&st.team===team&&st.garden===0);
  const eff=(0.00012*T.atr*(0.7+T.staff/200))*(chief?1+chief.skill*0.25:1)*spend;
  if(area==='engine'){
    const en=C.engines[T.engine];
    if(en.fund<spend)return{ok:false,why:'Engine fund empty'};
    en.fund-=spend;T.capUsed-=spend;                      // engine fund outside cap
    en.perf+=eff*0.5;
    for(const tm of E.ENGINES[T.engine].teams)if(C.teams[tm])C.teams[tm].perf+=eff*0.5;
    return{ok:true,gain:eff*0.5,note:'Engine gain shared with all customer teams'};
  }
  T.perf+=eff;T.devPts[area]=(T.devPts[area]||0)+spend;
  if(T.capUsed>(C.costCap||135)&&Math.random()<0.5)
    news(C,'rumour',`Whispers in the paddock: ${team}'s spending this season looks... ambitious.`);
  return{ok:true,gain:eff};
}
function poachStaff(C,team,name,salary){
  const st=C.starStaff.find(x=>x.name===name);if(!st)return{ok:false};
  const T=C.teams[team];
  if(T.budget<salary)return{ok:false,why:'Insufficient budget'};
  const p=st.team?Math.max(0.1,Math.min(0.9,0.35+(salary-st.salary)/st.salary*0.4)):0.9;
  if(Math.random()>p)return{ok:true,accepted:false,p,why:st.name+' stays put'};
  const from=st.team;
  st.team=team;st.salary=salary;st.garden=from?3:0;
  T.budget-=salary;
  news(C,'market',`${st.name} (${st.role==='AERO'?'aero chief':'race engineer'}) joins ${team}${from?` from ${from} — on gardening leave for 3 rounds`:''}.`);
  return{ok:true,accepted:true};
}
function hireStaff(C,team,n){
  const T=C.teams[team];const cost=n*0.8;
  if(T.budget<cost)return{ok:false};
  T.budget-=cost;T.capUsed+=cost;T.staff+=n;return{ok:true};
}

/* ---------------- driver market ---------------- */
function approachDriver(C,team,code,offer){
  // offer:{salary,years,num1,releaseBuyout}
  const d=C.drivers[code];if(!d)return{ok:false,why:'unknown driver'};
  const T=C.teams[team];
  if(d.team===team)return{ok:false,why:'already your driver'};
  const cur=C.teams[d.team];
  const buyout=d.years>0?d.clauses.releaseFee:0;
  const cost=(offer.releaseBuyout?buyout:0);
  if(offer.salary>120)return{ok:false,why:'No driver on the grid earns over $120m/yr — be serious'};
  if(T.budget<cost+offer.salary)return{ok:false,why:`Unaffordable: need $${buyout}m buyout + $${offer.salary}m first-year salary in the bank (budget $${T.budget.toFixed(0)}m)`};
  // acceptance model: money, car, status, morale
  let score=0;
  score+=Math.tanh((offer.salary-d.salary)/Math.max(d.salary,4))*0.35;
  score+=(T.perf-cur.perf)*22;
  score+=offer.num1&&!d.clauses.num1?0.18:0;
  score+=(1-d.morale)*0.35;
  score+=offer.years>=2?0.06:0;
  score+=offer.exitN>0?0.08:0;                              // freedom appeals
  score+=offer.podiumBonus?Math.min(offer.podiumBonus/20,0.15):0;
  score-=offer.releaseFee&&offer.releaseFee>offer.salary?0.05:0;  // golden handcuffs
  if(d.years>0&&!offer.releaseBuyout)return{ok:false,why:'Under contract — buyout required',score};
  if(d.team!=='FREE'&&offer.when!=='nextSeason'&&!offer._resolve){
    // contracted stars negotiate over weeks: agents counter, rivals lurk
    C.negotiations=C.negotiations.filter(n=>!(n.code===code&&n.team===team));
    const counter=Math.round(offer.salary*(1.08+Math.random()*0.15));
    C.negotiations.push({id:Math.random().toString(36).slice(2,7),code,team,offer:{...offer},round:1,demand:counter,hijack:null});
    news(C,'rumour',`${d.name}'s agent opens talks with ${team}. Camp demands ~$${counter}m/yr.`);
    return{ok:true,negotiating:true,demand:counter};
  }
  const p=Math.max(0.03,Math.min(0.96,0.42+score));
  const rng=Math.random();
  if(rng<p){
    if(offer.when==='nextSeason'){
      C.futureMoves.push({code,team,salary:offer.salary,years:offer.years,num1:!!offer.num1});
      news(C,'market',`BOMBSHELL: ${d.name} signs a pre-contract with ${team} for ${C.year+1} — $${offer.salary}m/yr, ${offer.years} years. He races out the season at ${d.team}.`);
      return{ok:true,accepted:true,deferred:true,p};
    }
    if(cost){T.budget-=cost;cur.budget+=cost;}
    const old=d.team;d.team=team;d.salary=offer.salary;d.years=offer.years;
    d.clauses={num1:!!offer.num1,exitIfNotTopN:offer.exitN||0,
      releaseFee:Math.round(offer.releaseFee??Math.max(15,offer.salary*0.6)),
      podiumBonus:offer.podiumBonus||0};
    d.morale=0.8;
    const oldT=C.teams[old];if(oldT){const i=oldT.seats.indexOf(code);if(i>=0)oldT.seats.splice(i,1);}
    news(C,'market',`OFFICIAL: ${d.name} signs for ${team} — $${offer.salary}m/yr, ${offer.years} years${offer.num1?', guaranteed #1 status':''}. ${old} receive $${cost}m buyout.`);
    return{ok:true,accepted:true,p};
  }
  if(Math.random()<0.5)news(C,'rumour',`Sources: ${team} made an approach for ${d.name}. Talks ${p>0.4?'ongoing':'went nowhere'}.`);
  return{ok:true,accepted:false,p,why:'Driver declined'};
}
function advanceNegotiations(C){
  for(const n of C.negotiations){
    if(n.done)continue;
    if(!n.hijack&&Math.random()<0.15){
      const rivals=Object.keys(C.teams).filter(t=>t!==n.team&&t!==C.drivers[n.code].team);
      n.hijack=rivals[Math.floor(Math.random()*rivals.length)];
      n.demand=Math.round(n.demand*1.18);
      news(C,'rumour',`HIJACK: ${n.hijack} enter the race for ${C.drivers[n.code].name}. Price jumps to ~$${n.demand}m/yr.`);
    }
  }
}
function respondNegotiation(C,id,action,newSalary){
  const n=C.negotiations.find(x=>x.id===id);if(!n||n.done)return{ok:false};
  const d=C.drivers[n.code];
  if(action==='walk'){n.done=true;C.negotiations=C.negotiations.filter(x=>x!==n);
    news(C,'rumour',`${n.team} walk away from the ${d.name} deal.`);return{ok:true,walked:true};}
  n.offer.salary=newSalary;n.round++;
  if(newSalary>=n.demand*0.95||n.round>3){
    n.offer._resolve=true;
    const r=approachDriver(C,n.team,n.code,n.offer);
    C.negotiations=C.negotiations.filter(x=>x!==n);
    return{ok:true,resolved:true,result:r};
  }
  n.demand=Math.round(n.demand*1.05);
  news(C,'rumour',`${d.name} talks continue — camp now wants ~$${n.demand}m/yr (round ${n.round}).`);
  return{ok:true,resolved:false,demand:n.demand};
}
function releaseDriver(C,team,code){
  const d=C.drivers[code];if(!d||d.team!==team)return{ok:false};
  const comp=d.salary*d.years*0.75;                        // Ricciardo-style payout
  const T=C.teams[team];
  if(T.budget<comp)return{ok:false,why:`Severance costs $${comp.toFixed(0)}m`};
  T.budget-=comp;d.team='FREE';d.morale=0.3;
  const i=T.seats.indexOf(code);if(i>=0)T.seats.splice(i,1);
  if(T.reserve===code)T.reserve=null;
  news(C,'market',`${team} TERMINATE ${d.name}'s contract early — $${comp.toFixed(0)}m compensation paid.`);
  return{ok:true,comp};
}
function signFree(C,team,code,offer){
  const d=C.drivers[code];
  if(!d||d.team!=='FREE')return{ok:false};
  const T2=C.teams[team];
  if(offer.salary>120)return{ok:false,why:'Salary cap sanity: max $120m/yr'};
  if(T2&&T2.budget<offer.salary)return{ok:false,why:`Unaffordable: $${offer.salary}m salary vs $${T2.budget.toFixed(0)}m budget`};
  d.team=team;d.salary=offer.salary;d.years=offer.years;d.morale=0.75;
  news(C,'market',`${d.name} joins ${team} — $${offer.salary}m x ${offer.years}yr.`);
  return{ok:true,needsSeat:true};
}
function setAcademy(C,level){C.academy.level=level;
  news(C,'paddock',`Academy programme ${level?'funded at $'+level+'m/yr':'shut down'}.`);}
function academyTick(C){
  const L=C.academy.level;if(!L)return;
  if(Math.random()<L*0.05){
    const nm=FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)]+' '+LAST_NAMES[Math.floor(Math.random()*LAST_NAMES.length)];
    const pot=0.75+Math.random()*0.22;
    C.academy.karters.push({name:nm,age:15+Math.floor(Math.random()*3),pot,shown:pot>0.9?'⭐ exceptional':pot>0.83?'promising':'raw'});
    if(pot>0.9)news(C,'media',`Scouting report: karting sensation ${nm} linked to your academy.`);
  }
}
function promoteKarter(C,idx){
  const k=C.academy.karters[idx];if(!k)return{ok:false};
  C.academy.karters.splice(idx,1);
  C.f3.push({name:k.name,cat:'F3',pts:0,rating:k.pot*0.92,talent:k.pot});
  C.f3.sort((a,b)=>b.pts-a.pts);
  news(C,'market',`${k.name} graduates from the academy into F3.`);
  return{ok:true};
}
function promoteJunior(C,team,idx){
  const j=C.f2[idx];if(!j)return{ok:false};
  const code=uniqueCode(C,j.name);
  C.drivers[code]={code,name:j.name,team,cons:0.8,agg:0.75,salary:1.5,years:2,
    clauses:{num1:false,exitIfNotTopN:0,releaseFee:8},morale:0.9,penPts:0,banned:0,rating:j.rating};
  C.f2.splice(idx,1);
  news(C,'market',`${team} sign F2 star ${j.name}!`);
  return{ok:true,code,needsSeat:true};
}
/* AI teams work the market + development between races */
function aiMarket(C){
  for(const tm in C.teams){
    const T=C.teams[tm];
    // AI develops: top teams spend hard but respect the cap
    const room=(C.costCap||135)-T.capUsed;
    const want=Math.min(room*0.10,T.budget*0.15,9);
    if(want>1)develop(C,tm,Math.random()<0.6?'aero':'chassis',+want.toFixed(1));
    // exit clauses trigger
  }
  const ts=standings(C).teams;
  for(const code in C.drivers){
    const d=C.drivers[code];
    if(d.team==='FREE'||!d.clauses.exitIfNotTopN)continue;
    const pos=ts.findIndex(([t])=>t===d.team)+1;
    if(C.raceIdx>10&&pos>d.clauses.exitIfNotTopN&&Math.random()<0.12){
      news(C,'rumour',`BOMBSHELL: ${d.name} can trigger an exit clause — ${d.team} outside the top ${d.clauses.exitIfNotTopN}.`);
      d.morale=Math.min(d.morale,0.3);
    }
  }
}

/* ---------------- regulations / governance ---------------- */
function proposeReg(C,title,effect){
  // teams vote, biased toward their engine manufacturer's interest
  const beneficiary=effect.favours;                        // engine name or 'none'
  const votes={};
  for(const tm in C.teams){
    const T=C.teams[tm];
    let p=0.5;
    if(beneficiary&&T.engine===beneficiary)p=0.92;
    else if(beneficiary)p=0.3;
    if(standings(C).teams.findIndex(([t])=>t===tm)<3)p-=0.1;   // leaders resist change
    votes[tm]=Math.random()<p;
  }
  const yes=Object.values(votes).filter(Boolean).length;
  const passed=yes>Object.keys(votes).length/2;
  return {title,votes,yes,passed,effect};
}
function applyReg(C,reg,fiaOverride){
  const goes=fiaOverride!==undefined?fiaOverride:reg.passed;
  if(!goes){news(C,'fia',`Regulation "${reg.title}" REJECTED (${reg.yes} votes for).`);return false;}
  if(reg.effect.shake){                                    // aero reset: field compresses
    for(const tm in C.teams){const T=C.teams[tm];T.perf=1+(T.perf-1)*0.45;}
  }
  if(reg.effect.engineBoost)C.engines[reg.effect.engineBoost].perf+=0.004;
  news(C,'fia',`Regulation "${reg.title}" ${fiaOverride!==undefined?'IMPOSED BY THE IMA'+(reg.passed?'':' overriding the vote'):'passes'} — teams must adapt for ${C.year+1}.`);
  C.regs.push(reg.title);
  return true;
}
function addTeamVote(C,name,fee){
  const votes={};let yes=0;
  for(const tm in C.teams){votes[tm]=Math.random()<0.35+fee/600;if(votes[tm])yes++;}
  return {name,fee,votes,yes,passed:yes>Object.keys(C.teams).length/2};
}

function fileProtest(C,R){
  // a rival protests the player's car after a close defeat
  if(!C.playerTeamHint)return null;
  const res=R.results;if(!res)return null;
  const mine=res.filter(r=>r.team===C.playerTeamHint&&!r.retired);
  if(!mine.length)return null;
  const best=mine[0];
  const rival=res.find(r=>r.pos===best.pos+1&&r.team!==C.playerTeamHint);
  if(!rival||Math.random()>0.10)return null;
  news(C,'fia',`PROTEST: ${rival.team} formally protest the legality of ${C.playerTeamHint}'s car (P${best.pos}).`);
  return {by:rival.team,against:best.code,pos:best.pos};
}
function resolveProtest(C,R,protest,defence){
  // defence: 'disclose' (safe: small ATR cost) | 'stonewall' (risky: possible DSQ)
  const T=C.teams[C.playerTeamHint];
  if(defence==='disclose'){T.atr*=0.97;
    news(C,'fia',`Stewards accept ${C.playerTeamHint}'s full technical disclosure. Protest dismissed; minor test-time deduction for the inspection.`);
    return{dsq:false};}
  if(Math.random()<0.25){
    const car=R.cars.find(x=>x.code===protest.against);
    if(car){car.retired=true;car.dsq=true;
      const order=[...R.cars].sort((a,b)=>{if(a.retired!==b.retired)return a.retired?1:-1;
        if(a.retired)return (b.lap-a.lap)||(a.totalT-b.totalT);
        return (a.totalT+a.penalty)-(b.totalT+b.penalty);});
      R.results=order.map((c2,i)=>({...R.results.find(r=>r.code===c2.code),pos:i+1,
        pts:c2.retired?0:(E.POINTS[i]||0)}));
      news(C,'fia',`BOMBSHELL: ${protest.against} DISQUALIFIED — the floor fails inspection. Results amended.`);
      return{dsq:true};}}
  news(C,'fia',`${C.playerTeamHint} stonewall the protest — and get away with it. Case dismissed.`);
  return{dsq:false};
}
function issueDirective(C,area){
  const ranked=Object.entries(C.teams).sort((a,b)=>(b[1].devPts[area]||0)-(a[1].devPts[area]||0)).slice(0,3);
  for(const [tm,T] of ranked)T.perf-=0.004;
  news(C,'fia',`TECHNICAL DIRECTIVE: ${area==='aero'?'flexi-wing tolerances tightened':'chassis flexibility clamp'} — ${ranked.map(([t])=>t).join(', ')} hit hardest.`);
  return ranked.map(([t])=>t);
}
/* ---------------- engine ecosystem ---------------- */
function enginePerf(C,em){return C.engineDev[em]?C.engineDev[em].perf:E.ENGINES[em].perf;}
function engineCustomers(C,em){
  return Object.keys(C.teams).filter(t=>(C.teams[t].engine||E.engineOf(t))===em);
}
function switchEngine(C,team,em){
  const T=C.teams[team];
  if(!T)return{ok:false};
  if(T.engineSeasons<2)return{ok:false,why:`Supply contracts run 2 seasons minimum — ${2-T.engineSeasons} more to serve`};
  if(!C.engineDev[em])return{ok:false,why:'No such manufacturer'};
  if(engineCustomers(C,em).length>=C.customerCap)return{ok:false,why:`${em} already supply the maximum ${C.customerCap} teams (change via regulation)`};
  const from=T.engine||E.engineOf(team);
  T.engine=em;T.engineSeasons=0;T.budget-=15;
  news(C,'market',`ENGINE DEAL: ${team} switch from ${from} to ${em} power ($15m supply fee).`);
  return{ok:true};
}
function becomeManufacturer(C,team,emName){
  const T=C.teams[team];
  if(!T)return{ok:false};
  if(T.budget<150)return{ok:false,why:'Building a power unit division costs $150m up front'};
  if(T.facility<0.7)return{ok:false,why:'Facility rating too low — invest in staff/infrastructure first (needs 0.70)'};
  const nm=emName||team.split(' ')[0]+' Power';
  if(C.engineDev[nm])return{ok:false,why:'Name taken'};
  T.budget-=150;
  const worst=Math.min(...Object.values(C.engineDev).map(d=>d.perf));
  C.engineDev[nm]={perf:worst-0.003,bannedUntil:0,edt:0,spend:150};
  T.engine=nm;T.engineSeasons=0;
  news(C,'market',`HISTORIC: ${team} become a works engine manufacturer — ${nm} debuts at the back of the grid.`);
  return{ok:true,name:nm};
}
function developEngine(C,team,spend){
  const em=C.teams[team]?(C.teams[team].engine||E.engineOf(team)):team;
  const d=C.engineDev[em];if(!d)return{ok:false};
  if(!engineCustomers(C,em).includes(team)&&C.teams[team])return{ok:false,why:'Not your power unit'};
  if(d.bannedUntil>C.year){
    if(d.edt>0){d.edt--;d.perf+=0.004;d.spend+=spend;
      news(C,'paddock',`${em} burn an Engine Development Token — one major upgrade despite the freeze (${d.edt} EDT left).`);
      return{ok:true,edt:true};}
    return{ok:false,why:`${em} are banned from development until ${d.bannedUntil} (IMA sanction). EDTs: 0`};
  }
  const T=C.teams[team];
  if(T){if(T.budget<spend)return{ok:false,why:'Budget'};T.budget-=spend;}
  d.perf+=spend*0.00008;d.spend+=spend;
  return{ok:true};
}
function banEngineDev(C,em,years){
  const d=C.engineDev[em];if(!d)return{ok:false};
  d.bannedUntil=C.year+years;
  news(C,'fia',`IMA SANCTION: ${em} banned from power-unit development until ${C.year+years}.`);
  return{ok:true};
}
function grantEDT(C,em,n){
  const d=C.engineDev[em];if(!d)return{ok:false};
  d.edt+=(n||1);
  news(C,'fia',`IMA grant ${em} ${n||1} Engine Development Token${n>1?'s':''} (${d.edt} held).`);
  return{ok:true,total:d.edt};
}
function engineTick(C){ // AI EM development each season + supplier switching appetite
  for(const em in C.engineDev){
    const d=C.engineDev[em];
    if(d.bannedUntil>C.year){if(d.edt>0&&Math.random()<0.6){d.edt--;d.perf+=0.004;
      news(C,'paddock',`${em} cash an EDT for a big winter upgrade.`);}continue;}
    const gain=0.0008+Math.random()*0.0016;
    d.perf+=gain;d.spend+=Math.round(20+Math.random()*30);
  }
  // customers eye better engines
  for(const tm in C.teams){
    const T=C.teams[tm];T.engineSeasons++;
    if(tm===C.playerTeamHint)continue;
    const cur=T.engine||E.engineOf(tm);
    if(C.engineDev[cur]&&Object.keys(E.ENGINES).includes(cur)===false)continue;
    const best=Object.entries(C.engineDev).sort((a,b)=>b[1].perf-a[1].perf)[0];
    if(best[0]!==cur&&best[1].perf-enginePerf(C,cur)>0.004&&T.engineSeasons>=2
       &&engineCustomers(C,best[0]).length<C.customerCap&&Math.random()<0.25){
      switchEngine(C,tm,best[0]);
    }
  }
  C.engineHistory[C.year]=Object.fromEntries(Object.entries(C.engineDev).map(([k,v])=>[k,+v.perf.toFixed(4)]));
}

/* ---------------- rich regulations ---------------- */
const REG_TYPES=[
 {id:'flexi',title:'Flexi-wing tolerance clampdown',area:'aero',dPerf:-0.005},
 {id:'rearwing',title:'Rear-wing slot-gap redesign',area:'aero',dPerf:0.004},
 {id:'floor',title:'Floor-edge simplification',area:'chassis',dPerf:-0.004},
 {id:'battery',title:'Battery cell energy-density increase',area:'engine',dPerf:0.004},
 {id:'deploy',title:'ERS deployment map restrictions',area:'engine',dPerf:-0.003},
 {id:'party',title:'Qualifying "party modes" ban',area:'engine',dPerf:-0.004},
 {id:'das',title:'Dual-axis steering (DAS) legalisation',area:'chassis',dPerf:0.005},
 {id:'custcap',title:'Change engine customer limit',area:'sporting',dPerf:0},
 {id:'freeze',title:'Full engine development freeze',area:'engine',dPerf:0},
 {id:'fuelflow',title:'Fuel-flow limit reduction',area:'engine',dPerf:-0.003},
 {id:'tyreblanket',title:'Tyre blanket ban',area:'sporting',dPerf:-0.002},
 {id:'sprintplus',title:'Expand sprint calendar',area:'sporting',dPerf:0}];
function proposeReg(C,typeId,beneficiaries,proposer,extra){
  const t=REG_TYPES.find(x=>x.id===typeId);if(!t)return{ok:false};
  const bens=beneficiaries||[];
  const votes={};
  for(const tm in C.teams){
    let p=0.5;
    if(bens.includes(tm))p=0.93;
    else if(bens.length)p=0.28;
    if(tm===proposer)p=0.98;
    const pos=Object.keys(C.teams).map(x=>[x,C.teamPts[x]||0]).sort((a,b)=>b[1]-a[1]).findIndex(([x])=>x===tm);
    if(pos<3&&t.dPerf<0)p-=0.12;
    votes[tm]=Math.random()<p;
  }
  const yes=Object.values(votes).filter(Boolean).length;
  return{ok:true,type:t,beneficiaries:bens,proposer,votes,yes,total:Object.keys(votes).length,
    passed:yes>Object.keys(votes).length/2,extra};
}
function applyReg(C,reg,imaDecision){
  // imaDecision: 'honour' (follow the vote) | 'force' | 'block'
  const enact=imaDecision==='force'||(imaDecision!=='block'&&reg.passed);
  if(!enact){news(C,'fia',`IMA ${imaDecision==='block'?'VETO the':'let die the'} "${reg.type.title}" proposal (${reg.yes}/${reg.total} in favour).`);
    return{enacted:false};}
  if(reg.type.id==='custcap'){C.customerCap=Math.max(1,Math.min(6,reg.extra||3));
    news(C,'fia',`REGULATION: engine customer limit set to ${C.customerCap} teams per manufacturer.`);return{enacted:true};}
  if(reg.type.id==='freeze'){for(const em in C.engineDev)C.engineDev[em].bannedUntil=Math.max(C.engineDev[em].bannedUntil,C.year+1);
    news(C,'fia','REGULATION: full engine development freeze for one year.');return{enacted:true};}
  for(const tm of reg.beneficiaries){if(C.teams[tm])C.teams[tm].perf+=Math.abs(reg.type.dPerf);}
  if(reg.type.dPerf<0)for(const tm in C.teams){
    if(!reg.beneficiaries.includes(tm))C.teams[tm].perf+=reg.type.dPerf*0.5;}
  news(C,'fia',`REGULATION ENACTED: ${reg.type.title}. Beneficiaries: ${reg.beneficiaries.join(', ')||'—'}.`);
  return{enacted:true};
}
function fileDevice(C,team,name){
  const dev={id:Math.random().toString(36).slice(2,7),team,name,challenged:null,ruled:false};
  C.deviceCases.push(dev);
  news(C,'paddock',`INNOVATION: ${team} arrive with a novel device — the paddock calls it "${name}".`);
  // someone challenges?
  const rivals=Object.keys(C.teams).filter(t=>t!==team);
  if(Math.random()<0.75){dev.challenged=rivals[Math.floor(Math.random()*rivals.length)];
    news(C,'fia',`${dev.challenged} formally challenge the legality of ${team}'s "${name}".`);}
  return dev;
}
function ruleDevice(C,devId,verdict){ // 'legal' | 'ban' | 'legal-season'
  const dev=C.deviceCases.find(d=>d.id===devId);if(!dev||dev.ruled)return{ok:false};
  dev.ruled=true;dev.verdict=verdict;
  const T=C.teams[dev.team];
  if(verdict==='legal'){T.perf+=0.006;news(C,'fia',`IMA rule ${dev.team}'s "${dev.name}" LEGAL. Others must catch up.`);}
  else if(verdict==='legal-season'){T.perf+=0.004;news(C,'fia',`IMA: "${dev.name}" legal THIS season only — banned from next year.`);}
  else news(C,'fia',`IMA BAN ${dev.team}'s "${dev.name}" with immediate effect.`);
  return{ok:true};
}

/* ---------------- IMA elections ---------------- */
function runElection(C,mode,choice){
  // mode 'rc': player is the incumbent president. choice: 'clean'|'favours'|'rig'
  // mode 'tp': player is a team. choice: {vote:'incumbent'|'challenger', lobby:0|20}
  C.electionDue=false;
  const teams=Object.keys(C.teams);
  const out={scandal:false,won:false,turnout:{}};
  if(mode==='rc'){
    let base=0.35+C.rep*0.5;
    if(choice==='favours'){base+=0.18;
      if(Math.random()<0.30){out.scandal=true;C.rep=Math.max(0,C.rep-0.2);
        news(C,'media',`LEAK: the president promised regulatory favours to backmarkers for votes. Ugly headlines.`);}}
    if(choice==='rig'){
      out.won=true;
      if(Math.random()<0.25){out.scandal=true;C.rep=Math.max(0,C.rep-0.35);C.imaWeak=C.year+4;
        news(C,'media',`SCANDAL OF THE DECADE: ballot irregularities traced to the president's office. You survive — barely — but the teams no longer fear your veto.`);}
      else news(C,'fia',`IMA ELECTION: a landslide. Some in the paddock mutter about the count…`);
    }else{
      for(const tm of teams)out.turnout[tm]=Math.random()<base;
      out.won=Object.values(out.turnout).filter(Boolean).length>teams.length/2;
      news(C,'fia',out.won?`IMA ELECTION: you are re-elected president (${Object.values(out.turnout).filter(Boolean).length}/${teams.length} teams).`
        :`IMA ELECTION: you LOSE the presidency. A caretaker rubber-stamps the votes now — your force/veto powers are suspended for 4 years.`);
      if(!out.won)C.imaWeak=C.year+4;
    }
    return out;
  }
  // tp: two AI candidates
  let strict=teams.filter(()=>Math.random()<0.5).length;
  if(choice&&choice.lobby){const T=C.teams[C.playerTeamHint];
    if(T&&T.budget>=choice.lobby){T.budget-=choice.lobby;
      strict+=choice.vote==='incumbent'?2:-2;
      if(Math.random()<0.20){out.scandal=true;T.budget-=15;C.rep=Math.max(0,(C.rep||0.5)-0.1);
        news(C,'media',`LOBBYING SCANDAL: ${C.playerTeamHint} caught funnelling money into the IMA election. $15m fine.`);}}}
  strict+=choice&&choice.vote==='incumbent'?1:-1;
  C.fiaTemper=strict>teams.length/2?1.25:0.8;
  news(C,'fia',`IMA ELECTION: the ${C.fiaTemper>1?'hard-line incumbent retains power':'reformist challenger wins'}. Expect ${C.fiaTemper>1?'stricter stewarding and audits':'a lighter touch'}.`);
  return out;
}
/* ---------------- fine appeals ---------------- */
function fileFineAppeal(C,team,amount,reason){
  const evid=['telemetry shows compliance','precedent from a prior ruling','procedural error by stewards','force majeure — component failure'][Math.floor(Math.random()*4)];
  const a={id:Math.random().toString(36).slice(2,7),team,amount,reason,evidence:evid,resolved:false};
  C.fineAppeals.push(a);
  news(C,'fia',`APPEAL LODGED: ${team} contest their $${amount}m fine, citing ${evid}.`);
  return a;
}
function resolveFineAppeal(C,id,decision){ // 'retreat' | 'enforce'
  const a=C.fineAppeals.find(x=>x.id===id);if(!a||a.resolved)return{ok:false};
  a.resolved=true;a.decision=decision;
  if(decision==='retreat'){const T=C.teams[a.team];if(T)T.budget+=a.amount;
    news(C,'fia',`IMA RETREAT: ${a.team}'s $${a.amount}m fine overturned and refunded.`);}
  else news(C,'fia',`IMA ENFORCE: ${a.team}'s appeal dismissed — the $${a.amount}m fine stands.`);
  return{ok:true};
}

/* ---------------- stewards room ---------------- */
function challengePenalty(C,R,incidentIdx,accept){
  const inc=C.pendingIncidents[incidentIdx];
  if(!inc)return{ok:false};
  inc.resolved=true;
  if(accept&&inc.penalised){
    E.reversePenalty(R,inc.cars[0],inc.secs||5);
    const c=R.cars.find(x=>x.code===inc.cars[0]);
    if(c)c.penPts=Math.max(0,c.penPts-(inc.pts||0));
    // reclassify
    const order=[...R.cars].sort((a,b)=>{if(a.retired!==b.retired)return a.retired?1:-1;
      if(a.retired)return (b.lap-a.lap)||(a.totalT-b.totalT);
      return (a.totalT+a.penalty)-(b.totalT+b.penalty);});
    R.results=order.map((c2,i)=>({...R.results.find(r=>r.code===c2.code),pos:i+1,
      pts:c2.retired?0:(E.POINTS[i]||0)}));
    news(C,'fia',`STEWARDS: penalty for ${inc.cars[0]} RESCINDED after review of new evidence. Results amended.`);
    return{ok:true,reversed:true};
  }
  news(C,'fia',`STEWARDS: ${inc.cars.join('/')} ${inc.type} — challenge ${accept?'reviewed, penalty applied':'REJECTED. Decision stands.'}`);
  return{ok:true,reversed:false};
}

/* ---------------- save ---------------- */
function save(C){return JSON.stringify(C);}
function load(str){return JSON.parse(str);}

return {newCareer,preWeekend,postRace,seasonEnd,judgeCapBreach,develop,hireStaff,
        sponsorIncome,wageBill,makeSponsorOffer,negotiateSponsor,terminateSponsor,seasonOffers,
        componentTick,takeFreshUnit,poachStaff,respondNegotiation,advanceNegotiations,
        setAcademy,academyTick,promoteKarter,setBoardTarget,
        fileProtest,resolveProtest,issueDirective,
        enginePerf,engineCustomers,switchEngine,becomeManufacturer,developEngine,
        banEngineDev,grantEDT,engineTick,REG_TYPES,fileDevice,ruleDevice,
        fileFineAppeal,resolveFineAppeal,runElection,
        buildRoster,normalizeSeats,assignSeat,
        approachDriver,releaseDriver,signFree,promoteJunior,aiMarket,
        proposeReg,applyReg,addTeamVote,challengePenalty,standings,news,
        save,load,PRIZE};
})();
if(typeof module!=='undefined')module.exports=CAREER;
