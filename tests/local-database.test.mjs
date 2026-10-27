import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {localDatabase,seedLocalDatabase,readLocalState} from '../orchestrator/local-database.mjs';
import {Coordinator} from '../orchestrator/coordination.mjs';
const documents={'settings/global':{workerEnabled:true},'projects/a':{enabled:true,weight:100},'tasks/one':{projectId:'a',target:'app',status:'queued',approved:true,priority:1,createdAt:1},'tasks/two':{projectId:'a',target:'app',status:'queued',approved:true,priority:1,createdAt:2}};
async function setup(t){const dir=await mkdtemp(path.join(tmpdir(),'bcc-local-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'db.json');await seedLocalDatabase(file,{provenance:{source:'test snapshot',capturedAt:1},documents});return {file,db:localDatabase(file),dir};}
function child(code){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',code]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',n=>n?reject(Error(err)):resolve(out.trim()));});}
test('requires trusted saved seed and refuses overwrite or malformed state',async t=>{const {file}=await setup(t);await assert.rejects(seedLocalDatabase(file,{provenance:{},documents}),/already exists/);await writeFile(file,'{}');await assert.rejects(localDatabase(file).doc('settings/global').get(),/valid saved/);});
test('atomic transactions persist restart, journal before/after and roll back failures',async t=>{const {file,db}=await setup(t);await db.doc('tasks/one').update({'ownerUpdate.done':'Ready'});const restarted=localDatabase(file);assert.equal((await restarted.doc('tasks/one').get()).data().ownerUpdate.done,'Ready');const before=await readFile(file,'utf8');await assert.rejects(db.runTransaction(async tx=>{tx.update(db.doc('tasks/one'),{status:'done'});throw Error('fail');}),/fail/);assert.equal(await readFile(file,'utf8'),before);const s=await readLocalState(file);assert.equal(s.outbox.length,1);assert.equal(s.outbox[0].mutations[0].before.status,'queued');assert.equal(s.outbox[0].mutations[0].after.ownerUpdate.done,'Ready');await assert.rejects(db.doc('tasks/one').create({}),e=>e.code===6);assert.equal((await db.collection('tasks').where('status','in',['queued']).orderBy('createdAt','desc').limit(1).get()).docs[0].id,'two');});
test('two separate processes cannot claim same repository and Unity ownership survives restart',async t=>{const {file,db}=await setup(t);const adapter=new URL('../orchestrator/local-database.mjs',import.meta.url).href,coord=new URL('../orchestrator/coordination.mjs',import.meta.url).href;const run=i=>child(`import {localDatabase} from ${JSON.stringify(adapter)};import {Coordinator} from ${JSON.stringify(coord)};const c=new Coordinator(localDatabase(${JSON.stringify(file)}),'lane-${i}','token${i}',{a:{path:'C:/a'}},20,()=>1793005200000);console.log(JSON.stringify(await c.claim()));`);const results=(await Promise.all([run(1),run(2)])).map(JSON.parse);assert.equal(results.filter(Boolean).length,1);const state=(await db.doc('coordination/runtime').get()).data();assert.equal(Object.keys(state.claims).length,1);const winner=results[0]?1:2,loser=winner===1?2:1;const a=new Coordinator(localDatabase(file),'lane-'+winner,'token'+winner,{a:{path:'C:/a'}}),b=new Coordinator(localDatabase(file),'lane-'+loser,'token'+loser,{a:{path:'C:/a'}});assert.equal(await a.unity(results[winner-1].id),true);await assert.rejects(b.unity(results[winner-1].id),/ownership/);assert.ok((await readLocalState(file)).documents['coordination/runtime'].unity);});

test('a confirmed exited process lock is recovered without losing durable claims',async t=>{
 const {file,db}=await setup(t);const pid=Number(await child('console.log(process.pid)'));
 await db.doc('coordination/runtime').set({claims:{one:{token:'saved-owner'}}});
 await writeFile(file+'.lock',JSON.stringify({pid,token:'exited-process'}));
 await db.doc('tasks/two').update({priority:2});
 assert.equal((await db.doc('coordination/runtime').get()).data().claims.one.token,'saved-owner');
});
