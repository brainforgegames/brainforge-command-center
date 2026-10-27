import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordIncident,resolveIncident} from '../orchestrator/incidents.mjs';
async function root(t){const p=await mkdtemp(path.join(tmpdir(),'bcc-incidents-'));t.after(()=>rm(p,{recursive:true,force:true}));return p;}
const incident={lane:'lane-1',taskId:'task-one',category:'worker-error',message:'Worker exited before saving its result.'};

test('descriptive task IDs retain identity and matching launcher failures preserve context',async t=>{
 const p=await root(t),taskId='drivenix-vehicle-recording-adapter-20261026';
 const first=await recordIncident(p,{...incident,taskId,category:'orchestrator-error',message:'Unity compile failed.',now:100});
 assert.equal(first.taskId,taskId);
 const outer=await recordIncident(p,{...incident,taskId:null,category:'launcher-error',message:'Unity compile failed.',now:101});
 assert.equal(outer.taskId,taskId);assert.equal(outer.category,'orchestrator-error');assert.equal(outer.fingerprint,first.fingerprint);assert.equal(outer.occurrences,2);
 assert.equal((await resolveIncident(p,'lane-1',{taskId:'different-long-task-identifier-for-the-same-lane',progressAt:102,evidence:{kind:'task-progress',detail:'Unrelated output'}})).resolved,false);
 assert.equal((await resolveIncident(p,'lane-1',{taskId,progressAt:102,evidence:{kind:'task-progress',detail:'Actual matching check completed'}})).resolved,true);
 const secret=await recordIncident(p,{...incident,taskId:'ghp_'+ 'a'.repeat(40),now:103});assert.equal(secret.taskId,'[redacted]');
});

test('unknown task context requires explicit incident correlation before recovery',async t=>{
 const p=await root(t),e=await recordIncident(p,{...incident,taskId:null,category:'launcher-error',now:100});
 const proof={taskId:'different-task',progressAt:101,evidence:{kind:'task-progress',detail:'A task produced an output'}};
 assert.equal((await resolveIncident(p,'lane-1',proof)).resolved,false);
 assert.equal((await resolveIncident(p,'lane-1',{...proof,evidence:{...proof.evidence,incidentFingerprint:'stale'}})).resolved,false);
 assert.equal((await resolveIncident(p,'lane-1',{...proof,evidence:{...proof.evidence,incidentFingerprint:e.fingerprint}})).resolved,true);
});
test('deduplicates concurrent repeats, persists counts and keeps two lanes independent',async t=>{const p=await root(t);await Promise.all([recordIncident(p,{...incident,now:100}),recordIncident(p,{...incident,now:101})]);await recordIncident(p,{...incident,lane:'lane-2',now:102});const one=JSON.parse(await readFile(path.join(p,'.local/incidents/lane-1.json'),'utf8')),two=JSON.parse(await readFile(path.join(p,'.local/incidents/lane-2.json'),'utf8'));assert.equal(one.occurrences,2);assert.equal(one.firstSeen,100);assert.equal(one.lastSeen,101);assert.equal(two.occurrences,1);assert.notEqual(one.fingerprint,two.fingerprint);const reopened=await import('../orchestrator/incidents.mjs?restart=1');assert.equal((await reopened.recordIncident(p,{...incident,now:103})).occurrences,3);});
test('only newer matching actual progress resolves; spawn and heartbeat never recover',async t=>{const p=await root(t);await recordIncident(p,{...incident,now:100});for(const input of [{taskId:'task-one',progressAt:100,evidence:{kind:'task-progress',detail:'Saved implementation'}},{taskId:'other',progressAt:101,evidence:{kind:'task-progress',detail:'Saved implementation'}},{taskId:'task-one',progressAt:101,evidence:{kind:'spawn',detail:'Started process'}},{taskId:'task-one',progressAt:101,evidence:{kind:'heartbeat',detail:'Process alive'}}])assert.equal((await resolveIncident(p,'lane-1',input)).resolved,false);const result=await resolveIncident(p,'lane-1',{taskId:'task-one',progressAt:102,evidence:{kind:'task-progress',detail:'Saved implementation changes'}});assert.equal(result.resolved,true);assert.equal(result.incident.state,'recovered');assert.equal(result.incident.occurrences,1);assert.equal((await recordIncident(p,{...incident,now:103})).state,'pending');});
test('messages are bounded single-line sanitized summaries and authentication never auto-retries',async t=>{const p=await root(t);const result=await recordIncident(p,{...incident,category:'auth',message:'token=supersecret Bearer abcdef ghp_1234567890\nraw private second log line'});assert.equal(result.needsReview,true);assert.equal(result.retryable,false);assert.ok(!result.message.includes('supersecret'));assert.ok(!result.message.includes('abcdef'));assert.ok(!result.message.includes('ghp_'));assert.ok(!result.message.includes('second'));assert.ok(result.message.length<=280);const quota=await recordIncident(p,{...incident,category:'quota',message:'x'.repeat(500)});assert.equal(quota.expected,true);assert.equal(quota.retryable,true);assert.ok(quota.message.length<=280);await assert.rejects(recordIncident(p,{...incident,lane:'../outside'}),/lane/);});

import {spawn} from 'node:child_process';
function child(code){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',code]);let err='';p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve());});}
test('separate recorder processes and stale supervisor resolution cannot lose incident counts',async t=>{
 const p=await root(t),module=new URL('../orchestrator/incidents.mjs',import.meta.url).href;
 await recordIncident(p,{...incident,now:100});
 const prefix=`import {recordIncident,resolveIncident} from ${JSON.stringify(module)};`;
 await Promise.all([child(prefix+`await recordIncident(${JSON.stringify(p)},${JSON.stringify({...incident,now:101})});`),child(prefix+`await recordIncident(${JSON.stringify(p)},${JSON.stringify({...incident,now:102})});`),child(prefix+`await resolveIncident(${JSON.stringify(p)},'lane-1',{taskId:'task-one',progressAt:99,evidence:{kind:'task-progress',detail:'Earlier saved work'}});`)]);
 const saved=JSON.parse(await readFile(path.join(p,'.local/incidents/lane-1.json'),'utf8'));
 assert.equal(saved.occurrences,3);assert.equal(saved.state,'pending');assert.equal(saved.lastSeen,102);
 const owner=await recordIncident(p,{...incident,category:'owner-input'});assert.equal(owner.needsReview,true);assert.equal(owner.retryable,false);
 const generic=await recordIncident(p,incident);assert.equal(generic.retryable,false);
});
