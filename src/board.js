import { workRows } from './reading.js';
import { ownerView, when } from './presentation.js';

export const BOARD_COLUMNS = [
  ['queued', 'To do'], ['running', 'In progress'], ['blocked', 'Blockers'],
  ['review', 'Needs review'], ['done', 'Done'],
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
  let changeLink = '';
  try {
    const url = new URL(t.pr);
    if (url.protocol === 'https:' && ['github.com', 'gitlab.com'].includes(url.hostname) && !url.username && !url.password)
      changeLink = `<p><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">View the change</a></p>`;
  } catch { /* No valid review link recorded. */ }
  const dependencies=Array.isArray(t.dependencies)?t.dependencies:[];
  const value=v=>esc(typeof v==='string'?v:JSON.stringify(v));
  return `<article class="board-card" data-task-id="${esc(t.id)}"><div class="board-card-meta"><span>${esc(project?.name||t.projectId)}</span><span>${esc(({3:'High',2:'Medium',1:'Low'})[t.priority]||(Number.isFinite(Number(t.priority)) && Number(t.priority)>0 ? 'Priority '+Number(t.priority) : 'Priority unset'))}</span></div><h3>${esc(u.title||t.title)}</h3><p class="board-worker">${esc(t.status === "done" ? "Saved result" : parked(state,t)?"Project parked / saved for later":"Manual work / starts on request")}</p><p>${esc(t.status==='queued'?'Saved task. Work starts when requested.':u.done)}</p>${boardStatus(t)==='blocked'?`<p class="board-issue">${esc(String(u.issue||'This task needs a check before work can continue.').slice(0,180))}</p>`:''}<details data-detail-key="board:${esc(t.id)}"><summary>Task details</summary><dl><dt>Task ID</dt><dd>${esc(t.id)}</dd><dt>Acceptance criteria</dt><dd>${esc(t.acceptance||'Not recorded')}</dd><dt>Dependencies</dt><dd>${dependencies.length?dependencies.map(value).join(', '):'None recorded'}</dd><dt>Short result</dt><dd>${esc(t.ownerUpdate?.brief?.done||t.ownerUpdate?.done||'No result recorded')}</dd><dt>Next action</dt><dd>${esc(u.next)}</dd><dt>Recorded status</dt><dd>${esc(t.status)}</dd></dl>${changeLink}${t.result||t.blockedReason||t.history||t.continuationHistory||t.evidence?`<details><summary>Technical detail and history</summary><pre>${value({result:t.result,blockedReason:t.blockedReason,history:t.history,continuationHistory:t.continuationHistory,evidence:t.evidence})}</pre></details>`:''}</details><time>Updated ${esc(when(t.updatedAt||t.createdAt))}</time></article>`;
}
export function syncLabel(sync, mode) {
  if(mode==='demo')return 'Preview only / sample records';
  if(mode==='firebase')return 'Saved project records / updated on request';
  if(!sync)return 'Sync state unavailable · last successful sync unknown';
  return `${sync.state||'Unknown'} · ${Number.isInteger(sync.pending)?sync.pending:'Unknown'} pending changes · Last successful sync: ${sync.lastSuccessAt?when(sync.lastSuccessAt):'not recorded'}${sync.observedAt?' · Queue checked '+when(sync.observedAt):''}`;
}
