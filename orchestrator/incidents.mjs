import {readFile,writeFile,mkdir,rename,unlink,open,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {notifySupervisor} from './supervisor-notify.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const serial=new Map();
function clean(value,max=280){
 return String(value??'').split(/[\r\n]/,1)[0]
  .replace(/\b(Bearer)\s+\S+/gi,'$1 [redacted]')
  .replace(/\b(password|passwd|secret|token|api[_-]?key|authorization|credential)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi,'$1=[redacted]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g,'[redacted]')
  .replace(/\b(?:ghp_|github_pat_|sk-|AIza)[A-Za-z0-9_-]+/g,'[redacted]')
  .replace(/[A-Za-z0-9_+/=-]{40,}/g,'[redacted]')
  .replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
// Task IDs are structured identifiers, not free-form diagnostic text. Applying
// long-token redaction to them hid ordinary descriptive task slugs from alerts.
function taskIdentifier(value){
 if(value==null)return null;
 const id=String(value);
 return /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)&&!/^(?:ghp_|github_pat_|sk-|AIza|eyJ)/.test(id)?id:'[redacted]';
}
function location(root,lane){if(!['lane-1','lane-2','legacy'].includes(lane))throw Error('Invalid incident lane.');return path.join(root,'.local','incidents',lane+'.json');}
async function atomic(file,value){
 const tmp=file+'.'+randomUUID()+'.tmp';const handle=await open(tmp,'wx');
 try{await handle.writeFile(JSON.stringify(value,null,2));await handle.sync();}finally{await handle.close();}
 try{for(let i=0;;i++){try{await rename(tmp,file);return;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||i>=7)throw e;await sleep(25*(i+1));}}}
 finally{await unlink(tmp).catch(()=>{});}
}
async function interprocess(file,fn){
 const lock=file+'.lock',guard=lock+'.recovery',token=randomUUID(),deadline=Date.now()+10000;let handle;
 while(!handle){
  if(Date.now()>deadline)throw Error('Incident lock unavailable; preserved previous incident.');
  try{await readFile(guard+'/owner');await sleep(20);continue;}catch{}
  try{handle=await open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,token}));}
  catch(e){if(e.code!=='EEXIST')throw e;
   try{const owner=JSON.parse(await readFile(lock,'utf8'));let dead=false;
    try{process.kill(owner.pid,0);}catch(e){dead=e.code==='ESRCH';}
    if(dead){await mkdir(guard);try{await writeFile(guard+'/owner',String(process.pid));const current=JSON.parse(await readFile(lock,'utf8'));if(current.token===owner.token)await unlink(lock);}finally{await unlink(guard+'/owner').catch(()=>{});await rmdir(guard);}}
   }catch{}
   await sleep(20);
  }
 }
 try{return await fn();}finally{await handle.close();const current=JSON.parse(await readFile(lock,'utf8'));if(current.token===token)await unlink(lock);}
}
async function update(file,fn){
 const previous=serial.get(file)||Promise.resolve();
 const next=previous.catch(()=>{}).then(async()=>{
  await mkdir(path.dirname(file),{recursive:true});
  return interprocess(file,async()=>{
  let current=null;try{current=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const {value,result}=await fn(current);if(value)await atomic(file,value);return result;
  });
 });
 serial.set(file,next);try{return await next;}finally{if(serial.get(file)===next)serial.delete(file);}
}
export async function recordIncident(root,{lane,taskId=null,category,message,now=Date.now()}){
 if(!Number.isFinite(now))throw Error('Incident time must be finite.');
 const safeCategory=clean(category,60).toLowerCase().replace(/[^a-z0-9-]/g,'-')||'unknown';
 const safeTask=taskIdentifier(taskId),safeMessage=clean(message)||'Worker needs inspection.';
 const fingerprint=createHash('sha256').update(JSON.stringify([lane,safeTask,safeCategory,safeMessage])).digest('hex');
 const expected=['pause','daily-pause','quota','plan-limit','capacity','model-capacity'].includes(safeCategory);
 const needsReview=/auth|credential|permission|security|owner-input/.test(safeCategory);
 const event=await update(location(root,lane),current=>{
  // The outer launcher sees a cleared checkpoint after the worker records its
  // failure. Keep the detailed incident rather than replacing its task context.
  if(current?.state==='pending'&&current.taskId!==null&&safeTask===null&&safeCategory==='launcher-error'&&current.message===safeMessage){
   const value={...current,lastSeen:Math.max(now,current.lastSeen),occurrences:current.occurrences+1};
   return {value,result:value};
  }
  const repeated=current?.fingerprint===fingerprint&&current.state==='pending';
  const value={version:1,lane,taskId:safeTask,category:safeCategory,message:safeMessage,fingerprint,state:'pending',expected,needsReview,retryable:!needsReview&&expected,firstSeen:repeated?current.firstSeen:now,lastSeen:Math.max(now,repeated?current.lastSeen:now),occurrences:repeated?current.occurrences+1:1};
  return {value,result:value};
 });
 await notifySupervisor(root,event).catch(()=>{});
 return event;
}
export async function resolveIncident(root,lane,{taskId=null,progressAt,evidence}={}){
 return update(location(root,lane),current=>{
  const kind=evidence?.kind;
  const actual=(['task-progress','task-completed'].includes(kind)||(kind==='checkpoint-saved'&&evidence.changed===true))&&typeof evidence?.detail==='string'&&!!clean(evidence.detail);
  const matches=current&&(current.taskId===null||current.taskId===taskIdentifier(taskId));
  if(!current||current.state!=='pending'||!matches||!actual||!Number.isFinite(progressAt)||progressAt<=current.lastSeen)
   return {result:{resolved:false,incident:current}};
  const value={...current,state:'recovered',recoveredAt:progressAt,recovery:{kind,detail:clean(evidence.detail),taskId:taskIdentifier(taskId)}};
  return {value,result:{resolved:true,incident:value}};
 });
}
