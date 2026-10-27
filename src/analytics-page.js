import { analyticsView, workerTime } from './analytics.js';
export const tokenMillions = value => `${(value / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
export function analyticsPage(state, esc, period = 'today', metric = 'time', now = Date.now()) {
  const data = analyticsView(state.analyticsDays, period, now), meta = state.analyticsMeta || {};
  const total = key => data.buckets.reduce((sum, row) => sum + row[key], 0);
  const names = id => state.projects.find(p => p.id === id)?.name || id;
  const started = metric === 'completed' ? meta.completionsStartedAt : meta.startedAt;
  const covered = b => started && b.start + (period === 'today' ? 3600000 : 86400000) > started && b.start <= now;
  const value = b => metric === 'time' ? b.milliseconds : metric === 'completed' ? b.completed : b.input + b.output;
  const format = v => metric === 'time' ? workerTime(v) : metric === 'tokens' ? tokenMillions(v) : v.toLocaleString('en-IN');
  const label = b => !covered(b) ? (b.start > now ? 'Later today' : 'Unavailable history') : metric === 'tokens' && !b.tokenRuns ? 'Tokens unavailable' : format(value(b));
  const max = Math.max(1, ...data.buckets.map(value));
  const options = (items, selected) => items.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('');
  const title = {time:'Work time',completed:'Tasks completed',tokens:'Token usage'}[metric];
  const header = `<div class="analytics-toolbar"><span>Overview <small>IST</small></span><div class="analytics-controls"><select id="analytics-metric" aria-label="Chart">${options([['time','Work time'],['completed','Tasks completed'],['tokens','Tokens']],metric)}</select><select id="analytics-period" aria-label="Period">${options([['today','Today'],['7','Last 7 days'],['30','Last 30 days']],period)}</select></div></div>`;
  if(state.analyticsUnavailable || !state.analyticsLoaded) return header + `<div class="notice" role="status">${state.analyticsUnavailable ? 'Analytics could not be loaded. Please reload to retry.' : 'Loading private analytics...'}</div>`;
  const projectValue = p => metric === 'time' ? p.milliseconds : metric === 'completed' ? p.completed : p.input+p.output;
  const ranked = [...data.projects].filter(p => metric !== 'tokens' || p.tokenRuns).sort((a,b)=>projectValue(b)-projectValue(a));
  const projectMax = Math.max(1,...ranked.map(projectValue));
  return `<div class="analytics-clean">${header}<p class="muted">Recorded usage only, including historical automation. Manual chat usage is not collected automatically. Token values are shown in millions (M).</p>
    <div class="analytics-kpis">
      <section><span>Work time</span><strong>${meta.startedAt ? esc(workerTime(data.total)) : '—'}</strong><small>${meta.startedAt ? 'Historical recorded time' : 'Awaiting first run'}</small></section>
      <section><span>Tasks completed</span><strong>${meta.completionsStartedAt ? total('completed') : '—'}</strong><small>Verified results</small></section>
      <section><span>Tokens (millions)</span><strong>${total('tokenRuns') ? tokenMillions(total('input')+total('output')) : '—'}</strong><small>${total('runs') ? total('tokenRuns')+' of '+total('runs')+' runs measured' : 'Awaiting first run'}</small></section>
    </div>
    <div class="analytics-panels">
      <section class="analytics-card analytics-trend"><div class="analytics-card-heading"><h2>${title}</h2><span>${period==='today'?'Hourly':'Daily'}</span></div>
        <div class="analytics-scale">${esc(format(max===1&&!data.buckets.some(value)?0:max))}</div>
        <div class="analytics-chart" tabindex="0" role="group" aria-label="${esc(title)} by ${period==='today'?'hour':'day'} in IST">${data.buckets.map((b,i)=>`<button type="button" class="analytics-column ${covered(b)&&(metric!=='tokens'||b.tokenRuns)?'':'unknown'}" data-analytics-bucket="${i}" title="${esc(b.label+' · '+label(b))}" aria-label="${esc(b.label+' IST: '+label(b))}"><span class="analytics-bar-track"><i style="height:${value(b)?Math.max(2,value(b)/max*100):0}%"></i></span><small>${esc(period==='today'?b.label.slice(0,2):b.label.slice(5))}</small></button>`).join('')}</div>
        <p id="analytics-value" role="status">${data.buckets.some(value)?'Select a bar for details.':'No recorded activity yet.'}</p>
      </section>
      <section class="analytics-card"><div class="analytics-card-heading"><h2>By project</h2><span>${title}</span></div><div class="analytics-projects">${ranked.length&&started?ranked.map(p=>`<div class="analytics-project"><strong>${esc(names(p.id))}</strong><span>${esc(format(projectValue(p)))}</span><div class="analytics-horizontal" aria-hidden="true"><i style="width:${projectValue(p)/projectMax*100}%"></i></div></div>`).join(''):'<div class="analytics-empty">Project totals appear as work is recorded.</div>'}</div></section>
    </div>
    <details class="analytics-details" data-detail-key="analytics-table"><summary>Data details</summary>
      <p>Earlier history is unavailable. New runs appear after they finish. Gaps mean unavailable history, not zero. All dates use IST.</p>
      <p>Historical worker time excludes idle time and the former daily pause. Parallel runs add their time separately. Tokens include input and output; cached input is already included. Missing tokens are not estimated.</p>
      <p>Token coverage: ${total('tokenRuns')}/${total('runs')} runs. ${total('partialRuns')} interrupted runs; ${total('partialTokenRuns')} runs with partial tokens.</p>
      <p>Account plan snapshot: ${state.worker.quota==null?'unavailable':esc(state.worker.quota)+'% used'}. Shared across your account; percentages are never added together.</p>
      <div class="analytics-table" tabindex="0" role="region" aria-label="Analytics values in IST"><table><caption>Recorded values · IST</caption><thead><tr><th>Period</th><th>Work time</th><th>Completed</th><th>Input (M)</th><th>Output (M)</th><th>Cached input (M)</th><th>Runs measured</th></tr></thead><tbody>${data.buckets.map(b=>`<tr><th scope="row">${esc(b.label)}</th><td>${meta.startedAt&&b.start+(period==='today'?3600000:86400000)>meta.startedAt&&b.start<=now?esc(workerTime(b.milliseconds)):'Unavailable'}</td><td>${meta.completionsStartedAt&&b.start+(period==='today'?3600000:86400000)>meta.completionsStartedAt&&b.start<=now?b.completed:'Unavailable'}</td>${['input','output','cached'].map(k=>`<td>${b.tokenRuns?tokenMillions(b[k]):'Unavailable'}</td>`).join('')}<td>${b.tokenRuns}/${b.runs}</td></tr>`).join('')}</tbody></table></div>
    </details></div>`;
}
