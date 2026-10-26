import { createHash } from 'node:crypto';
import { selectTask, isPaused } from './policy.mjs';
export function targetKey(task, mappings) {
  const group=mappings[task.projectId], p=group?.repositories?.[task.target||'app'] || group;
  // Repository identity also prevents alias projects from editing the same checkout.
  return createHash('sha256').update(String(p?.path || `${task.projectId}:${task.target||'app'}`).replaceAll('\\','/').toLowerCase()).digest('hex').slice(0,24);
}
export function eligible(task,projects,settings,now=Date.now()) {
  const p=projects.find(x=>x.id===task.projectId);
  return !!settings.workerEnabled && !isPaused(new Date(now)) && !!p?.enabled && p.weight>0 && task.approved===true && ['queued','running'].includes(task.status);
}
export function transientCapacity(text) { return /selected model is at capacity|model.*(?:overloaded|at capacity)|server.*overloaded|temporarily unavailable/i.test(text||''); }
export class Coordinator {
 constructor(db,lane,token,mappings,minutes=20,clock=()=>Date.now()) { Object.assign(this,{db,lane,token,mappings,minutes,clock}); this.ref=db.doc('coordination/runtime'); }
 async state() { return (await this.ref.get()).data() || {}; }
 async claim(resumeId=null, knownIds=[]) {
  return this.db.runTransaction(async tx=>{
   const [cs,ss,ps,ts]=await Promise.all([tx.get(this.ref),tx.get(this.db.doc('settings/global')),tx.get(this.db.collection('projects')),tx.get(this.db.collection('tasks').where('status','in',['queued','running']))]);
   const c=cs.data()||{}, settings=ss.data()||{}, projects=ps.docs.map(d=>({...d.data(),id:d.id})), tasks=ts.docs.map(d=>({...d.data(),id:d.id}));
   if((c.cooldownUntil||0)>this.clock()) return null;
   c.claims ||= {}; c.served ||= {};
   if (Object.entries(c.claims).some(([id,x])=>x.token===this.token && id!==resumeId && !knownIds.includes(id))) throw Error("Owned claim has no local task checkpoint; inspect before starting another task.");
   const available=tasks.filter(t=>eligible(t,projects,settings,this.clock()) && (!c.claims[t.id] || c.claims[t.id].token===this.token) && !Object.entries(c.claims).some(([id,x])=>x.target===targetKey(t,this.mappings)&&id!==t.id));
   let task=resumeId ? available.find(t=>t.id===resumeId&&c.claims[t.id]?.token===this.token) : selectTask(projects,available.filter(t=>t.status==='queued'&&!c.claims[t.id]),c.served);
   if(!task) return null;
   const previous=c.claims[task.id];
   if(previous?.reserved) throw Error('Previous worker slice has not been reconciled; inspect checkpoint before resuming.');
   const reservation=this.minutes;
   c.claims[task.id]={lane:this.lane,token:this.token,target:targetKey(task,this.mappings),reserved:reservation,accountedMinutes:0,startedAt:this.clock(),lastSeen:this.clock()};
   for(const key of [task.projectId,`${task.projectId}:${task.target||'app'}`]) c.served[key]=(c.served[key]||0)+reservation;
   tx.set(this.ref,c);
   tx.update(this.db.doc('tasks/'+task.id),{status:'running',workerLane:this.lane,updatedAt:this.clock()});
   return task;
  });
 }
 async recoverBlocked() {
  return this.db.runTransaction(async tx=>{
   const [cs,ss,ps,ts]=await Promise.all([tx.get(this.ref),tx.get(this.db.doc('settings/global')),tx.get(this.db.collection('projects')),tx.get(this.db.collection('tasks').where('status','==','blocked'))]);
   const c=cs.data()||{}, settings=ss.data()||{}, now=this.clock(), projects=ps.docs.map(d=>({...d.data(),id:d.id}));
   if(!settings.workerEnabled || isPaused(new Date(now)) || (c.cooldownUntil||0)>now) return null;
   const candidates=ts.docs.map(d=>({...d.data(),id:d.id})).filter(t=>{
    const p=projects.find(p=>p.id===t.projectId), e=t.evidence?.at(-1), recovery=t.automaticRecovery||{};
    return t.status==='blocked' && t.approved===true && p?.enabled && p.weight>0 && !t.ownerUpdate?.needsOwner && !c.claims?.[t.id]
      && !Object.values(c.claims||{}).some(x=>x.target===targetKey(t,this.mappings))
      && (recovery.attempts||0)<2 && now-(t.updatedAt||0)>=300000
      && e?.passed===false && ['timeout','missing_dependency','process_access'].includes(e.category);
   }).sort((a,b)=>(b.priority||0)-(a.priority||0));
   const t=candidates[0];if(!t)return null;
   tx.update(this.db.doc('tasks/'+t.id),{status:'queued',automaticRecovery:{attempts:(t.automaticRecovery?.attempts||0)+1,lastAttemptAt:now},updatedAt:now,
     ownerUpdate:{...t.ownerUpdate,next:'Resume the saved draft and repair the setup issue automatically.',needsOwner:false,question:'',answerHint:''}});
   return t.id;
  });
 }
 // A human/supervisor-authored continuation is a concrete remaining action, not
 // an inferred retry of a completed draft. Keep the task identity and worktree.
 async resumeContinuation() {
  return this.db.runTransaction(async tx=>{
   const [cs,ss,ps,ts]=await Promise.all([tx.get(this.ref),tx.get(this.db.doc('settings/global')),tx.get(this.db.collection('projects')),tx.get(this.db.collection('tasks').where('status','in',['blocked','review']))]);
   const c=cs.data()||{}, settings=ss.data()||{}, now=this.clock(), projects=ps.docs.map(d=>({...d.data(),id:d.id}));
   if(!settings.workerEnabled || isPaused(new Date(now)) || (c.cooldownUntil||0)>now) return null;
   const candidates=ts.docs.map(d=>({...d.data(),id:d.id})).filter(t=>{
    const p=projects.find(p=>p.id===t.projectId), next=t.continuation, history=t.continuationHistory||{};
    return ['blocked','review'].includes(t.status) && t.approved===true && p?.enabled && p.weight>0
     && (!t.ownerUpdate?.needsOwner || next?.independentOfOwner===true) && !c.claims?.[t.id]
     && !Object.values(c.claims||{}).some(x=>x.target===targetKey(t,this.mappings))
     && next?.approved===true && typeof next.id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(next.id)
     && typeof next.instruction==='string' && next.instruction.trim().length>0
     && next.afterStatus===t.status && Number.isFinite(next.notBefore??0) && (next.notBefore||0)<=now
     && !history[next.id];
   }).sort((a,b)=>(b.priority||0)-(a.priority||0));
   const t=candidates[0]; if(!t)return null;
   tx.update(this.db.doc('tasks/'+t.id),{status:'queued',updatedAt:now,
    continuationHistory:{...(t.continuationHistory||{}),[t.continuation.id]:{queuedAt:now,lane:this.lane}},
    ownerUpdate:{...t.ownerUpdate,next:t.continuation.instruction}});
   return t.id;
  });
 }
 async owns(id) { return (await this.state()).claims?.[id]?.token===this.token; }
 async canRun(id) {
  const [c,t,s,p]=await Promise.all([this.state(),this.db.doc('tasks/'+id).get(),this.db.doc('settings/global').get(),this.db.collection('projects').get()]);
  return c.claims?.[id]?.token===this.token && (c.cooldownUntil||0)<=this.clock() && eligible({...t.data(),id},p.docs.map(d=>({...d.data(),id:d.id})),s.data()||{},this.clock());
 }
 async finishSlice(id,minutes=null,release=false) {
  await this.db.runTransaction(async tx=>{
   const snap=await tx.get(this.ref), c=snap.data()||{}, claim=c.claims?.[id];
   if(!claim || claim.token!==this.token) throw Error('Task ownership changed; refusing worker mutation.');
   const task=(await tx.get(this.db.doc('tasks/'+id))).data();
   if(minutes !== null) { const actual=Math.max(claim.accountedMinutes||0,Math.max(0,minutes)); for(const key of [task.projectId,`${task.projectId}:${task.target||'app'}`]) c.served[key]=Math.max(0,(c.served[key]||0)-(claim.reserved||0)+actual-(claim.accountedMinutes||0)); claim.reserved=0;claim.accountedMinutes=actual; }
   claim.lastSeen=this.clock();
   if(release) delete c.claims[id];
   if(c.unity?.token===this.token && release) delete c.unity;
   tx.set(this.ref,c);
  });
 }
 async cooldown(until,reason) {
  await this.db.runTransaction(async tx=>{ const c=(await tx.get(this.ref)).data()||{}; c.cooldownUntil=Math.max(c.cooldownUntil||0,until); c.cooldownReason=reason; tx.set(this.ref,c); });
 }
 async unity(id,release=false) {
  return this.db.runTransaction(async tx=>{const c=(await tx.get(this.ref)).data()||{};
   if(c.claims?.[id]?.token!==this.token) throw Error('Unity verification requires task ownership.');
   if(release) { if(c.unity?.token===this.token) delete c.unity; } else { if(c.unity && c.unity.token!==this.token) return false; c.unity={token:this.token,lane:this.lane,task:id,since:this.clock()}; }
   tx.set(this.ref,c); return true;
  });
 }
 async status(value,details={}) {
  await this.db.runTransaction(async tx=>{const ref=this.db.doc('worker/status'), current=(await tx.get(ref)).data()||{}, shared=(await tx.get(this.ref)).data()||{}; const workers={...(current.workers||{}),[this.lane]:{status:value,lastSeen:this.clock(),...details}};
   const fresh=Object.values(workers).filter(w=>this.clock()-w.lastSeen<5*60000), active=fresh.filter(w=>/^Working:/.test(w.status));
   tx.set(ref,{workers,status:active.length?`${active.length} workers making progress`:value,lastSeen:this.clock(),quota:details.quota??current.quota??null,nextAttemptAt:Math.max(details.nextAttemptAt||0,shared.cooldownUntil||0)||null,cooldownReason:shared.cooldownReason||null,ownerQuestion:fresh.some(w=>w.status==="Blocked: sign in to Codex with ChatGPT")?"Please sign in to Codex on this laptop.":null},{merge:true}); });
 }
}
