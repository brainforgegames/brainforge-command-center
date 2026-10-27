import { workRows } from './reading.js';
import { ownerView, when } from './presentation.js';

export const BOARD_COLUMNS = [
  ['queued', 'To do'], ['running', 'In progress'], ['blocked', 'Blockers'],
  ['review', 'In review'], ['done', 'Done'],
];
// Display migration only: never rewrite task identities, status or history.
export function boardStatus(task) {
  return ({queued:'queued', backlog:'queued', ready:'queued', draft:'queued',
    running:'running', blocked:'blocked', review:'review', verify:'review', done:'done'})[task.status] || 'blocked';
}
export const parked = (state, task) => !state.projects.some(p => p.id === task.projectId && p.enabled && p.weight > 0);
export function boardColumns(state, view='all', project='all', status='all', now=Date.now()) {
  const rows = workRows(state, view, project, 'all', now).filter(t => t.id !== 'studio-update');
  const sorted = rows.filter(t => status === 'all' || boardStatus(t) === status).sort((a,b) =>
    Number(parked(state,a))-Number(parked(state,b)) ||
    Number(state.projects.find(p=>p.id===b.projectId)?.weight||0)-Number(state.projects.find(p=>p.id===a.projectId)?.weight||0) || Number(b.priority||0)-Number(a.priority||0) ||
    Number(a.createdAt||0)-Number(b.createdAt||0) || String(a.id).localeCompare(String(b.id)));
  return BOARD_COLUMNS.map(([id,label]) => ({id,label,tasks:sorted.filter(t => boardStatus(t) === id)}));
}
export function boardCard(state, t, esc) {
  const u=ownerView(t), project=state.projects.find(p=>p.id===t.projectId);
  const lane=t.workerLane || t.assignedWorker || 'Unassigned';
  const worker=state.worker?.workers?.[lane];
  const active=worker?.taskId===t.id && /^Working:/.test(worker.status||'') && Date.now()-worker.lastSeen<300000;
  const dependencies=Array.isArray(t.dependencies)?t.dependencies:[];
  const value=v=>esc(typeof v==='string'?v:JSON.stringify(v));
  return `<article class="board-card" data-task-id="${esc(t.id)}"><div class="board-card-meta"><span>${esc(project?.name||t.projectId)}</span><span>${esc(({3:'High',2:'Medium',1:'Low'})[t.priority]||(Number.isFinite(Number(t.priority)) && Number(t.priority)>0 ? 'Priority '+Number(t.priority) : 'Priority unset'))}</span></div><h3>${esc(u.title||t.title)}</h3><p class="board-worker">${esc(lane)}${active?' · Active now':''}${parked(state,t)?' · Project parked':''}</p><p>${esc(t.status==='queued'?'Queued behind started work.':u.done)}</p>${boardStatus(t)==='blocked'?`<p class="board-issue">${esc(t.blockedReason||u.issue||'Status needs reconciliation.')}</p>`:''}<details data-detail-key="board:${esc(t.id)}"><summary>Task details</summary><dl><dt>Task ID</dt><dd>${esc(t.id)}</dd><dt>Acceptance criteria</dt><dd>${esc(t.acceptance||'Not recorded')}</dd><dt>Dependencies</dt><dd>${dependencies.length?dependencies.map(value).join(', '):'None recorded'}</dd><dt>Short result</dt><dd>${esc(t.ownerUpdate?.brief?.done||t.ownerUpdate?.done||'No result recorded')}</dd><dt>Next action</dt><dd>${esc(u.next)}</dd><dt>Recorded status</dt><dd>${esc(t.status)}</dd></dl>${t.result||t.history||t.continuationHistory||t.evidence?`<details><summary>Technical detail and history</summary><pre>${value({result:t.result,history:t.history,continuationHistory:t.continuationHistory,evidence:t.evidence})}</pre></details>`:''}</details><time>Updated ${esc(when(t.updatedAt||t.createdAt))}</time></article>`;
}
export function syncLabel(sync, mode) {
  if(mode==='demo')return 'Preview only · not the worker queue';
  if(!sync)return 'Sync state unavailable · last successful sync unknown';
  return `${sync.state||'Unknown'} · ${Number.isInteger(sync.pending)?sync.pending:'Unknown'} pending changes · Last successful sync: ${sync.lastSuccessAt?when(sync.lastSuccessAt):'not recorded'}${sync.observedAt?' · Queue checked '+when(sync.observedAt):''}`;
}
