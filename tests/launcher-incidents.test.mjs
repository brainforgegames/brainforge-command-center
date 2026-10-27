import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveIncident} from '../orchestrator/incidents.mjs';

test('launcher records snapshot failure, retries and requires verified output before recovery',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'bcc-alert-integration-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const dir of ['scripts','orchestrator','.local/lanes/lane-1'])await mkdir(path.join(root,dir),{recursive:true});
 for(const file of ['scripts/run_scheduled.py','orchestrator/incidents.mjs','orchestrator/launcher-incident.mjs'])await copyFile(new URL('../'+file,import.meta.url),path.join(root,file));
 await writeFile(path.join(root,'.local/lanes/lane-1/checkpoint.json'),JSON.stringify({task:{id:'useful-task'}}));
 await writeFile(path.join(root,'orchestrator/worker.mjs'),`import fs from 'node:fs';if(!fs.existsSync('attempt')){fs.writeFileSync('attempt','1');console.error('EPERM: rename snapshot');process.exitCode=1;}else fs.writeFileSync('actual-output','completed feature output');`);
 const run=spawnSync('python',[path.join(root,'scripts/run_scheduled.py'),'--node',process.execPath,'--mode','worker','--lane','lane-1'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.equal(await readFile(path.join(root,'actual-output'),'utf8'),'completed feature output');
 const incident=JSON.parse(await readFile(path.join(root,'.local/incidents/lane-1.json'),'utf8'));
 assert.equal(incident.state,'pending');assert.equal(incident.taskId,'useful-task');assert.equal(incident.category,'snapshot-contention');
 assert.equal((await resolveIncident(root,'lane-1',{taskId:'useful-task',progressAt:Date.now(),evidence:{kind:'spawn',detail:'started'}})).resolved,false);
 assert.equal((await resolveIncident(root,'lane-1',{taskId:'useful-task',progressAt:Date.now(),evidence:{kind:'task-progress',detail:'Actual output inspected and matches fixture acceptance.'}})).resolved,true);
});
