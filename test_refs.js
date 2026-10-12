// STATIC GUARD: every ENGINE.* / CAREER.* referenced by game.js must exist — and the PACKAGED file must match src
const fs=require('fs');
global.ENGINE=require('./src/engine.js');
const CAREER=require('./src/career.js');
const g=fs.readFileSync('src/game.js','utf8');
let bad=[];
for(const [obj,name] of [[global.ENGINE,'ENGINE'],[CAREER,'CAREER']]){
  const used=new Set([...g.matchAll(new RegExp(name+'\\.(\\w+)','g'))].map(m=>m[1]));
  for(const k of used)if(!(k in obj))bad.push(name+'.'+k);
}
if(bad.length)throw new Error('MISSING EXPORTS: '+bad.join(', '));
console.log('static reference check: all ENGINE./CAREER. calls exist');
// packaged file contains current src (guards stale assembly)
const idx=fs.readFileSync('index.html','utf8');
for(const f of ['src/engine.js','src/career.js','src/game.js']){
  const head=fs.readFileSync(f,'utf8').slice(0,400);
  if(!idx.includes(head))throw new Error('index.html stale vs '+f);
  const probe=fs.readFileSync(f,'utf8');
  for(const token of ['blackFlag,driveThrough,setPitOpen,chequered','assignSeat','navMenu','renderHubExtras','grantEDT','renameTeamEverywhere','playQuali'])
    if(probe.includes(token)&&!idx.includes(token))throw new Error('token missing from package: '+token);
}
console.log('packaged index.html matches src (incl. power exports)');
const shell=fs.readFileSync('src/shell.html','utf8');
const ids=new Set([...g.matchAll(/\$\('([A-Za-z_][\w]*)'\)/g)].map(m=>m[1]));
const missing=[...ids].filter(id=>!shell.includes('id="'+id+'"')&&!g.includes("id='"+id+"'")&&!g.includes('id="'+id+'"')&&!g.includes(".id='"+id+"'"));
if(missing.length)throw new Error('DOM ids referenced but never created: '+missing.join(', '));
console.log('DOM guard: all '+ids.size+' referenced element ids exist');
