import "./style.css";
import { boot, save, saveAllocations, login, logout, mode } from "./store.js";
import { allocationShares, suggestedAllocation } from "./allocation.js";
import { initialState, reportVisible, targetName } from "./domain.js";
import {
  ownerView,
  studioSummary,
  workerView,
  statusLabels,
  recentFirst,
  stamp,
  when,
} from "./presentation.js";
let state = initialState(),
  page = "Today",
  auth = null,
  menu = false,
  projectFilter = "all",
  statusFilter = "all";
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
  return `<article class="work-card"><div class="work-top"><span class="task-project">${esc(names(t.projectId))} <span>· ${esc(targetName(t) === "Unity app" ? "App" : targetName(t))}</span></span>${badge(statusLabels[t.status] || "Update", t.status)}</div><h3>${esc(u.title)}</h3><div class="work-facts"><div><span class="fact-label">${t.status === "queued" ? "The goal" : "Progress"}</span><p>${esc(t.status === "queued" ? t.ownerUpdate?.goal || u.next : u.done)}</p></div>${u.issue ? `<div class="issue-note"><span class="fact-label">What got in the way</span><p>${esc(u.issue)}</p><small>${u.question ? "Your answer will help below." : "I’m handling this. No action needed from you."}</small></div>` : ""}<div><span class="fact-label">Next step</span><p>${esc(u.next)}</p></div></div><div class="work-bottom">${dateLine(t)}${t.kind === "research" ? badge("Ideas & planning", "research") : ""}</div><details class="technical"><summary>Work notes & checks</summary><div><p>${esc(t.acceptance)}</p>${t.result ? `<p>${esc(t.result)}</p>` : ""}${t.researchBody ? `<pre>${esc(t.researchBody)}</pre>` : ""}${t.blockedReason ? `<p class="raw-note">${esc(t.blockedReason)}</p>` : ""}${(t.evidence || []).map((e) => `<p>${e.passed ? "✓ Passed" : "! Needs work"} · <code>${esc(e.command)}</code></p>`).join("")}${safeLink(t.pr)}</div></details></article>`;
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
  return `<section class="panel allocation-panel"><div class="allocation-heading"><div><p class="eyebrow">YOU SET THE DIRECTION</p><h2>Where should the time go?</h2><p>Choose each project’s share of available work time. Set 0% to park a project.</p></div><div class="allocation-total"><strong id="allocation-total">${Object.values(allocationDraft).reduce((a, b) => a + b, 0)}%</strong><span>of work time</span></div></div><div class="allocation-strip" aria-hidden="true">${state.projects.map((p, i) => `<i data-share-bar="${esc(p.id)}" style="width:${allocationDraft[p.id]}%;background:${colors[i % colors.length]}"></i>`).join("")}</div><form id="allocation-form"><div class="allocation-rows">${state.projects.map((p, i) => `<div class="allocation-row" style="--project-color:${colors[i % colors.length]}"><span class="allocation-dot"></span><label for="allocation-${esc(p.id)}">${esc(p.name)}<small>${esc(p.description)}</small></label><input aria-label="${esc(p.name)} time slider" data-share="${esc(p.id)}" type="range" min="0" max="100" step="1" value="${allocationDraft[p.id]}"><div class="percentage-input"><input id="allocation-${esc(p.id)}" aria-label="${esc(p.name)} percentage" data-share="${esc(p.id)}" type="number" min="0" max="100" step="1" required value="${allocationDraft[p.id]}"><span>%</span></div></div>`).join("")}</div><div class="allocation-actions"><div><button type="submit" id="allocation-save" ${allocationBusy ? "disabled" : ""}>${allocationBusy ? "Saving…" : "Save time split"}</button><button type="button" class="secondary" id="allocation-suggested">Suggested balance</button><button type="button" class="text" id="allocation-equal">Split equally</button><button type="button" class="text" id="allocation-reset">Reset changes</button></div><p id="allocation-message" aria-live="polite">Total must be 100%. Your changes apply after saving.</p></div></form><p class="allocation-footnote">This sets a long-term share, rather than fixed hours. If a project is stuck or has no ready work, the worker can spend that time on other eligible projects. Approved tasks and stated plans guide implementation; otherwise it researches ideas.</p></section>`;
}
function timeSplitPage() {
  return `<div class="page-intro"><p>Set your priorities without managing every task.</p></div>${allocationPanel()}<section class="allocation-advice"><span class="eyebrow">MY RECOMMENDATION</span><h2>Keep the products at the center.</h2><p>Try 80% across the three apps and 20% across company and BCC improvements. That keeps internal improvements useful without letting them take over.</p><p><b>Suggested balance:</b> Sikhi Khoj 30% · Drivenix 25% · Reflex Trainer 25% · Company 10% · BCC 10%.</p><small>The preset fills the controls. Nothing changes until you save.</small></section>`;
}
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
      return `<article class="project p${i}"><div class="project-top"><span class="monogram">${esc(p.short || p.name.slice(0, 2))}</span>${badge(status, !p.enabled || !p.weight ? "paused" : s.active.length ? "running" : s.issues.length ? "blocked" : "ready")}</div><h3>${esc(p.name)}</h3><p class="project-description">${esc(p.description)}</p><div class="project-snapshot"><span class="fact-label">Latest progress</span><p>${esc(latest ? ownerView(latest).done : "No progress update recorded yet.")}</p><span class="fact-label">Coming next</span><p>${esc(p.nextPlan || u?.next || "Research ideas and prepare a plan before starting product changes.")}</p></div><div class="saved-share"><span>Time share</span><strong>${shares[p.id]}%</strong><i style="width:${shares[p.id]}%"></i></div><div class="project-counts"><span><b>${s.open.length}</b> open work items</span><span><b>${s.questions.length}</b> questions for you</span></div><div class="project-footer"><small>${latest ? "Updated " + esc(when(stamp(latest))) : "Awaiting first update"}</small><button class="text" data-project="${esc(p.id)}">See work →</button></div></article>`;
    })
    .join("")}</div>`;
}
function today() {
  const s = studioSummary(state),
    w = workerView(state),
    upcoming = s.active[0] || s.planned[0];
  return `<section class="hero"><div><span class="eyebrow">YOUR DAILY STUDIO BRIEF</span><h2>Good ideas.<br>Thoughtful progress.</h2><p>Your games, your company, your next move.</p></div><div class="live-card"><span class="live-indicator ${esc(w.tone)}"></span><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p><small>Last check-in · ${esc(when(state.worker.lastSeen))}</small></div></section><div class="stats"><article><small>Updates today</small><strong>${s.today.length}</strong><span>Latest progress below</span></article><article><small>Total open work</small><strong>${s.open.length}</strong><span class="work-breakdown">${s.active.length} underway · ${s.planned.length} planned<br>${s.checking.length} in checks · ${s.issues.length} waiting on fixes</span></article><article class="attention-stat"><small>Questions for you</small><strong>${s.questions.length}</strong><button class="text" data-page="Your help">${s.questions.length ? "See what I need →" : "You’re all caught up →"}</button></article><article><small>Evening report</small><strong>10 PM</strong><span>Every day · India time</span></article></div><div class="brief-grid"><section class="brief"><span class="step-number">01</span><h2>Completed today</h2>${
    s.completed.length
      ? `<ul class="brief-list">${s.completed
          .slice(0, 3)
          .map(
            (t) =>
              `<li><b>${esc(names(t.projectId))}</b><span>${esc(ownerView(t).done)}</span><small>${esc(when(stamp(t)))}</small></li>`,
          )
          .join("")}</ul>`
      : "<p>No completed result recorded today yet. In-progress work stays in the work board.</p>"
  }<h2>Ready for review today</h2><small>I handle the review. These results are not completed yet.</small>${
    s.readyForReview.length
      ? `<ul class="brief-list">${s.readyForReview
          .slice(0, 3)
          .map((t) => `<li><b>${esc(names(t.projectId))}</b><span>${esc(ownerView(t).done)}</span><small>${esc(when(stamp(t)))}</small></li>`)
          .join("")}</ul>`
      : "<p>No results ready for review today.</p>"
  }</section><section class="brief"><span class="step-number">02</span><h2>What got in the way</h2>${
    s.issues.length
      ? `<ul class="brief-list">${s.issues
          .slice(0, 3)
          .map(
            (t) =>
              `<li><b>${esc(names(t.projectId))}</b><span>${esc(ownerView(t).issue)}</span></li>`,
          )
          .join("")}</ul>`
      : "<p>No unresolved task issues recorded.</p>"
  }<button class="text" data-page="Work board">See how I’m handling it →</button></section><section class="brief"><span class="step-number">03</span><h2>What happens next</h2><p>${esc(upcoming ? names(upcoming.projectId) + ": " + ownerView(upcoming).next : "I’ll finish pending reviews and investigate issues. When no agreed task remains, I’ll research ideas and propose a plan before changing the product.")}</p><small>Product work follows your task or a stated plan. Otherwise, the focus is ideas and research.</small></section></div><div class="section-title"><div><p class="eyebrow">AT A GLANCE</p><h2>Your projects</h2></div><button class="text" data-page="Projects">Explore projects →</button></div>${projects()}<section class="panel help-panel"><div class="section-title"><div><p class="eyebrow">ONLY WHEN YOU’RE NEEDED</p><h2>Your help</h2></div>${badge(s.questions.length + " questions", s.questions.length ? "blocked" : "ready")}</div>${questionCards()}</section><div class="section-title"><div><p class="eyebrow">MOST RECENT FIRST</p><h2>Latest updates</h2></div><button class="text" data-page="Work board">All work →</button></div><div class="work-grid">${recentFirst(state.tasks).slice(0, 3).map(taskCard).join("") || empty("A fresh start", "Agreed work and research plans will appear here.")}</div>`;
}
function workBoard() {
  const rows = recentFirst(state.tasks).filter(
    (t) =>
      (projectFilter === "all" || t.projectId === projectFilter) &&
      (statusFilter === "all" || t.status === statusFilter),
  );
  return `<div class="page-intro"><p>This is my work queue. You only need to act on items in <button class="text" data-page="Your help">Your help</button>. Discuss new tasks and feedback in our chat.</p></div><div class="filter-bar"><label>Project<select id="project-filter"><option value="all">All projects</option>${state.projects.map((p) => `<option value="${esc(p.id)}" ${p.id === projectFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Progress<select id="status-filter"><option value="all">All progress</option>${Object.entries(
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
function reports() {
  const rows = state.reports
    .filter((r) => reportVisible(r))
    .sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="page-intro"><p>A daily record of results, issues and next steps. Published at 10 PM IST; kept for 30 days.</p></div>${rows.map((r, i) => `<article class="panel report"><div class="section-title"><div><span class="eyebrow">${i === 0 ? "LATEST REPORT" : "DAILY REPORT"}</span><h2>${esc(r.date)}</h2></div><time>${esc(when(r.createdAt))}</time></div>${r.sections?.length ? `<div class="report-sections">${r.sections.map((s) => `<section><h3>${esc(s.heading)}</h3><ul>${s.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>`).join("")}</div>` : "<p>This earlier report was saved in the previous format. Its full record is below.</p>"}<details class="technical"><summary>Full report & supporting notes</summary><pre>${esc(r.body)}</pre></details></article>`).join("") || empty("The evening report is on its way", "The Today page shows live progress while you wait for the 10 PM report.")}`;
}
function settings() {
  const w = workerView(state);
  return `<div class="settings-grid"><section class="panel"><h2>Work controls</h2>${badge(w.title, w.tone)}<p>${esc(w.detail)}</p><button id="worker-toggle">${state.settings.workerEnabled ? "Pause work" : "Resume work"}</button><p class="muted">Last check-in · ${esc(when(state.worker.lastSeen))}</p></section><section class="panel"><h2>Plan usage</h2><strong class="usage">${state.worker.quota == null ? "Not available" : esc(state.worker.quota) + "%"}</strong><p>Used in the busiest reported account window. This is shared with your other Codex work.</p><div class="notice">The worker waits when your plan limit is reached. No extra credits are purchased.</div></section><section class="panel"><h2>The daily rhythm</h2><div class="timeline"><div><b>10 PM</b><span>Daily report<small>Results, issues and the next plan</small></span></div><div><b>11 PM</b><span>Rest hour begins<small>Progress is saved</small></span></div><div><b>12 AM</b><span>Work can resume<small>Laptop awake, online and within plan limits</small></span></div></div></section><section class="panel"><h2>How we work</h2><ul><li>Discuss tasks and feedback in chat.</li><li>I handle checks, reviews and merging.</li><li>You publish to the Play Store and App Store.</li><li>No task or plan? Research ideas first.</li><li>Sikhi Khoj website updates are grouped weekly.</li></ul></section></div>`;
}
function render() {
  const gated = mode === "firebase" && (!auth || auth.denied || auth.error),
    s = studioSummary(state),
    nav = [
      ["Today", "◈"],
      ["Projects", "▦"],
      ["Time split", "◷"],
      ["Work board", "☷"],
      ["Your help", "?"],
      ["Reports", "▤"],
      ["Settings", "⚙"],
    ];
  root.innerHTML = `<aside class="${menu ? "open" : ""}"><a class="brand" href="#" data-page="Today"><span>BF</span><div>BRAINFORGE<small>COMMAND CENTER</small></div></a><small class="nav-label">YOUR STUDIO</small><nav aria-label="Main navigation">${nav.map(([label, icon]) => `<button data-page="${label}" class="${page === label ? "active" : ""}" ${page === label ? 'aria-current="page"' : ""}><span>${icon}</span>${label}${label === "Your help" && s.questions.length ? `<b class="nav-count">${s.questions.length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-foot"><span class="dot"></span> Thoughtful progress<small>Quality over speed. Always.</small></div></aside>${menu ? '<button class="nav-backdrop" id="close-menu" aria-label="Close navigation"></button>' : ""}<div class="workspace"><header><button id="menu" class="menu" aria-label="Toggle navigation" aria-expanded="${menu}">☰</button><span>Studio <b>/ ${esc(page)}</b></span><div>${badge(mode === "demo" ? "Preview" : "Private workspace")}<button id="auth">${mode === "demo" ? "Demo" : auth ? "Sign out" : "Sign in"}</button></div></header><main><div class="page-heading"><div><p class="eyebrow">BRAINFORGE COMMAND CENTER</p><h1 class="${page === "Today" ? "studio-wordmark" : ""}">${page === "Today" ? "Brainforge <span>Games</span><i></i>" : esc(page)}</h1></div><span class="muted">${esc(when(Date.now()))}</span></div>${mode === "demo" ? '<div class="demo-banner">Design preview · Sample data only. Your live workspace is separate.</div>' : ""}${gated ? `<section class="panel sign-in"><span class="monogram">BF</span><h2>Your studio, privately.</h2><p>${esc(auth?.error || "Sign in with your Brainforge admin Google account to see progress and plans.")}</p><button id="login">Sign in with Google</button></section>` : ({ Today: today, Projects: projectsPage, "Time split": timeSplitPage, "Work board": workBoard, "Your help": () => `<div class="page-intro"><p>Only decisions, access or information I actually need from you. Reply in our chat; I’ll keep this page updated.</p></div>${questionCards()}`, Reports: reports, Settings: settings }[page] || today)()}</main><footer>Brainforge Games <span>Clear plans. Thoughtful progress.</span></footer></div><div id="toast" role="status"></div>`;
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
  if (page === "Time split") allocationInputs();
  document.querySelectorAll("[data-page]").forEach(
    (el) =>
      (el.onclick = (e) => {
        e.preventDefault();
        page = el.dataset.page;
        menu = false;
        render();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelectorAll("[data-project]").forEach(
    (el) =>
      (el.onclick = () => {
        projectFilter = el.dataset.project;
        statusFilter = "all";
        page = "Work board";
        render();
        window.scrollTo(0, 0);
      }),
  );
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
    const open = [...document.querySelectorAll("details[open]")].map((el) =>
      [...document.querySelectorAll("details")].indexOf(el),
    );
    if (document.activeElement?.matches("select,input,textarea")) return;
    render();
    open.forEach((i) => {
      const el = document.querySelectorAll("details")[i];
      if (el) el.open = true;
    });
  },
  (u) => {
    auth = u;
    render();
  },
).catch((e) => toast(e.message));
