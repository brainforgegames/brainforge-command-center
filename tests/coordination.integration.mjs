import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Coordinator } from '../orchestrator/coordination.mjs';
const require=createRequire(import.meta.url),{Firestore}=require('@google-cloud/firestore');
test('real Firestore transactions serialize concurrent claims, fairness and Unity slot',async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Run only through the Firestore emulator.');
 const db=new Firestore({projectId:'demo-bcc-parallel'}),now=()=>Date.parse('2026-10-26T09:00:00Z');
 const refs=['settings/global','projects/a','projects/b','tasks/one','tasks/two','tasks/three','coordination/runtime','worker/status'];
 try {
  await db.doc('coordination/runtime').delete();
  await db.doc('settings/global').set({workerEnabled:true});
  for(const id of ['a','b']) await db.doc('projects/'+id).set({enabled:true,weight:50});
  for(const [id,projectId]of[['one','a'],['two','a'],['three','b']])await db.doc('tasks/'+id).set({projectId,status:'queued',approved:true,priority:1,createdAt:1});
  const mappings={a:{path:'C:/a'},b:{path:'C:/b'}},a=new Coordinator(db,'lane-1','owner1',mappings,20,now),b=new Coordinator(db,'lane-2','owner2',mappings,20,now);
  const [first,second]=await Promise.all([a.claim(),b.claim()]);
  assert.ok(first&&second);assert.notEqual(first.id,second.id);assert.notEqual(first.projectId,second.projectId);
  const slots=await Promise.all([a.unity(first.id),b.unity(second.id)]);assert.equal(slots.filter(Boolean).length,1);
  await assert.rejects(b.finishSlice(first.id,1,true),/ownership/);
  await a.finishSlice(first.id,3,true);await b.finishSlice(second.id,4,true);
  assert.equal(Object.keys((await a.state()).claims).length,0);
 } finally {await Promise.all(refs.map(p=>db.doc(p).delete()));await db.terminate();}
});

test('real transactions select primary then opt-in fallback without duplicate claims',async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Run only through the Firestore emulator.');
 const db=new Firestore({projectId:'demo-bcc-fallback'}),now=()=>Date.parse('2026-10-26T09:00:00Z');
 const refs=['settings/global','projects/primary','projects/drivenix','tasks/primary','tasks/fallback','coordination/runtime'];
 try {
  await db.doc('coordination/runtime').delete();
  await db.doc('settings/global').set({workerEnabled:true,fallbackProjectOrder:['drivenix','brainforge-company']});
  await db.doc('projects/primary').set({enabled:true,weight:100});
  await db.doc('projects/drivenix').set({enabled:false,weight:0});
  for(const [id,projectId] of [['primary','primary'],['fallback','drivenix']]) await db.doc('tasks/'+id).set({projectId,status:'queued',approved:true,priority:1,createdAt:1});
  const mappings={primary:{path:'C:/primary'},drivenix:{path:'C:/drivenix'}};
  const a=new Coordinator(db,'lane-1','owner1',mappings,20,now),b=new Coordinator(db,'lane-2','owner2',mappings,20,now);
  const result=await Promise.all([a.claim(),b.claim()]);assert.deepEqual(result.map(t=>t.id).sort(),['fallback','primary']);
  assert.equal((await a.state()).claims.fallback.selectionMode,'owner-fallback');
  assert.deepEqual((await db.doc('projects/drivenix').get()).data(),{enabled:false,weight:0});
  assert.equal(await new Coordinator(db,'lane-3','owner3',mappings,20,now).claim(),null);
 } finally {await Promise.all(refs.map(p=>db.doc(p).delete()));await db.terminate();}
});
