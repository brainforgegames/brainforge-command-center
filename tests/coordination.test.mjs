import test from 'node:test';
import assert from 'node:assert/strict';
import { Coordinator, eligible, transientCapacity } from '../orchestrator/coordination.mjs';
class FakeDB {
 constructor() { this.values=new Map(); this.serial=Promise.resolve(); }
 doc(path) { return {path,get:async()=>this.snap(path)}; }
 snap(path) { const data=this.values.get(path); return {id:path.split('/').at(-1),data:()=>structuredClone(data)}; }
 collection(path) { return {path,query:true,where(){return this;},get:async()=>({docs:[...this.values.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(k=>this.snap(k))})}; }
 async runTransaction(fn) { let result; const op=this.serial.then(async()=>{const writes=[];result=await fn({get:async ref=>ref.query?{docs:[...this.values.keys()].filter(k=>k.startsWith(ref.path+'/')&&!k.slice(ref.path.length+1).includes('/')).map(k=>this.snap(k))}:this.snap(ref.path),set:(ref,data,opts)=>writes.push(()=>this.values.set(ref.path,structuredClone(opts?.merge?{...this.values.get(ref.path),...data}:data))),update:(ref,data)=>writes.push(()=>this.values.set(ref.path,{...this.values.get(ref.path),...structuredClone(data)}))});writes.forEach(w=>w());});this.serial=op.catch(()=>{}); await op; return result; }
}
function setup() {
 const db=new FakeDB(), now=Date.parse('2026-10-26T09:00:00Z');
 db.values.set('settings/global',{workerEnabled:true});
 for(const id of ['a','b']) db.values.set('projects/'+id,{enabled:true,weight:50});
 const mappings={a:{path:'C:/a'},b:{path:'C:/b'}};
 const lane1=new Coordinator(db,'lane-1','token1',mappings,20,()=>now),lane2=new Coordinator(db,'lane-2','token2',mappings,20,()=>now);
 const add=(id,projectId='a',target='app')=>db.values.set('tasks/'+id,{projectId,target,title:id,status:'queued',approved:true,priority:1,createdAt:1});
 return {db,lane1,lane2,add,now,mappings};
}
test('atomic claims prevent duplicate tasks and repository collisions; independent targets can run',async()=>{
 const {db,lane1,lane2,add,mappings}=setup(); add('one');add('two');add('three','b');
 const [a,b]=await Promise.all([lane1.claim(),lane2.claim()]);
 assert.notEqual(a.id,b.id); assert.notEqual(a.projectId,b.projectId);
 assert.equal(Object.keys((await lane1.state()).claims).length,2);
 const alias=setup(); alias.mappings.b.path='C:/a';alias.add('first');alias.add('second','b');
 assert.ok(await alias.lane1.claim());assert.equal(await alias.lane2.claim(),null);
});
test('shared reserved time guides weighted selection and reconciles actual minutes',async()=>{
 const {lane1,lane2,add}=setup();add('one');add('two','b');
 assert.equal((await lane1.claim()).projectId,'a');assert.equal((await lane2.claim()).projectId,'b');
 await lane1.finishSlice('one',3); assert.equal((await lane1.state()).served.a,3);
 await lane1.finishSlice('one',0,true);assert.ok(!(await lane1.state()).claims.one);
});
test('Unity serialization and owner tokens fail closed without lease expiration',async()=>{
 const {lane1,lane2,add}=setup();add('one');add('two','b');await lane1.claim();await lane2.claim();
 assert.equal(await lane1.unity('one'),true);assert.equal(await lane2.unity('two'),false);
 await assert.rejects(lane2.finishSlice('one',1,true),/ownership/);
 await lane1.unity('one',true);assert.equal(await lane2.unity('two'),true);
 // A process exit cannot make another worker steal a reserved slice.
 await assert.rejects(lane1.claim('one'),/not been reconciled/);
});
test('park, admin pause and shared cooldown preserve claims but prevent resumption',async()=>{
 const {db,lane1,lane2,add,now}=setup();add('one');add('two','b');await lane1.claim();await lane1.finishSlice('one',2);
 db.values.set('projects/a',{enabled:false,weight:0});assert.equal(await lane1.canRun('one'),false);assert.equal(await lane1.claim('one'),null);assert.ok(await lane1.owns('one'));
 db.values.set('projects/a',{enabled:true,weight:90});assert.equal((await lane1.claim('one')).id,'one');await lane1.finishSlice('one',1);
 await lane1.cooldown(now+300000,'model-capacity');assert.equal(await lane2.claim(),null);assert.equal(await lane1.canRun('one'),false);
 db.values.set('settings/global',{workerEnabled:false});assert.equal(await lane1.claim('one'),null);
 assert.equal(eligible({projectId:'a',approved:true,status:'running'},[{id:'a',enabled:true,weight:90}],{workerEnabled:true},Date.parse('2026-10-26T17:45:00Z')),false);
});
test('capacity errors are transient, separately from product failures',()=>{
 assert.ok(transientCapacity('Selected model is at capacity. Please try again.'));
 assert.ok(transientCapacity('Server is overloaded'));
 assert.equal(transientCapacity('Compilation failed: undefined method'),false);
});
import { acquireLaneLock } from '../orchestrator/lane-lock.mjs';
import { mkdtemp, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('local lock recovery requires confirmed process absence and serializes launchers',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bcc-lane-lock-')), file=path.join(dir,'worker.lock');
 try {
  await writeFile(file,'123');
  await assert.rejects(acquireLaneLock(file,456,()=>{}),/already running/);
  assert.equal(await readFile(file,'utf8'),'123');
  const absent=()=>{throw Object.assign(Error('absent'),{code:'ESRCH'});};
  const lock=await acquireLaneLock(file,456,absent);assert.equal(await readFile(file,'utf8'),'456');await lock.close();
  await writeFile(file+'.recovery','');
  await assert.rejects(acquireLaneLock(file,789,absent),/recovery/);
  assert.equal(await readFile(file,'utf8'),'456');
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('a parked checkpoint can remain owned while its lane runs another repository',async()=>{
 const {db,lane1,lane2,add}=setup();add('parked');add('other','b');
 await lane1.claim();await lane1.finishSlice('parked',2);
 db.values.set('projects/a',{enabled:false,weight:0});
 await assert.rejects(lane1.claim(),/no local task checkpoint/);
 assert.equal((await lane1.claim(null,['parked'])).id,'other');
 await lane1.finishSlice('other',4);await lane1.finishSlice('other',6,true);
 assert.equal((await lane1.state()).served.b,6);
 assert.ok(await lane1.owns('parked'));
 db.values.set('projects/a',{enabled:true,weight:50});
 assert.equal(await lane2.claim(),null);
 assert.equal((await lane1.claim('parked')).id,'parked');
});

test('two supervisors requeue one setup failure atomically without racing active work',async()=>{
 const {db,lane1,lane2,add}=setup();add('retry');Object.assign(db.values.get('tasks/retry'),{status:'blocked',updatedAt:1,evidence:[{passed:false,category:'timeout'}]});
 const results=await Promise.all([lane1.recoverBlocked(),lane2.recoverBlocked()]);assert.equal(results.filter(Boolean).length,1);assert.equal(db.values.get('tasks/retry').automaticRecovery.attempts,1);
});
test('automatic recovery respects owner input, paused projects, product failures and retry bounds',async()=>{
 for(const override of [{ownerUpdate:{needsOwner:true}},{automaticRecovery:{attempts:2}},{evidence:[{passed:false,category:'product_assertion'}]},{approved:false}]){
 const {db,lane1,add}=setup();add('blocked');Object.assign(db.values.get('tasks/blocked'),{status:'blocked',updatedAt:1,evidence:[{passed:false,category:'timeout'}]},override);assert.equal(await lane1.recoverBlocked(),null);
 }
 const {db,lane1,add}=setup();add('blocked');Object.assign(db.values.get('tasks/blocked'),{status:'blocked',updatedAt:1,evidence:[{passed:false,category:'timeout'}]});db.values.get('projects/a').enabled=false;assert.equal(await lane1.recoverBlocked(),null);
});

function continuationTask(s, extra={}) {
 s.add('draft');
 Object.assign(s.db.values.get('tasks/draft'), {status:'review',continuation:{id:'finish-ui',approved:true,afterStatus:'review',instruction:'Finish the requested UI changes.'}},extra);
}
test('a durable continuation is enqueued once across competing workers and survives a return to review',async()=>{
 const s=setup();continuationTask(s);
 const results=await Promise.all([s.lane1.resumeContinuation(),s.lane2.resumeContinuation()]);
 assert.deepEqual(results.filter(Boolean),['draft']);
 assert.equal(s.db.values.get('tasks/draft').continuationHistory['finish-ui'].queuedAt,s.now);
 const running=await s.lane2.claim();assert.equal(running.id,'draft');
 await s.lane2.finishSlice('draft',1,true);
 s.db.values.get('tasks/draft').status='review';
 assert.equal(await s.lane1.resumeContinuation(),null);
});
test('continuations never race an active repository including aliases and parked claims',async()=>{
 const s=setup();s.add('active');await s.lane1.claim();await s.lane1.finishSlice('active',2);
 s.mappings.b.path='C:/a';continuationTask(s,{projectId:'b'});
 assert.equal(await s.lane2.resumeContinuation(),null);
 assert.equal(s.db.values.get('tasks/draft').status,'review');
});
test('continuations preserve explicit owner questions only for supervisor-approved independent work',async()=>{
 const s=setup();continuationTask(s,{ownerUpdate:{needsOwner:true,question:'Confirm the app identifier.',answerHint:'From your account'}});
 assert.equal(await s.lane1.resumeContinuation(),null);
 s.db.values.get('tasks/draft').continuation.independentOfOwner=true;
 assert.equal(await s.lane1.resumeContinuation(),'draft');
 assert.equal(s.db.values.get('tasks/draft').ownerUpdate.question,'Confirm the app identifier.');
 assert.equal(s.db.values.get('tasks/draft').ownerUpdate.needsOwner,true);
});
test('continuations fail closed for missing approval, mismatched state, blank action, future time and project pause',async()=>{
 for(const descriptor of [{approved:false},{afterStatus:'blocked'},{instruction:'  '},{notBefore:Number.MAX_SAFE_INTEGER},{id:'bad.id'}]){
  const s=setup();continuationTask(s);Object.assign(s.db.values.get('tasks/draft').continuation,descriptor);
  assert.equal(await s.lane1.resumeContinuation(),null);
 }
 for(const field of ['weight','enabled']){
  const s=setup();continuationTask(s);s.db.values.get('projects/a')[field]=field==='weight'?0:false;
  assert.equal(await s.lane1.resumeContinuation(),null);
 }
 const s=setup();continuationTask(s);await s.lane1.cooldown(s.now+1000,'limit');
 assert.equal(await s.lane1.resumeContinuation(),null);
});

import { runHandoffs } from '../orchestrator/handoff.mjs';
for (const outcome of ['review','blocked']) test(`scheduled worker immediately claims next useful task after ${outcome}`,async()=>{
 const {db,lane1,lane2,add}=setup();add('first');add('next');add('other','b');
 const other=await lane2.claim(); // Reserve a repository, then use the other for this lane.
 const project=other.projectId==='a'?'b':'a';
 add('handoff-first',project);add('handoff-next',project);
 const seen=[];
 await runHandoffs(async()=>{
  const task=await lane1.claim();if(!task)return false;
  seen.push(task.id);
  db.values.set('tasks/'+task.id,{...db.values.get('tasks/'+task.id),status:outcome});
  await lane1.finishSlice(task.id,1,true);
  return true;
 });
 assert.ok(seen.includes('handoff-first'));assert.ok(seen.includes('handoff-next'));
 assert.equal(new Set(seen).size,seen.length);
 assert.ok(await lane2.owns(other.id));
});
test('handoff drain stops for waiting, retry deadline and safety bound',async()=>{
 let calls=0;assert.equal(await runHandoffs(async()=>{calls++;return false;}),'waiting');assert.equal(calls,1);
 calls=0;assert.equal(await runHandoffs(async()=>{calls++;return true;},{maxSteps:3}),'bounded');assert.equal(calls,3);
 calls=0;assert.equal(await runHandoffs(async()=>{calls++;return true;},{clock:()=>20,deadline:10}),'deadline');assert.equal(calls,0);
});
