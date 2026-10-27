import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,copyFile,rm } from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {idleWaiting,markQueueIdle,IDLE_POLL_MS} from '../orchestrator/idle-poll.mjs';
import {runHandoffs} from '../orchestrator/handoff.mjs';

test('idle delay is bounded, ignores corrupt deadlines and never delays active checkpoints',()=>{
 const cp={task:null};markQueueIdle(cp,1000);
 assert.equal(cp.idleRetryAt,1000+IDLE_POLL_MS);
 assert.equal(idleWaiting(cp,1001),true);assert.equal(idleWaiting(cp,301000),false);
 for(const idleRetryAt of [Infinity,NaN,'301000',99999999])assert.equal(idleWaiting({idleRetryAt},1000),false);
 assert.equal(idleWaiting({...cp,task:{id:'active'}},1001),false);
 assert.equal(idleWaiting({...cp,analyticsActive:{}},1001),false);
});

test('terminal handoffs remain immediate and delay starts only after queue exhaustion',async()=>{
 const cp={task:null},calls=[];
 await runHandoffs(async()=>{calls.push(calls.length);if(calls.length<3)return true;markQueueIdle(cp);return false;});
 assert.equal(calls.length,3);assert.equal(idleWaiting(cp),true);
});

test('scheduled idle skip is lane scoped, preserves files, and bypassed for active work or expiry',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'bcc-idle-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'orchestrator'));
 const lane=path.join(root,'.local/lanes/lane-1');await mkdir(lane,{recursive:true});
 await copyFile(new URL('../scripts/run_scheduled.py',import.meta.url),path.join(root,'scripts/run_scheduled.py'));
 for(const name of ['worker','report'])await writeFile(path.join(root,'orchestrator',name+'.mjs'),"import {appendFileSync} from 'node:fs';appendFileSync('calls.txt','run\\n');");
 const run=(mode='worker',id='lane-1')=>{const r=spawnSync('python',[path.join(root,'scripts/run_scheduled.py'),'--node',process.execPath,'--mode',mode,'--lane',id],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 const checkpoint=path.join(lane,'checkpoint.json');const saved=JSON.stringify({task:null,idleRetryAt:Date.now()+290000});await writeFile(checkpoint,saved);
 run();assert.equal(await readFile(checkpoint,'utf8'),saved);assert.equal(await readFile(path.join(root,'calls.txt'),'utf8').catch(()=>''),'');
 run('worker','lane-2');run('report');
 for(const cp of [{task:{id:'active'},idleRetryAt:Date.now()+290000},{analyticsActive:{},idleRetryAt:Date.now()+290000},{idleRetryAt:Date.now()-1},{idleRetryAt:Date.now()+900000}]){await writeFile(checkpoint,JSON.stringify(cp));run();}
 assert.equal((await readFile(path.join(root,'calls.txt'),'utf8')).split('\n').filter(Boolean).length,6);
});
