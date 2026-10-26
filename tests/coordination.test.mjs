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
