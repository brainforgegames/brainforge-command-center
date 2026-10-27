import {createHash} from 'node:crypto';
import {seedLocalDatabase,readLocalState,mutateLocalState} from './local-database.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>v===undefined?'null':v===null?'null':Array.isArray(v)?'['+v.map(canonical).join(',')+']':typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const fingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
const same=(a,b)=>fingerprint(a)===fingerprint(b);
const allowed=p=>/^(tasks|reports|analyticsRuns|analyticsDays|analyticsCompletions|ideas)\/[^/]+$/.test(p)||p==='analytics/meta'||p==='worker/status';
const taskControls=['title','acceptance','projectId','target','priority','approved','continuation'];
function publicMirror(value) {
 if(Array.isArray(value))return value.map(publicMirror);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['token','ownerToken','claims','unity'].includes(k)).map(([k,v])=>[k,publicMirror(v)]));
 return value;
}
export function cloudFailure(error) {
 const code=String(error?.code??'').toLowerCase().replaceAll('_','-');
 if(['7','16','401','403','permission-denied','unauthenticated'].includes(code)||/permission denied|unauthenticated|invalid authentication credentials/i.test(error?.message||''))return 'security';
 if(['8','429','resource-exhausted'].includes(code)||/quota exceeded|resource.exhausted/i.test(error?.message||''))return 'quota';
 if(['4','14','unavailable','deadline-exceeded','econnreset','etimedout','enotfound'].includes(code))return 'transient';
 return 'unknown';
}
export async function seedFromCloud(cloud,file,{now=Date.now()}={}) {
 const [settings,projects,tasks]=await Promise.all([cloud.doc('settings/global').get(),cloud.collection('projects').get(),cloud.collection('tasks').get()]);
 if(!settings.data())throw Error('Missing cloud settings; refusing local authorization seed.');
 const documents={'settings/global':settings.data(),'coordination/runtime':{claims:{},served:{}}};
 for(const [collection,snapshot]of [['projects',projects],['tasks',tasks]])for(const doc of snapshot.docs)documents[collection+'/'+doc.id]=doc.data();
 await seedLocalDatabase(file,{provenance:{source:'verified-cloud-snapshot',capturedAt:now},documents});
}
export async function refreshOwnerControls(cloud,file,{now=Date.now()}={}) {
 const [settings,projects,tasks]=await Promise.all([cloud.doc('settings/global').get(),cloud.collection('projects').get(),cloud.collection('tasks').get()]);
 const global=settings.data();if(!global)throw Object.assign(Error('Cloud settings missing; stop until authorization is restored.'),{offlineSecurityFailure:true});
 await mutateLocalState(file,s=>{
  s.sync||={};s.sync.remoteTasks||={};s.documents['settings/global']=clone(global);
  const remoteProjects=new Set(projects.docs.map(p=>'projects/'+p.id));
  for(const path of Object.keys(s.documents).filter(p=>p.startsWith('projects/')))if(!remoteProjects.has(path))s.documents[path]={...s.documents[path],enabled:false,weight:0};
  for(const p of projects.docs)s.documents['projects/'+p.id]=clone(p.data());
  const remoteTaskPaths=new Set(tasks.docs.map(t=>'tasks/'+t.id));
  for(const path of Object.keys(s.sync.remoteTasks))if(!remoteTaskPaths.has(path)&&s.documents[path]){s.documents[path].approved=false;s.documents[path].status='blocked';s.documents[path].blockedReason='Task removed remotely; saved local work retained.';}
  for(const t of tasks.docs){
   const path='tasks/'+t.id,remote=t.data(),local=s.documents[path];
   const pending=s.outbox.flatMap(e=>e.mutations).filter(m=>m.path===path);
   if(!local||!pending.length)s.documents[path]=clone(remote);
   else {
    // Preserve local results, but refresh owner-controlled authorization fields.
    for(const k of taskControls){if(Object.hasOwn(remote,k))local[k]=clone(remote[k]);else delete local[k];}
    if(!same(remote,pending[0].before)&&!pending.some(m=>same(remote,m.after))) {
     // New remote decisions invalidate the old mirror baseline; stop this task
     // locally and retain its unuploaded results for explicit reconciliation.
     local.status='blocked';local.blockedReason='Cloud task changed while local results were pending; reconcile saved results.';
     s.sync.conflicts||={};s.sync.conflicts[path]={at:now,reason:'remote-task-changed',remote:clone(remote)};
    }
   }
   s.sync.remoteTasks[path]=fingerprint(remote);
  }
  s.sync.lastControlsAt=now;
 });
}
// Worker status is a single-host telemetry mirror, not an owner control. Replay
// only its latest durable snapshot instead of every historical heartbeat.
export async function mirrorWorkerStatus(cloud,file,{now=Date.now()}={}) {
 const state=await readLocalState(file);
 const ids=new Set(state.outbox.filter(e=>e.mutations.some(m=>m.path==='worker/status')).map(e=>e.id));
 if(!ids.size)return {statusMirrored:false,statusEntries:0};
 const latest=state.documents['worker/status'];
 if(!latest||!Number.isFinite(latest.lastSeen))throw Error('Worker status requires a finite lastSeen timestamp.');
 const pick=(source,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(source,k)).map(k=>[k,clone(source[k])]));
 const status=pick(latest,['status','lastSeen','quota','nextAttemptAt','cooldownReason','ownerQuestion']);
 status.workers=Object.fromEntries(Object.entries(latest.workers||{}).map(([lane,worker])=>[lane,
  pick(worker,['status','lastSeen','taskId','projectId','quota','nextAttemptAt'])]));
 const changed=await cloud.runTransaction(async tx=>{
  const ref=cloud.doc('worker/status'),remote=(await tx.get(ref)).data();
  // This timestamp comparison is the dedup key; a lost local acknowledgement
  // retries without another write and cannot replace a newer status snapshot.
  if(remote&&Number.isFinite(remote.lastSeen)&&remote.lastSeen>=status.lastSeen)return false;
  tx.set(ref,status);return true;
 });
 await mutateLocalState(file,s=>{
  s.outbox=s.outbox.flatMap(entry=>{
   if(!ids.has(entry.id))return [entry];
   const mutations=entry.mutations.filter(m=>m.path!=='worker/status');
   // A previous conflict caused by baseline-unknown worker telemetry no longer
   // needs quarantine; other mutations still undergo their own baseline checks.
   if(s.sync?.outboxConflicts)delete s.sync.outboxConflicts[entry.id];
   return mutations.length?[{...entry,mutations}]:[];
  });
  s.sync||={};s.sync.lastStatusMirrorAt=now;
 });
 return {statusMirrored:changed,statusEntries:ids.size};
}
export async function replayOutbox(cloud,file,{limit=20,now=Date.now()}={}) {
 const status=await mirrorWorkerStatus(cloud,file,{now});
 const state=await readLocalState(file),entries=state.outbox.filter(e=>!state.sync?.outboxConflicts?.[e.id]).slice(0,Math.max(0,Math.min(100,limit)));
 let replayed=0,conflicts=0;
 for(const entry of entries){
  const changes=new Map();
  for(const mutation of entry.mutations){
   if(!allowed(mutation.path))continue;
   if(!Object.hasOwn(mutation,'before')||!Object.hasOwn(mutation,'after'))throw Error('Outbox entry lacks conflict baseline.');
   const current=changes.get(mutation.path);
   changes.set(mutation.path,{path:mutation.path,before:current?current.before:mutation.before,after:mutation.after});
  }
  const mutations=[...changes.values()];
  const receipt=cloud.doc('offlineSyncReceipts/'+fingerprint(entry.id));
  const outcome=!mutations.length?'local-only':await cloud.runTransaction(async tx=>{
   if((await tx.get(receipt)).data())return 'duplicate';
   const snapshots=await Promise.all(mutations.map(m=>tx.get(cloud.doc(m.path))));
   for(let i=0;i<mutations.length;i++){
    const m=mutations[i],remote=snapshots[i].data()??null;
    if(!same(publicMirror(remote),publicMirror(m.before)))return 'conflict';
    if(m.path.startsWith('tasks/')&&m.before&&m.after&&taskControls.some(k=>!same(m.before[k],m.after[k])))return 'conflict';
   }
   for(const m of mutations){const ref=cloud.doc(m.path);if(m.after===null)tx.delete(ref);else tx.set(ref,publicMirror(m.after));}
   tx.set(receipt,{operationId:entry.id,appliedAt:now});return 'applied';
  });
  await mutateLocalState(file,s=>{
   s.sync||={};
   if(outcome==='conflict'){
    s.sync.outboxConflicts||={};s.sync.outboxConflicts[entry.id]={at:now,paths:mutations.map(m=>m.path)};
   }else{s.outbox=s.outbox.filter(e=>e.id!==entry.id);s.sync.lastReplayAt=now;}
  });
  if(outcome==='conflict')conflicts++;else replayed++;
 }
 return {replayed,conflicts,...status};
}
export async function syncOnce(cloud,file,options={}) {
 try {
  await refreshOwnerControls(cloud,file,options);
  return {status:'synced',...await replayOutbox(cloud,file,options)};
 }catch(error){
  const reason=cloudFailure(error);
  if(reason==='security'||error.offlineSecurityFailure){error.offlineSecurityFailure=true;throw error;}
  if(reason==='quota'||reason==='transient')return {status:'deferred',reason,replayed:0,conflicts:0};
  throw error;
 }
}
