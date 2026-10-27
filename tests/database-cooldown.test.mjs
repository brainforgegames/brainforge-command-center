import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
 const root=await mkdtemp(path.join(tmpdir(),'bcc-quota-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'scripts')); await mkdir(path.join(root,'orchestrator')); await mkdir(path.join(root,'.local'));
 return root;
}

test('scheduler shares quota cooldown across both lanes and reports, then resumes without changing checkpoints',async t=>{
 const root=await fixture(t), cooldown=path.join(root,'.local/database-cooldown.json');
 await copyFile(new URL('../scripts/run_scheduled.py',import.meta.url),path.join(root,'scripts/run_scheduled.py'));
 const stub="import {appendFileSync} from 'node:fs';appendFileSync('calls.txt','called\\n');console.error('Quota exceeded.');process.exitCode=1;";
 for(const name of ['worker','report'])await writeFile(path.join(root,'orchestrator',name+'.mjs'),stub);
 await writeFile(path.join(root,'.local/checkpoint.json'),'saved work');
 const run=(mode,lane)=>spawnSync('python',[path.join(root,'scripts/run_scheduled.py'),'--node',process.execPath,'--mode',mode,...(lane?['--lane',lane]:[])],{encoding:'utf8'});
 const failed=run('worker','lane-1');assert.equal(failed.status,1,failed.stderr);
 const saved=JSON.parse(await readFile(cooldown,'utf8'));
 assert.ok(saved.retryAt>Date.now()/1000+1700 && saved.retryAt<Date.now()/1000+1810);
 for(const [mode,lane] of [['worker','lane-1'],['worker','lane-2'],['report',null]])assert.equal(run(mode,lane).status,0);
 assert.equal(await readFile(path.join(root,'calls.txt'),'utf8'),'called\n');
 assert.equal(await readFile(path.join(root,'.local/checkpoint.json'),'utf8'),'saved work');
 await writeFile(cooldown,JSON.stringify({retryAt:Date.now()/1000-1}));
 await writeFile(path.join(root,'orchestrator/worker.mjs'),"import {appendFileSync} from 'node:fs';appendFileSync('calls.txt','resumed\\n');");
 assert.equal(run('worker','lane-2').status,0);assert.match(await readFile(path.join(root,'calls.txt'),'utf8'),/resumed/);
});

for(const scenario of ['daytime','already-local','already-remote','publish'])test(`report ${scenario} avoids unnecessary database reads`,async t=>{
 const root=await fixture(t);
 await copyFile(new URL('../orchestrator/report.mjs',import.meta.url),path.join(root,'orchestrator/report.mjs'));
 await writeFile(path.join(root,'worker.config.json'),'{}');
 if(scenario==='already-local')await writeFile(path.join(root,'.local/last-published-report.txt'),'2026-10-27');
 await writeFile(path.join(root,'orchestrator/policy.mjs'),`export const istParts=()=>({hour:${scenario==='daytime'?5:22},date:'2026-10-27'});export const makeReport=()=>({});`);
 await writeFile(path.join(root,'orchestrator/analytics.mjs'),'export const archiveCompletion=async()=>{};');
 await writeFile(path.join(root,'orchestrator/runtime-database.mjs'),`export const runtimeDatabase=()=>{console.log('DB_OPEN');return {doc:(id)=>({get:async()=>{console.log('READ '+id);return {exists:${scenario==='already-remote'},data:()=>({})}},create:async()=>console.log('CREATED')}),collection:(id)=>({where(){return this},limit(){return this},get:async()=>{console.log('SCAN '+id);return {docs:[],empty:true}}}),terminate:async()=>{}}};`);
 const result=spawnSync(process.execPath,[path.join(root,'orchestrator/report.mjs')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.includes('DB_OPEN'),!['daytime','already-local'].includes(scenario));
 assert.equal(result.stdout.includes('SCAN'),scenario==='publish');
 assert.equal(result.stdout.includes('CREATED'),scenario==='publish');
 if(scenario!=='daytime')assert.equal(await readFile(path.join(root,'.local/last-published-report.txt'),'utf8'),'2026-10-27');
});
