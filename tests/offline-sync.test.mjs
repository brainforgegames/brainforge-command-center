import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {localDatabase,seedLocalDatabase,readLocalState,mutateLocalState} from '../orchestrator/local-database.mjs';
import {syncOnce,replayOutbox,refreshOwnerControls,seedFromCloud,mirrorWorkerStatus} from '../orchestrator/offline-sync.mjs';
const copy=x=>x===undefined?undefined:structuredClone(x);
function cloudFake(documents){
 const values=new Map(Object.entries(copy(documents)));let failure=null;
 const snap=p=>({id:p.split('/').at(-1),data:()=>copy(values.get(p))});
 const cloud={values,writes:[],fail:e=>{failure=e;},doc:p=>({path:p,get:async()=>{if(failure)throw failure;return snap(p);}}),collection:p=>({get:async()=>{if(failure)throw failure;return {docs:[...values.keys()].filter(k=>k.startsWith(p+'/')).map(snap)};}}),runTransaction:async fn=>{if(failure)throw failure;const writes=[];const result=await fn({get:async ref=>snap(ref.path),set:(ref,data)=>writes.push(()=>{cloud.writes.push(ref.path);values.set(ref.path,copy(data));}),delete:ref=>writes.push(()=>values.delete(ref.path))});writes.forEach(w=>w());return result;}};
 return cloud;
}
async function fixture(fn){
 const dir=await mkdtemp(path.join(tmpdir(),'bcc-offline-sync-')),file=path.join(dir,'state.json');
 const documents={'settings/global':{workerEnabled:true},'projects/a':{enabled:true,weight:100},'tasks/one':{title:'Task',approved:true,projectId:'a',priority:3,status:'queued'},'coordination/runtime':{claims:{},served:{}}};
 await seedLocalDatabase(file,{provenance:{source:'explicit-owner-approved-seed',capturedAt:1},documents});
 try{await fn({file,db:localDatabase(file),cloud:cloudFake(documents),documents});}finally{await rm(dir,{recursive:true,force:true});}
}

test('replay is deduplicated after lost local acknowledgement and never sends coordination tokens',()=>fixture(async({file,db,cloud})=>{
 await db.runTransaction(async tx=>{tx.update(db.doc('tasks/one'),{status:'running'});tx.set(db.doc('coordination/runtime'),{claims:{one:{token:'secret-owner'}}});});
 const pending=(await readLocalState(file)).outbox;
 assert.equal((await replayOutbox(cloud,file)).replayed,1);assert.equal(cloud.values.get('tasks/one').status,'running');
 assert.deepEqual(cloud.values.get('coordination/runtime'),{claims:{},served:{}});
 await mutateLocalState(file,s=>{s.outbox=pending;});
 assert.equal((await replayOutbox(cloud,file)).replayed,1);assert.equal([...cloud.values.keys()].filter(k=>k.startsWith('offlineSyncReceipts/')).length,1);
}));

test('new cloud owner decisions are not overwritten by pending offline results',()=>fixture(async({file,db,cloud})=>{
 await db.doc('tasks/one').update({status:'review',result:{summary:'Saved draft'}});
 cloud.values.get('tasks/one').approved=false;cloud.values.get('tasks/one').priority=1;
 const result=await syncOnce(cloud,file);assert.equal(result.conflicts,1);
 assert.equal(cloud.values.get('tasks/one').status,'queued');assert.equal(cloud.values.get('tasks/one').approved,false);
 const state=await readLocalState(file);assert.equal(state.documents['tasks/one'].approved,false);assert.equal(state.documents['tasks/one'].status,'blocked');assert.equal(state.documents['tasks/one'].result.summary,'Saved draft');assert.equal(state.outbox.length,1);
}));

test('settings and projects flow down only, and successful local task results flow up',()=>fixture(async({file,db,cloud})=>{
 await db.doc('settings/global').update({workerEnabled:false});await db.doc('projects/a').update({weight:3});await db.doc('tasks/one').update({status:'review'});
 const result=await syncOnce(cloud,file);assert.equal(result.replayed,3);
 assert.ok((await readLocalState(file)).sync.lastSuccessAt>0);
 assert.equal(cloud.values.get('settings/global').workerEnabled,true);assert.equal(cloud.values.get('projects/a').weight,100);assert.equal(cloud.values.get('tasks/one').status,'review');
 assert.equal((await readLocalState(file)).documents['projects/a'].weight,100);
}));

test('quota retains the outbox; authentication errors fail closed',()=>fixture(async({file,db,cloud})=>{
 await db.doc('tasks/one').update({status:'running'});const before=await readLocalState(file);
 cloud.fail(Object.assign(Error('Quota exceeded'),{code:8}));assert.equal((await syncOnce(cloud,file)).status,'deferred');assert.deepEqual(await readLocalState(file),before);
 cloud.fail(Object.assign(Error('Denied'),{code:7}));await assert.rejects(syncOnce(cloud,file),e=>e.offlineSecurityFailure===true);
 assert.deepEqual(await readLocalState(file),before);
}));

test('quarantined conflicts never advance the last successful sync on a later retry',()=>fixture(async({file,db,cloud})=>{
 await db.doc('tasks/one').update({status:'review',result:'Saved draft'});
 cloud.values.get('tasks/one').dependencies=['new-owner-dependency'];
 assert.equal((await syncOnce(cloud,file,{now:100})).status,'conflict');
 assert.equal((await syncOnce(cloud,file,{now:200})).status,'conflict');
 const saved=await readLocalState(file);
 assert.equal(saved.sync.lastSuccessAt,undefined);
 assert.deepEqual(saved.documents['tasks/one'].dependencies,['new-owner-dependency']);
 assert.equal(saved.documents['tasks/one'].result,'Saved draft');
 assert.equal(saved.outbox.length,1);
}));

test('refresh after lost acknowledgement does not block an already mirrored task',()=>fixture(async({file,db,cloud})=>{
 await db.doc('tasks/one').update({status:'review'});const pending=(await readLocalState(file)).outbox;
 await replayOutbox(cloud,file);await mutateLocalState(file,s=>{s.outbox=pending;});
 await refreshOwnerControls(cloud,file);assert.equal((await readLocalState(file)).documents['tasks/one'].status,'review');
}));

test('cloud seed excludes foreign coordinator ownership',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bcc-seed-'));try{
  const cloud=cloudFake({'settings/global':{workerEnabled:true},'projects/a':{weight:1},'tasks/t':{status:'queued'},'coordination/runtime':{claims:{t:{token:'foreign'}}}});
  const file=path.join(dir,'db.json');await seedFromCloud(cloud,file);assert.deepEqual((await readLocalState(file)).documents['coordination/runtime'],{claims:{},served:{}});
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('baseline-unknown historical worker heartbeats coalesce to one latest safe status',()=>fixture(async({file,db,cloud})=>{
 cloud.values.set('worker/status',{lastSeen:1,status:'Old cloud status'});
 for(let i=2;i<=101;i++)await db.doc('worker/status').set({lastSeen:i,status:'Working',workers:{'lane-1':{lastSeen:i,status:'Working',token:'private-token'}},claims:{hidden:'secret'},workerEnabled:true});
 const result=await replayOutbox(cloud,file,{limit:1});
 assert.equal(result.statusEntries,100);assert.equal(result.statusMirrored,true);
 assert.equal(cloud.values.get('worker/status').lastSeen,101);
 assert.equal(cloud.writes.filter(p=>p==='worker/status').length,1);
 assert.equal(cloud.values.get('worker/status').claims,undefined);assert.equal(cloud.values.get('worker/status').workerEnabled,undefined);
 assert.equal(cloud.values.get('worker/status').workers['lane-1'].token,undefined);
 assert.equal((await readLocalState(file)).outbox.length,0);
}));

test('status acknowledgement preserves mixed task mutations and later concurrent heartbeats',()=>fixture(async({file,db,cloud})=>{
 await db.runTransaction(async tx=>{tx.update(db.doc('tasks/one'),{status:'review'});tx.set(db.doc('worker/status'),{lastSeen:2,status:'Working'});});
 const original=cloud.runTransaction;
 let once=true;cloud.runTransaction=async fn=>{const result=await original(fn);if(once){once=false;await db.doc('worker/status').set({lastSeen:3,status:'Ready'});}return result;};
 await mirrorWorkerStatus(cloud,file);
 const pending=(await readLocalState(file)).outbox;
 assert.equal(pending.length,2);assert.deepEqual(pending[0].mutations.map(m=>m.path),['tasks/one']);
 assert.equal(pending[1].mutations[0].path,'worker/status');
 await replayOutbox(cloud,file);assert.equal(cloud.values.get('tasks/one').status,'review');assert.equal(cloud.values.get('worker/status').lastSeen,3);
}));

test('status mirror is monotonic and retries lost acknowledgements without duplicate writes',()=>fixture(async({file,db,cloud})=>{
 await db.doc('worker/status').set({lastSeen:5,status:'Working'});const pending=(await readLocalState(file)).outbox;
 await mirrorWorkerStatus(cloud,file);await mutateLocalState(file,s=>{s.outbox=pending;});
 await mirrorWorkerStatus(cloud,file);assert.equal(cloud.writes.filter(p=>p==='worker/status').length,1);
 cloud.values.set('worker/status',{lastSeen:10,status:'Newer'});await db.doc('worker/status').set({lastSeen:6,status:'Older'});
 await mirrorWorkerStatus(cloud,file);assert.equal(cloud.values.get('worker/status').status,'Newer');assert.equal((await readLocalState(file)).outbox.length,0);
}));

test('analytics aggregation conflicts preserve newer cloud counts and all transaction members',()=>fixture(async({file,db,cloud})=>{
 cloud.values.set('analyticsDays/2026-10-27',{completed:10});
 await db.runTransaction(async tx=>{tx.set(db.doc('analyticsDays/2026-10-27'),{completed:1});tx.set(db.doc('analyticsCompletions/local-task'),{taskId:'local-task'});});
 const result=await replayOutbox(cloud,file);assert.equal(result.conflicts,1);
 assert.deepEqual(cloud.values.get('analyticsDays/2026-10-27'),{completed:10});assert.equal(cloud.values.has('analyticsCompletions/local-task'),false);
 assert.equal((await readLocalState(file)).outbox.length,1);
}));

test('successful replay publishes final sync state even with a newer cloud heartbeat',()=>fixture(async({file,db,cloud})=>{
 await db.doc('tasks/one').update({status:'review',result:'Saved result'});
 await db.doc('worker/status').set({status:'Older local heartbeat',lastSeen:500,workers:{'lane-1':{status:'Idle',lastSeen:500}}});
 cloud.values.set('worker/status',{status:'Newest cloud heartbeat',lastSeen:1000,workers:{'lane-2':{status:'Working: newer task',lastSeen:1000}}});
 const result=await syncOnce(cloud,file,{now:2000});assert.equal(result.status,'synced');
 const status=cloud.values.get('worker/status');assert.equal(status.lastSeen,1000);assert.equal(status.status,'Newest cloud heartbeat');assert.equal(status.workers['lane-2'].status,'Working: newer task');
 assert.equal(status.queueSync.pending,0);assert.equal(status.queueSync.lastSuccessAt,2000);assert.equal(status.queueSync.state,'Local queue saved');
 assert.equal((await readLocalState(file)).outbox.length,0);
}));
