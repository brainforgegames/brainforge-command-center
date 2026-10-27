import {readLocalState} from './local-database.mjs';

export function queueSyncView(state) {
  const pending=state.outbox.filter(e=>e.mutations.some(m=>/^(tasks|reports|analyticsRuns|analyticsDays|analyticsCompletions|ideas)\//.test(m.path))).length;
  const conflicts=Object.keys(state.sync?.outboxConflicts||{}).length+Object.keys(state.sync?.conflicts||{}).length;
  return {state:conflicts?'Needs reconciliation':pending?'Changes saved locally':'Local queue saved',pending,lastSuccessAt:state.sync?.lastSuccessAt||null,observedAt:Date.now()};
}

// The local board reads the existing durable queue; it never creates a queue or claims work.
export async function localBoardSnapshot(file) {
  const state=await readLocalState(file);
  const rows=name=>Object.entries(state.documents).filter(([p])=>p.startsWith(name+'/') && p.split('/').length===2).map(([p,v])=>({...v,id:p.split('/')[1]}));
  const keys=['id','title','projectId','target','status','priority','workerLane','assignedWorker','acceptance','dependencies','ownerUpdate','result','blockedReason','createdAt','updatedAt','history','continuationHistory','evidence','approved','kind'];
  const tasks=rows('tasks').map(t=>Object.fromEntries(keys.filter(k=>Object.hasOwn(t,k)).map(k=>[k,t[k]])));
  return {projects:rows('projects'),tasks,worker:state.documents['worker/status']||{},settings:state.documents['settings/global'],
    queueSync:queueSyncView(state)};
}
export function boardMiddleware(file) {
  return async (req,res,next)=>{
    if(req.url!=='/api/local-board')return next();
    const host=req.headers.host||'';
    const address=req.socket?.remoteAddress;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address) || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin!==`http://${host}`)) {res.writeHead(403);res.end();return;}
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    try {res.end(JSON.stringify(await localBoardSnapshot(file)));}
    catch {res.writeHead(503);res.end(JSON.stringify({error:'Local queue unavailable; saved work has not been changed.'}));}
  };
}
