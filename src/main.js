import "./style.css";
import { analyticsPage } from './analytics-page.js';
import { analyticsView, workerTime } from './analytics.js';
import { ideaRows, ideaCards, ideasPage, ideaDialog } from "./ideas.js";
import { validatePreviewImage, safeStoreLink } from "./previews.js";
import { galleryMarkup } from "./gallery.js";
import { boot, save, saveAllocations, login, logout, mode, loadPreview } from "./store.js";
import { allocationShares, suggestedAllocation } from "./allocation.js";
import { initialState, reportVisible, targetName } from "./domain.js";
import { readableBullets, workRows, noteSections, reportEntry } from "./reading.js";
import {
  ownerView,
  studioSummary,
  workerView,
  statusLabels,
  priorityProjects,
  recentFirst,
  stamp,
  when,
} from "./presentation.js";
let state = initialState(),
  page = "Today",
  auth = null,
  menu = false,
  projectFilter = "all",
  statusFilter = "all",
  workView = "all";
let analyticsPeriod = 'today', analyticsMetric = 'time';
const root = document.querySelector("#app");
let allocationDraft = null,
  allocationBusy = false;
const colors = ["#d6b279", "#82b6d9", "#bda0df", "#df9d8a", "#87c6ae"];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = (id) =>
  id === "studio"
    ? "Brainforge studio"
    : state.projects.find((p) => p.id === id)?.name || id;
const badge = (text, tone = "") =>
  `<span class="badge ${esc(tone)}">${esc(text)}</span>`;
const safeLink = (url) =>
  /^https:\/\/(github\.com|gitlab\.com)\//i.test(url || "")
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">View the change ↗</a>`
    : "";
const empty = (title, body) =>
  `<div class="empty"><span>◇</span><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const dateLine = (t) =>
  `<time datetime="${new Date(stamp(t) || 0).toISOString()}">${esc(when(stamp(t)))}</time>`;
function taskCard(t) {
  const u = ownerView(t);
  return `<article class="work-card" data-task-id="${esc(t.id)}"><div class="work-top"><span class="task-project">${esc(names(t.projectId))} <span>· ${esc(targetName(t) === "Unity app" ? "App" : targetName(t))}</span></span>${badge(statusLabels[t.status] || "Studio update", t.status)}</div><h3>${esc(u.title)}</h3><div class="work-facts"><section><span class="fact-label">${t.status === "queued" ? "The goal" : "What changed"}</span>${bullets(t.status === "queued" ? t.ownerUpdate?.goal || u.next : u.done)}</section>${u.issue ? `<section class="issue-note"><span class="fact-label">What needs attention</span>${bullets(u.issue)}<small>${u.question ? "Your answer will help below." : "I’m handling this. You don’t need to act."}</small></section>` : ""}${t.status !== "done" ? `<section><span class="fact-label">Coming next</span>${bullets(u.next)}</section>` : ""}</div><div class="work-bottom">${dateLine(t)}${t.kind === "research" ? badge("Proposal · not a product change", "research") : ""}</div><details class="technical" data-detail-key="task:${esc(t.id)}"><summary>Details · work notes & checks</summary><div>${t.ownerUpdate?.brief ? `<h4>Original progress note</h4>${bullets(t.ownerUpdate.done)}${notes("Original issue note",t.ownerUpdate.issue)}${notes("Original next step",t.ownerUpdate.next)}` : ""}${notes("The task", t.acceptance)}${notes("Result", t.result)}${notes("Research & recommendations", t.researchBody)}${notes("Issue details", t.blockedReason)}${t.evidence?.length ? `<h4>Checks</h4><ul class="check-list">${t.evidence.map((e) => `<li><strong>${e.passed ? "✓ Passed" : "! Needs work"}</strong><code>${esc(e.command)}</code>${e.category ? `<small>${esc(e.category)} · Exit ${esc(e.exitCode ?? "unavailable")}${e.timedOut ? " · Timed out" : ""}${e.stopped ? " · Stopped" : ""}</small>` : ""}</li>`).join("")}</ul>` : ""}${safeLink(t.pr)}</div></details></article>`;
}
function bullets(value) {
  return `<ul class="readable-list">${readableBullets(value).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}
function notes(heading, value) {
  if (!value) return "";
  return `<section class="note-section"><h4>${esc(heading)}</h4>${noteSections(value).map((group) => `${group.heading !== "Notes" ? `<h5>${esc(group.heading)}</h5>` : ""}${bullets(group.items)}`).join("")}</section>`;
}
function questionCards() {
  const { questions } = studioSummary(state);
  return questions.length
    ? `<div class="question-grid">${questions
        .map((t) => {
          const u = ownerView(t);
          return `<article class="question-card"><span class="eyebrow">${esc(names(t.projectId))}</span><h3>${esc(u.question)}</h3><p>${esc(u.answerHint)}</p><div class="work-bottom">${dateLine(t)}<button class="secondary" data-question="${esc(t.id)}">Copy question for chat</button></div></article>`;
        })
        .join("")}</div>`
    : empty(
        "Nothing needed from you right now",
        "Open tasks are my work queue. I’ll put a specific, plain-language question here when I need your help.",
      );
}
function allocationPanel() {
  allocationDraft ||= allocationShares(state.projects);
  return `<section class="panel allocation-panel"><div class="allocation-heading"><div><p class="eyebrow">YOU SET THE DIRECTION</p><h2>Where should the time go?</h2><p>Choose each project’s share of available work time. Set 0% to park a project.</p></div><div class="allocation-total"><strong id="allocation-total">${Object.values(allocationDraft).reduce((a, b) => a + b, 0)}%</strong><span>of work time</span></div></div><div class="allocation-strip" aria-hidden="true">${state.projects.map((p, i) => `<i data-share-bar="${esc(p.id)}" style="width:${allocationDraft[p.id]}%;background:${colors[i % colors.length]}"></i>`).join("")}</div><form id="allocation-form"><div class="allocation-rows">${state.projects.map((p, i) => `<div class="allocation-row" style="--project-color:${colors[i % colors.length]}"><span class="allocation-dot"></span><label for="allocation-${esc(p.id)}">${esc(p.name)}<small>${esc(p.description)}</small></label><input aria-label="${esc(p.name)} time slider" data-share="${esc(p.id)}" type="range" min="0" max="100" step="1" value="${allocationDraft[p.id]}"><div class="percentage-input"><input id="allocation-${esc(p.id)}" aria-label="${esc(p.name)} percentage" data-share="${esc(p.id)}" type="number" min="0" max="100" step="1" required value="${allocationDraft[p.id]}"><span>%</span></div></div>`).join("")}</div><div class="allocation-actions"><div><button type="submit" id="allocation-save" ${allocationBusy ? "disabled" : ""}>${allocationBusy ? "Saving…" : "Save time split"}</button><button type="button" class="text" id="allocation-equal">Split equally</button><button type="button" class="text" id="allocation-reset">Reset changes</button></div><p id="allocation-message" aria-live="polite">Total must be 100%. Your changes apply after saving.</p></div></form><p class="allocation-footnote">This sets a long-term share, rather than fixed hours. If a project is stuck or has no ready work, the worker can spend that time on other eligible projects. Approved tasks and stated plans guide implementation; otherwise it researches ideas.</p></section>`;
}
function timeSplitPage() {
  return `<div class="page-intro"><p>Set your priorities without managing every task.</p></div>${allocationPanel()}`;
}
let previewOpener = null;
function closePreview() { previewImage = null; ++previewRequest; render(); document.querySelector(`[data-preview="${previewOpener}"]`)?.focus(); }
let previewFilter = "all", previewImage = null, previewBusy = false, previewError = "", previewRequest = 0;
function screenshotsPage() { return galleryMarkup(state, esc, names, when, previewFilter, previewImage, previewError, previewBusy); }
let selectedIdea = null, ideaAlternate = false;
function ideas() { return ideasPage(state.ideas || [], esc, when, mode === "firebase" && !state.ideasLoaded, state.ideasUnavailable); }
function ideaStrip() { return ideaRows(state.ideas || []).length ? `<section class="ideas-strip"><div class="section-title"><div><span class="eyebrow">POSSIBILITIES FOR THE STUDIO</span><h2>Ideas to explore</h2></div><button class="text" data-page="Ideas">All ideas</button></div><p class="concept-label">Concept illustrations · not built games</p><div class="ideas-grid">${ideaCards(state.ideas,esc,when,3)}</div></section>` : ""; }
function closeIdea() { const previous=selectedIdea; selectedIdea=null;ideaAlternate=false;render();document.querySelector(`[data-idea="${previous}"]`)?.focus(); }
function projectsPage() {
  return `<div class="page-intro"><p>Five focus areas. Progress and next steps live here. Change the balance in <button class="text" data-page="Time split">Time split →</button></p></div><div class="section-title"><div><p class="eyebrow">THE STUDIO PORTFOLIO</p><h2>All projects</h2></div><span class="muted">Select a card to explore its work</span></div>${projects()}`;
}
function projects() {
  const shares = allocationShares(state.projects);
  return `<div class="project-grid">${state.projects
    .map((p, i) => {
      const tasks = recentFirst(
          state.tasks.filter((t) => t.projectId === p.id),
        ),
        s = studioSummary({ ...state, tasks }, Date.now(), false),
        latest = tasks[0],
        next =
          s.active[0] ||
          s.planned[0] ||
          tasks.find((t) => t.status === "review") ||
          s.issues[0],
        u = next ? ownerView(next) : null;
      const status =
        !p.enabled || !p.weight
          ? "Paused"
          : s.active.length
            ? "In progress"
            : s.planned.length
              ? "Work planned"
              : s.issues.length
                ? "Resolving an issue"
                : "Planning next steps";
      return `<article class="project p${i}"><div class="project-top"><span class="monogram">${esc(p.short || p.name.slice(0, 2))}</span>${badge(status, !p.enabled || !p.weight ? "paused" : s.active.length ? "running" : s.issues.length ? "blocked" : "ready")}</div><h3>${esc(p.name)}</h3><p class="project-description">${esc(p.description)}</p>${safeStoreLink(p.storeLink) ? `<a class="store-link" href="${esc(safeStoreLink(p.storeLink))}" target="_blank" rel="noopener noreferrer">View on Google Play</a>` : ""}<div class="project-snapshot"><span class="fact-label">Latest progress</span>${bullets(latest ? ownerView(latest).done : "No progress update recorded yet.")}<span class="fact-label">Coming next</span>${bullets(u?.next || p.nextPlan || "Research ideas and prepare a plan before starting product changes.")}</div><div class="saved-share"><span>Time share</span><strong>${shares[p.id]}%</strong><i style="width:${shares[p.id]}%"></i></div><div class="project-counts"><span><b>${s.open.length}</b> open work items</span><span><b>${s.questions.length}</b> questions for you</span></div><div class="project-footer"><small>${latest ? "Updated " + esc(when(stamp(latest))) : "Awaiting first update"}</small>${p.id === "brainforge-company" ? `<button class="text" data-page="Ideas">Explore ideas</button>` : ""}<button class="text" data-project="${esc(p.id)}">See work →</button></div></article>`;
    })
    .join("")}</div>`;
}
function briefItems(rows, field, fallback) {
  return rows.length ? `<div class="brief-items">${rows.slice(0, 3).map((t) => `<article><strong>${esc(names(t.projectId))}</strong>${bullets(ownerView(t)[field])}<time>${esc(when(stamp(t)))}</time></article>`).join("")}</div>` : `<p class="muted">${esc(fallback)}</p>`;
}
function today() {
  const s = studioSummary(state), w = workerView(state);
  const next = [...s.active, ...s.planned, ...s.checking, ...s.issues].filter(t => state.projects.some(p => p.id === t.projectId && p.enabled && p.weight > 0));
  return `<section class="hero"><div><span class="eyebrow">YOUR DAILY STUDIO BRIEF</span><h2>Your studio.<br>A clear next move.</h2><p>What changed, what needs attention, and what happens next.</p></div><div class="live-card"><span class="live-indicator ${esc(w.tone)}"></span><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p><small>Last check-in · ${esc(when(state.worker.lastSeen))}</small><button class="text" data-page="Workers">See worker activity →</button></div></section>
    <div class="stats">
      <button class="stat-card" data-work-view="today"><small>Updates today</small><strong>${s.today.length}</strong><span>Changed today · includes drafts</span><b>See all ${s.today.length} updates →</b></button>
      <button class="stat-card" data-work-view="open"><small>Open work</small><strong>${s.open.length}</strong><span>${s.active.length} underway · ${s.planned.length} planned<br>${s.checking.length} waiting for review · ${s.issues.length} need fixes${s.parked.length ? `<br>${s.parked.length} saved on paused projects` : ""}</span><b>See all ${s.open.length} work items →</b></button>
      <button class="stat-card attention-stat" data-page="Your help"><small>Questions for you</small><strong>${s.questions.length}</strong><span>${s.questions.length ? "A specific answer or decision is needed" : "Nothing you need to do right now"}</span><b>${s.questions.length ? "See the questions →" : "You’re all caught up →"}</b></button>
      <button class="stat-card" data-page="Reports"><small>Evening report</small><strong>10 PM</strong><span>Every day · India time</span><b>Read the reports →</b></button>
    </div>
    <div class="brief-grid">
      <section class="brief"><span class="step-number">01 · RESULTS</span><h2>What was finished</h2>${briefItems(s.completed,"done","No finished work recorded today yet. Drafts are shown separately.")}<button class="text" data-work-view="today">See today’s activity →</button></section>
      <section class="brief"><span class="step-number">02 · ATTENTION</span><h2>What got in the way</h2>${briefItems(s.issues,"issue","No unresolved issues recorded.")}<small>I handle fixes. I’ll ask you only when your input is needed.</small></section>
      <section class="brief"><span class="step-number">03 · THE PLAN</span><h2>What happens next</h2>${briefItems(next,"next","Research useful improvements and propose the next plan.")}<small>Work follows your tasks or a stated plan.</small></section>
    </div>
    ${s.readyForReview.length ? `<section class="review-strip"><div><span class="eyebrow">STILL BEING CHECKED</span><h2>${s.readyForReview.length} ${s.readyForReview.length === 1 ? "draft" : "drafts"} updated today</h2><p>Prepared work, not finished or released. I handle the review.</p></div><button class="secondary" data-review-today>See these drafts →</button></section>` : ""}
    ${ideaStrip()}<section class="panel help-panel"><div class="section-title"><div><p class="eyebrow">ONLY WHEN YOU’RE NEEDED</p><h2>Your help</h2></div>${badge(s.questions.length + " questions",s.questions.length ? "blocked" : "ready")}</div>${questionCards()}</section>
    <div class="section-title"><div><p class="eyebrow">MOST RECENT FIRST</p><h2>Latest updates</h2></div><button class="text" data-work-view="today">All today’s updates →</button></div><div class="work-grid">${s.today.slice(0,3).map(taskCard).join("") || empty("A fresh start","Today’s updates will appear here.")}</div>`;
}
function workBoard() {
  const rows = workRows(state, workView, projectFilter, statusFilter);
  return `<div class="page-intro"><p>This is my work queue. You only need to act on items in <button class="text" data-page="Your help">Your help</button>. Discuss new tasks and feedback in our chat.</p></div><div class="filter-bar"><label>Show<select id="work-view"><option value="all" ${workView === "all" ? "selected" : ""}>All work</option><option value="today" ${workView === "today" ? "selected" : ""}>Updates today</option><option value="open" ${workView === "open" ? "selected" : ""}>Open work</option></select></label><label>Project<select id="project-filter"><option value="all">All projects</option>${state.projects.map((p) => `<option value="${esc(p.id)}" ${p.id === projectFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Progress<select id="status-filter"><option value="all">All progress</option>${Object.entries(
    statusLabels,
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${v === statusFilter ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><span>${rows.length} ${rows.length === 1 ? "task" : "tasks"} · newest first</span></div><div class="work-grid">${rows.map(taskCard).join("") || empty("No tasks in this view", "Choose another filter to see more work.")}</div>`;
}
function reportRows(items) {
  return items.map((item) => { const entry=reportEntry(item); return `<article class="report-item"><strong>${esc(entry.project)}</strong>${bullets(entry.items)}${entry.time ? `<time>${esc(entry.time)}</time>` : ""}</article>`; }).join("");
}
function reports() {
  const rows = state.reports.filter((r) => reportVisible(r)).sort((a,b) => b.createdAt-a.createdAt);
  return `<div class="page-intro"><p>The day’s results and next moves, in plain language. Saved at 10 PM IST for 30 days.</p></div>${rows.map((r,i) => {
    const sections=r.ownerSections || r.sections || [];
    return `<article class="panel report"><div class="section-title"><div><span class="eyebrow">${i === 0 ? "LATEST REPORT" : "DAILY REPORT"}</span><h2>${esc(r.date)}</h2></div><time>${esc(when(r.createdAt))}</time></div><div class="report-sections">${sections.map((section) => `<section><h3>${esc(section.heading)}</h3>${reportRows(section.items.slice(0,3))}${section.items.length > 3 ? `<details class="more-items" data-detail-key="more:${esc(r.id || r.date)}:${esc(section.heading)}"><summary>Show ${section.items.length-3} more updates</summary>${reportRows(section.items.slice(3))}</details>` : ""}</section>`).join("")}</div><details class="technical" data-detail-key="report:${esc(r.id || r.date)}"><summary>Details · original report & technical notes</summary>${r.ownerSections ? (r.sections || []).map((section) => notes(section.heading, section.items.join("\n"))).join("") : ""}${notes("Supporting record",r.body)}</details></article>`;
  }).join("") || empty("The evening report is on its way","Today shows live progress while you wait for the 10 PM report.")}`;
}
function workersPage() {
  const now=Date.now();
  return `<div class="page-intro"><p>Two independent workers share your saved priorities and plan allowance. Only one runs Unity checks at a time.</p></div><div class="work-grid">${["lane-1","lane-2"].map((id,i)=>{
    const w=state.worker.workers?.[id],t=state.tasks.find(t=>t.id===w?.taskId),fresh=w?.lastSeen && now-w.lastSeen<5*60000;
    const label=!w ? "Not yet checked in" : !fresh ? "No recent check-in" : !state.settings.workerEnabled ? "Paused" : /^Working:/.test(w.status) ? "Working" : /Unity/.test(w.status) ? "Waiting for game checks" : /model availability/.test(w.status) ? "Waiting for the model" : /limit reset/.test(w.status) ? "Waiting for plan reset" : /review/.test(w.status) ? "Work ready for review" : /pause|checkpoint/i.test(w.status) ? "Progress saved" : "Ready for the next task";
    return `<article class="work-card"><span class="eyebrow">WORKER ${i+1}</span><h2>${esc(label)}</h2>${t ? `<strong>${esc(names(t.projectId))}</strong><h3>${esc(ownerView(t).title)}</h3><span class="fact-label">Next step</span>${bullets(ownerView(t).next)}` : `<p>${!w ? "This worker has not connected yet." : "It checks for work using your saved time split. Two workers cannot edit the same app repository at once; independent website or research work can run alongside it."}</p>`}<time>Last check-in · ${esc(when(w?.lastSeen))}</time></article>`;
  }).join("")}</div>`;
}
function settings() {
  const w = workerView(state);
  return `<div class="settings-grid"><section class="panel"><h2>Work controls</h2>${badge(w.title, w.tone)}<p>${esc(w.detail)}</p><button id="worker-toggle">${state.settings.workerEnabled ? "Pause work" : "Resume work"}</button><p class="muted">Last check-in · ${esc(when(state.worker.lastSeen))}</p></section><section class="panel"><h2>Plan usage</h2><strong class="usage">${state.worker.quota == null ? "Not available" : esc(state.worker.quota) + "%"}</strong><p>Used in the busiest reported account window. This is shared with your other Codex work.</p><div class="notice">The worker waits when your plan limit is reached. No extra credits are purchased.</div></section><section class="panel"><h2>The daily rhythm</h2><div class="timeline"><div><b>10 PM</b><span>Daily report<small>Results, issues and the next plan</small></span></div><div><b>11 PM</b><span>Rest hour begins<small>Progress is saved</small></span></div><div><b>12 AM</b><span>Work can resume<small>Laptop awake, online and within plan limits</small></span></div></div></section><section class="panel"><h2>How we work</h2><ul><li>Discuss tasks and feedback in chat.</li><li>I handle checks, reviews and merging.</li><li>You publish to the Play Store and App Store.</li><li>No task or plan? Research ideas first.</li><li>Sikhi Khoj website updates are grouped weekly.</li></ul></section></div>`;
}
function render() {
  state.projects = priorityProjects(state.projects);
  const gated = mode === "firebase" && (!auth || auth.denied || auth.error),
    s = studioSummary(state),
    nav = [
      ["Today", "◈"],
      ["Projects", "▦"],
      ["Analytics", "▥"],
      ["Time split", "◷"],
      ["Work board", "☷"],
      ["Workers", "◉"],
      ["Your help", "?"],
      ["Reports", "▤"],
      ["Screenshots", "▧"],
      ["Ideas", "◇"],
      ["Settings", "⚙"],
    ];
  root.innerHTML = `<aside class="${menu ? "open" : ""}"><a class="brand" href="#" data-page="Today"><span>BF</span><div>BRAINFORGE<small>COMMAND CENTER</small></div></a><small class="nav-label">YOUR STUDIO</small><nav aria-label="Main navigation">${nav.map(([label, icon]) => `<button data-page="${label}" class="${page === label ? "active" : ""}" ${page === label ? 'aria-current="page"' : ""}><span>${icon}</span>${label}${label === "Your help" && s.questions.length ? `<b class="nav-count">${s.questions.length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-foot"><span class="dot"></span> Thoughtful progress<small>Quality over speed. Always.</small></div></aside>${menu ? '<button class="nav-backdrop" id="close-menu" aria-label="Close navigation"></button>' : ""}<div class="workspace"><header><button id="menu" class="menu" aria-label="Toggle navigation" aria-expanded="${menu}">☰</button><span>Studio <b>/ ${esc(page)}</b></span><div>${badge(mode === "demo" ? "Preview" : "Private workspace")}<button id="auth">${mode === "demo" ? "Demo" : auth ? "Sign out" : "Sign in"}</button></div></header><main><div class="page-heading"><div><p class="eyebrow">BRAINFORGE COMMAND CENTER</p><h1 class="${page === "Today" ? "studio-wordmark" : ""}">${page === "Today" ? "Brainforge <span>Games</span><i></i>" : esc(page === "Work board" ? ({today:"Updates today",open:"Open work",all:"All work"}[workView]) : page)}</h1></div><span class="muted">${esc(when(Date.now()))}</span></div>${mode === "demo" ? '<div class="demo-banner">Design preview · Sample data only. Your live workspace is separate.</div>' : ""}${gated ? `<section class="panel sign-in"><span class="monogram">BF</span><h2>Your studio, privately.</h2><p>${esc(auth?.error || "Sign in with your Brainforge admin Google account to see progress and plans.")}</p><button id="login">Sign in with Google</button></section>` : ({ Today: today, Analytics: () => analyticsPage(state, esc, analyticsPeriod, analyticsMetric), Projects: projectsPage, "Time split": timeSplitPage, "Work board": workBoard, Workers: workersPage, "Your help": () => `<div class="page-intro"><p>Only decisions, access or information I actually need from you. Reply in our chat; I’ll keep this page updated.</p></div>${questionCards()}`, Reports: reports, Screenshots: screenshotsPage, Ideas: ideas, Settings: settings }[page] || today)()}</main><footer>Brainforge Games <span>Clear plans. Thoughtful progress.</span></footer></div><div id="toast" role="status"></div>`;
  if (selectedIdea) {
    const current = ideaRows(state.ideas || []).find(v=>v.id===selectedIdea);
    if (current) root.insertAdjacentHTML("beforeend",ideaDialog(current,esc,ideaAlternate));
    else selectedIdea = null;
  }
  bind();
}
let toastTimer;
function toast(text) {
  const el = document.querySelector("#toast");
  if (el) el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    const t = document.querySelector("#toast");
    if (t) t.textContent = "";
  }, 5000);
}
function bind() {
  document.querySelectorAll("[data-idea]").forEach(el=>el.onclick=()=>{ selectedIdea=el.dataset.idea;ideaAlternate=false;render(); });
  const dialog=document.querySelector("#idea-dialog");
  if(dialog) {
    dialog.showModal();
    dialog.addEventListener("cancel",e=>{e.preventDefault();closeIdea();});
    dialog.addEventListener("click",e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeIdea();}});
    document.querySelector("#close-idea")?.addEventListener("click",closeIdea);
    document.querySelector("#idea-try")?.addEventListener("click",()=>{ideaAlternate=!ideaAlternate;render();document.querySelector("#idea-try")?.focus();});
  }

  document.querySelector(".preview-expanded img")?.addEventListener("error", () => { previewImage = null; previewError = "This image could not be displayed. Please try opening it again."; render(); document.querySelector(`[data-preview="${previewOpener}"]`)?.focus(); });
  document.querySelector("#preview-filter")?.addEventListener("change", e => { previewFilter = e.target.value; render(); });
  document.querySelector("#close-preview")?.addEventListener("click", closePreview);
  document.querySelectorAll("[data-preview]").forEach(el => el.onclick = async () => {
    const item = (state.previews || []).find(p => p.id === el.dataset.preview);
    if (!item) return;
    previewOpener = item.id;
    const request = ++previewRequest; previewBusy = true; previewImage = null; previewError = ""; render();
    try { const image = validatePreviewImage(await loadPreview(item.id)); if (request === previewRequest && auth && !auth.denied) previewImage = {...item, dataUrl: image.dataUrl}; }
    catch { if (request === previewRequest) previewError = "This screenshot could not be opened. Please try again."; }
    finally { if (request === previewRequest) { previewBusy = false; render(); document.querySelector("#close-preview")?.focus(); } }
  });
  function allocationInputs() {
    const values = Object.values(allocationDraft || {}),
      total = values.reduce((a, b) => a + b, 0),
      valid =
        values.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) &&
        total === 100;
    const el = document.querySelector("#allocation-total");
    if (el) el.textContent = total + "%";
    const button = document.querySelector("#allocation-save");
    if (button) {
      button.disabled = !valid || allocationBusy;
      button.textContent = allocationBusy ? "Saving…" : "Save time split";
    }
    const message = document.querySelector("#allocation-message");
    if (message) {
      message.textContent = valid
        ? "Ready to save · 100% allocated."
        : total < 100
          ? `${100 - total}% left to assign.`
          : `${total - 100}% over the total. Reduce a share to save.`;
      message.classList.toggle("warning", !valid);
    }
    document.querySelectorAll("[data-share]").forEach((input) => {
      input.value = allocationDraft[input.dataset.share];
    });
    document.querySelectorAll("[data-share-bar]").forEach((el) => {
      el.style.width = allocationDraft[el.dataset.shareBar] + "%";
    });
  }
  document.querySelectorAll("[data-share]").forEach((input) =>
    input.addEventListener("input", () => {
      allocationDraft[input.dataset.share] =
        input.value === "" ? 0 : Number(input.value);
      allocationInputs();
    }),
  );
  document.querySelector("#allocation-equal")?.addEventListener("click", () => {
    allocationDraft = allocationShares(
      state.projects.map((p) => ({ ...p, enabled: true, weight: 1 })),
    );
    allocationInputs();
  });
  document
    .querySelector("#allocation-suggested")
    ?.addEventListener("click", () => {
      allocationDraft = suggestedAllocation(state.projects);
      allocationInputs();
    });
  document.querySelector("#allocation-reset")?.addEventListener("click", () => {
    allocationDraft = allocationShares(state.projects);
    allocationInputs();
  });
  document
    .querySelector("#allocation-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      allocationBusy = true;
      allocationInputs();
      let message = "";
      try {
        await saveAllocations({ ...allocationDraft });
        allocationDraft = null;
        message =
          "Time split saved. The worker will use it when selecting work.";
      } catch (e) {
        message = e.message;
      } finally {
        allocationBusy = false;
        if (page === "Time split") {
          render();
        }
        toast(message);
      }
    });
  document.querySelector('#analytics-period')?.addEventListener('change', e => { analyticsPeriod = e.target.value; render(); document.querySelector('#analytics-period')?.focus(); });
  document.querySelector('#analytics-metric')?.addEventListener('change', e => { analyticsMetric = e.target.value; render(); document.querySelector('#analytics-metric')?.focus(); });
  document.querySelectorAll('[data-analytics-bucket]').forEach(button => button.addEventListener('click', () => {
    const b = analyticsView(state.analyticsDays, analyticsPeriod).buckets[Number(button.dataset.analyticsBucket)];
    const start = analyticsMetric === 'completed' ? state.analyticsMeta?.completionsStartedAt : state.analyticsMeta?.startedAt;
    const available = start && b.start + (analyticsPeriod === 'today' ? 3600000 : 86400000) > start && b.start <= Date.now();
    document.querySelector('#analytics-value').textContent = `${b.label} IST: ${!available ? 'Unavailable history or future period' : analyticsMetric === 'time' ? workerTime(b.milliseconds) : analyticsMetric === 'completed' ? `${b.completed} verified completed tasks` : b.tokenRuns ? `${b.input.toLocaleString()} input, ${b.output.toLocaleString()} output, ${b.cached.toLocaleString()} cached input; ${b.tokenRuns}/${b.runs} runs covered` : 'Token usage unavailable'}`;
  }));
  if (page === "Time split") allocationInputs();
  document.querySelectorAll("[data-page]").forEach(
    (el) =>
      (el.onclick = (e) => {
        e.preventDefault();
        page = el.dataset.page;
        if (page === "Work board") { workView = "all"; projectFilter = "all"; statusFilter = "all"; }
        menu = false;
        render();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelectorAll("[data-project]").forEach(
    (el) =>
      (el.onclick = () => {
        projectFilter = el.dataset.project;
        workView = "all";
        statusFilter = "all";
        page = "Work board";
        render();
        window.scrollTo(0, 0);
      }),
  );
  const openWork = (view, status = "all") => {
    workView = view; projectFilter = "all"; statusFilter = status;
    page = "Work board"; menu = false; render(); window.scrollTo(0,0);
  };
  document.querySelectorAll("[data-work-view]").forEach((el) => el.onclick = () => openWork(el.dataset.workView));
  document.querySelector("[data-review-today]")?.addEventListener("click", () => openWork("today","review"));
  document.querySelector("#work-view")?.addEventListener("change", (e) => { workView=e.target.value; render(); });
  document.querySelector("#menu").onclick = () => {
    menu = !menu;
    render();
  };
  document.querySelector("#close-menu")?.addEventListener("click", () => {
    menu = false;
    render();
  });
  document.querySelector("#auth").onclick = () =>
    mode === "demo"
      ? toast("This is a sample preview.")
      : void (auth ? logout() : login()).catch((e) => toast(e.message));
  document
    .querySelector("#login")
    ?.addEventListener(
      "click",
      () => void login().catch((e) => toast(e.message)),
    );
  document.querySelector("#project-filter")?.addEventListener("change", (e) => {
    projectFilter = e.target.value;
    render();
  });
  document.querySelector("#status-filter")?.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    render();
  });
  document
    .querySelector("#worker-toggle")
    ?.addEventListener("click", async () => {
      try {
        await save("settings", "global", {
          workerEnabled: !state.settings.workerEnabled,
        });
        toast("Work schedule updated.");
      } catch (e) {
        toast(e.message);
      }
    });
  document.querySelectorAll("[data-question]").forEach(
    (el) =>
      (el.onclick = async () => {
        const t = studioSummary(state).questions.find(
          (t) => t.id === el.dataset.question,
        );
        try {
          await navigator.clipboard.writeText(
            `${names(t.projectId)}: ${ownerView(t).question}`,
          );
          toast("Copied. Paste it in our chat with your answer.");
        } catch {
          toast(
            "Copy is unavailable. You can select the question and copy it.",
          );
        }
      }),
  );
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewImage) { closePreview(); return; }
  if (e.key === "Escape" && menu) {
    menu = false;
    render();
    document.querySelector("#menu")?.focus();
  }
});
render();
void boot(
  (s) => {
    state = s;
    const open = [...document.querySelectorAll("details[open][data-detail-key]")].map((el) => el.dataset.detailKey);
    const analyticsFocus = page === 'Analytics' && document.activeElement?.dataset.analyticsBucket;
    if (document.activeElement?.matches("select,input,textarea") || document.querySelector("#idea-dialog[open]")) return;
    render();
    document.querySelectorAll("details[data-detail-key]").forEach((el) => { el.open = open.includes(el.dataset.detailKey); });
    if (/^\d+$/.test(analyticsFocus || '')) document.querySelector(`[data-analytics-bucket="${analyticsFocus}"]`)?.focus({ preventScroll: true });
  },
  (u) => {
    auth = u; selectedIdea=null; ideaAlternate=false; previewImage = null; previewError = ""; previewBusy = false; ++previewRequest;
    render();
  },
).catch((e) => toast(e.message));
