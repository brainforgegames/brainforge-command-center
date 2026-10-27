import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {notifySupervisor} from '../orchestrator/supervisor-notify.mjs';
test('direct alerts deduplicate, retry failed delivery and skip expected pauses',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'bcc-delivery-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(path.join(root,'worker.config.json'),JSON.stringify({codexExecutable:'fixture',supervisorThreadId:'01a16be8-92ff-7e21-9b59-918cfcfb0182'}));
 const event={state:'pending',lane:'lane-1',fingerprint:'abc',firstSeen:1,category:'worker-error',taskId:'task'};
 assert.equal((await notifySupervisor(root,event,{send:async()=>{throw Error('offline')}})).sent,false);
 let calls=0;const send=async(_cfg,message)=>{calls++;assert.match(message,/event-triggered/);};
 const results=await Promise.all([notifySupervisor(root,event,{send}),notifySupervisor(root,event,{send})]);
 assert.equal(results.filter(x=>x.sent).length,1);assert.equal(calls,1);
 assert.equal((await notifySupervisor(root,{...event,expected:true},{send})).reason,'expected');assert.equal(calls,1);
});
