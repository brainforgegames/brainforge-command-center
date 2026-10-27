import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {seedLocalDatabase,localDatabase,readLocalState,mutateLocalState} from '../orchestrator/local-database.mjs';
import {syncOnce} from '../orchestrator/offline-sync.mjs';
const copy=x=>x===undefined?undefined:structuredClone(x);
function fakeCloud(documents){
 const values=new Map(Object.entries(copy(documents))),applies=new Map();let unavailable=true;
 const check=()=>{if(unavailable)throw Object.assign(Error('Quota exceeded'),{code:8});};
 const snap=p=>({id:p.split('/').at(-1),data:()=>copy(values.get(p))});
 return {values,applies,restore:()=>{unavailable=false;},doc:p=>({path:p,get:async()=>{check();return snap(p);}}),collection:p=>({get:async()=>{check();return {docs:[...values.keys()].filter(k=>k.startsWith(p+'/')).map(snap)};}}),runTransaction:async fn=>{check();const changes=[];const result=await fn({get:async ref=>snap(ref.path),set:(ref,data)=>changes.push(()=>{values.set(ref.path,copy(data));applies.set(ref.path,(applies.get(ref.path)||0)+1);}),delete:ref=>changes.push(()=>values.delete(ref.path))});changes.forEach(f=>f());return result;}};
}
function child(script,args){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[script,...args]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',n=>n?reject(Error(err||out)):resolve(out.trim()));});}
async function setup(t){
 const dir=await mkdtemp(path.join(tmpdir(),'bcc-outage-workers-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'database.json');
 const documents={'settings/global':{workerEnabled:true},'projects/sikhi':{enabled:true,weight:90},'projects/bcc':{enabled:true,weight:10},'coordination/runtime':{claims:{},served:{}}};
 for(const [id,projectId,input]of [['lesson','sikhi','Keep learning\nRespect others'],['dashboard','bcc','Show completed work\nShow next action'],['lesson-next','sikhi','Preserve meaning\nUse natural words']])documents['tasks/'+id]={title:id,projectId,target:'app',status:'queued',approved:true,priority:1,createdAt:1,input};
 await seedLocalDatabase(file,{provenance:{source:'owner-approved fixture queue',capturedAt:1},documents});return {dir,file,documents,cloud:fakeCloud(documents)};
}

test('two isolated fixture workers finish saved approved work during outage, then sync results exactly once',async t=>{
 const {dir,file,documents,cloud}=await setup(t);await mkdir(path.join(dir,'outputs'));
 assert.equal((await syncOnce(cloud,file)).status,'deferred');
 const script=path.join(dir,'worker.mjs'),adapter=new URL('../orchestrator/local-database.mjs',import.meta.url).href,coordinator=new URL('../orchestrator/coordination.mjs',import.meta.url).href;
 await writeFile(script,`
 import {localDatabase} from ${JSON.stringify(adapter)};
 import {Coordinator} from ${JSON.stringify(coordinator)};
 import {writeFile,open,unlink,stat} from 'node:fs/promises';import path from 'node:path';
 const [file,dir,lane]=process.argv.slice(2),db=localDatabase(file),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const c=new Coordinator(db,'lane-'+lane,'fixture-'+lane,{sikhi:{path:path.join(dir,'sikhi-repo')},bcc:{path:path.join(dir,'bcc-repo')}},20,()=>Date.parse('2026-10-26T09:00:00Z'));
 let count=0;
 while(true){const task=await c.claim();if(!task)break;
 const lockPath=path.join(dir,task.projectId+'.active');const lock=await open(lockPath,'wx');
 try{
  if(count===0){await writeFile(path.join(dir,'ready-'+lane),'ready');const other=lane==='1'?'2':'1',until=Date.now()+10000;while(!(await stat(path.join(dir,'ready-'+other)).catch(()=>null))){if(Date.now()>until)throw Error('Other fixture lane did not start');await wait(10);}}
  // Concrete bounded fixture work: turn saved task input into readable bullet artifact.
  const output=task.input.split('\\n').map(line=>'- '+line.trim()).join('\\n')+'\\n';
  await wait(30);await writeFile(path.join(dir,'outputs',task.id+'.txt'),output,{flag:'wx'});
  await db.doc('tasks/'+task.id).update({status:'review',result:output,fixtureWorker:lane});count++;
 }finally{await lock.close();await unlink(lockPath);}
 await c.finishSlice(task.id,1,true);
 }
 console.log(JSON.stringify({lane,count}));`);
 const workers=(await Promise.all([child(script,[file,dir,'1']),child(script,[file,dir,'2'])])).map(JSON.parse);
 assert.ok(workers.every(w=>w.count>=1));assert.equal(workers.reduce((n,w)=>n+w.count,0),3);
 assert.equal((await readdir(path.join(dir,'outputs'))).length,3);
 for(const [key,task]of Object.entries(documents).filter(([k])=>k.startsWith('tasks/')))assert.equal(await readFile(path.join(dir,'outputs',key.slice(6)+'.txt'),'utf8'),task.input.split('\n').map(x=>'- '+x).join('\n')+'\n');
 const pending=await readLocalState(file);assert.ok(pending.outbox.length>0);assert.deepEqual(pending.documents['coordination/runtime'].claims,{});
 assert.equal((await syncOnce(cloud,file)).status,'deferred');assert.equal((await readLocalState(file)).outbox.length,pending.outbox.length);
 // A fresh adapter simulates restart without deleting pending work.
 assert.equal((await localDatabase(file).doc('tasks/lesson').get()).data().status,'review');
 cloud.restore();const synced=await syncOnce(cloud,file,{limit:100});assert.equal(synced.conflicts,0);
 for(const id of ['lesson','dashboard','lesson-next'])assert.equal(cloud.values.get('tasks/'+id).status,'review');
 assert.equal((await readLocalState(file)).outbox.length,0);
 const applied=copy([...cloud.applies]);
 // Simulate a lost local acknowledgement: receipts must prevent second application.
 await mutateLocalState(file,s=>{s.outbox=pending.outbox;});
 await syncOnce(cloud,file,{limit:100});assert.deepEqual([...cloud.applies],applied);
 assert.deepEqual(cloud.values.get('coordination/runtime'),documents['coordination/runtime']);
});

test('restored cloud owner priorities win over saved offline weights and task authorization',async t=>{
 const {file,cloud}=await setup(t);await localDatabase(file).doc('tasks/lesson').update({status:'review',result:'Prepared fixture output'});
 cloud.values.set('projects/sikhi',{enabled:false,weight:0});cloud.values.set('projects/bcc',{enabled:true,weight:100});cloud.values.get('tasks/lesson').approved=false;
 cloud.restore();const result=await syncOnce(cloud,file,{limit:100});assert.equal(result.conflicts,1);
 const s=await readLocalState(file);assert.equal(s.documents['projects/sikhi'].weight,0);assert.equal(s.documents['projects/bcc'].weight,100);assert.equal(s.documents['tasks/lesson'].approved,false);assert.equal(s.documents['tasks/lesson'].result,'Prepared fixture output');assert.equal(cloud.values.get('tasks/lesson').status,'queued');
});
