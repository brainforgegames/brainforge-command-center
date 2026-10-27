import test from 'node:test';
import assert from 'node:assert/strict';
import { Coordinator } from '../orchestrator/coordination.mjs';

function fixture() {
 let now=Date.parse('2026-10-27T04:00:00Z');
 const records=new Map([
  ['coordination/runtime',{claims:{task:{token:'owner'}},cooldownUntil:0}],
  ['tasks/task',{projectId:'app',status:'running',approved:true}],
  ['settings/global',{workerEnabled:true}],
  ['projects/app',{enabled:true,weight:90}],
 ]);
 const reads=[];let fail=null;
 const db={doc(path){return {get:async()=>{reads.push(path);if(fail===path)throw Error('read unavailable');return {data:()=>structuredClone(records.get(path))};}}},collection(){throw Error('Control checks must not scan collections');}};
 const lane=new Coordinator(db,'lane-1','owner',{},20,()=>now);
 return {lane,records,reads,advance:ms=>{now+=ms;},setTime:value=>{now=value;},fail:path=>{fail=path;}};
}

test('active controls read only four documents and coalesce simultaneous calls',async()=>{
 const {lane,reads}=fixture();
 assert.deepEqual(await Promise.all([lane.canRun('task',{cached:true}),lane.canRun('task',{cached:true}),lane.canRun('task')]),[true,true,true]);
 assert.deepEqual(reads.sort(),['coordination/runtime','projects/app','settings/global','tasks/task']);
 assert.equal(await lane.canRun('task',{cached:true}),true);assert.equal(reads.length,4);
});

test('remote stop is detected at cache expiry, while explicit fresh checks bypass cached success',async()=>{
 for(const change of [
  f=>{f.records.get('settings/global').workerEnabled=false;},
  f=>{f.records.get('projects/app').weight=0;},
  f=>{f.records.get('coordination/runtime').claims.task.token='other';},
  f=>{f.records.get('tasks/task').approved=false;},
  f=>{f.records.get('coordination/runtime').cooldownUntil=Infinity;},
 ]) {
  const f=fixture();assert.equal(await f.lane.canRun('task',{cached:true}),true);change(f);
  f.advance(29999);assert.equal(await f.lane.canRun('task',{cached:true}),true);
  f.advance(1);assert.equal(await f.lane.canRun('task',{cached:true}),false);
  const readCount=f.reads.length;assert.equal(await f.lane.canRun('task',{cached:true}),false);assert.ok(f.reads.length>readCount);
 }
 const f=fixture();await f.lane.canRun('task',{cached:true});f.records.get('settings/global').workerEnabled=false;
 assert.equal(await f.lane.canRun('task'),false);
 assert.equal(await f.lane.canRun('task',{cached:true}),false);
});

test('missing task or project fails closed and denial is not cached',async()=>{
 for(const path of ['tasks/task','projects/app']) {
  const f=fixture(),saved=f.records.get(path);f.records.delete(path);
  assert.equal(await f.lane.canRun('task',{cached:true}),false);
  f.records.set(path,saved);assert.equal(await f.lane.canRun('task',{cached:true}),true);
 }
});

test('read failures invalidate success and are never cached',async()=>{
 const f=fixture();await f.lane.canRun('task',{cached:true});f.advance(30000);f.fail('projects/app');
 await assert.rejects(f.lane.canRun('task',{cached:true}),/unavailable/);
 f.fail(null);f.records.get('settings/global').workerEnabled=false;
 assert.equal(await f.lane.canRun('task',{cached:true}),false);
});

test('daily pause remains immediate and a backwards clock invalidates cached success',async()=>{
 const f=fixture();f.setTime(Date.parse('2026-10-27T17:29:50Z'));assert.equal(await f.lane.canRun('task',{cached:true}),true);
 const count=f.reads.length;f.advance(10000);assert.equal(await f.lane.canRun('task',{cached:true}),false);assert.equal(f.reads.length,count);
 const g=fixture();await g.lane.canRun('task',{cached:true});g.advance(-1);g.records.get('projects/app').enabled=false;
 assert.equal(await g.lane.canRun('task',{cached:true}),false);
});
