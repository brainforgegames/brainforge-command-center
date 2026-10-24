import "./style.css";
import { boot, save, login, logout, mode } from "./store.js";
import {
  initialState,
  validateTask,
  STATUSES,
  istParts,
  reportVisible,
} from "./domain.js";
let state = initialState(),
  page = "Overview",
  auth = null,
  filter = "all",
  menu = false;
const root = document.querySelector("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const name = (id) => state.projects.find((p) => p.id === id)?.name || id;
const badge = (s) =>
  `<span class="badge ${esc(String(s).split(" ")[0])}">${esc(s)}</span>`;
const options = () =>
  state.projects
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("");
function taskRows(tasks) {
  return tasks.length
    ? tasks
        .map(
          (t) =>
            `<article class="task"><div><small>${esc(name(t.projectId))} · Priority ${t.priority}</small><h3>${esc(t.title)}</h3><p>${esc(t.acceptance)}</p>${t.blockedReason ? `<p class="warning">${esc(t.blockedReason)}</p>` : ""}</div><label><span class="sr">Task status</span><select data-status="${esc(t.id)}" ${t.status === "running" ? "disabled" : ""}>${STATUSES.filter(
              (s) => s !== "running" || t.status === "running",
            )
              .map(
                (s) =>
                  `<option ${s === t.status ? "selected" : ""}>${s}</option>`,
              )
              .join("")}</select></label></article>`,
        )
        .join("")
    : '<div class="empty"><span>↗</span><h3>A clear runway</h3><p>Add a task with acceptance criteria to begin.</p><button data-page="Tasks">Create your first task</button></div>';
}
function projects() {
  const total = state.projects
    .filter((p) => p.enabled)
    .reduce((s, p) => s + p.weight, 0);
  return `<div class="project-grid">${state.projects.map((p, i) => `<article class="project p${i}"><div class="project-top"><span class="monogram">${p.short}</span>${badge(p.enabled ? "ready" : "paused")}</div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="project-meta"><strong>${state.tasks.filter((t) => t.projectId === p.id && t.status !== "done").length}</strong> open tasks <span>${total && p.enabled ? Math.round((p.weight / total) * 100) : 0}% share</span></div><div class="bar"><i style="width:${total && p.enabled ? (p.weight / total) * 100 : 0}%"></i></div><button class="text" data-project="${p.id}">Manage project →</button></article>`).join("")}</div>`;
}
function overview() {
  const now = istParts();
  return `<div class="hero"><div><span class="eyebrow">YOUR STUDIO, IN FOCUS</span><h2>Make room for great work.</h2><p>Three projects. One place to keep things moving.</p><button data-page="Tasks">＋ Add a task</button></div><div class="orbit"><span>BF</span><i></i><b>QUALITY FIRST</b></div></div><div class="stats"><article><small>Active projects</small><strong>${state.projects.filter((p) => p.enabled).length}<span> / 3</span></strong></article><article><small>Ready for work</small><strong>${state.tasks.filter((t) => t.status === "queued").length}</strong></article><article><small>Needs your attention</small><strong>${state.tasks.filter((t) => ["blocked", "review"].includes(t.status)).length}</strong></article><article><small>Next daily report</small><strong>22:00<span> IST</span></strong></article></div><div class="section-title"><h2>Your projects</h2><button class="text" data-page="Projects">View all projects →</button></div>${projects()}<div class="two-col"><section class="panel"><div class="section-title"><h2>Work queue</h2>${badge("quality first")}</div>${taskRows(state.tasks.filter((t) => t.status !== "done").slice(0, 3))}</section><section class="panel"><h2>Studio rhythm</h2><div class="timeline"><div><b>22:00</b><span>Daily report<small>Progress, checks & decisions</small></span></div><div><b>23:00</b><span>Breathing space<small>All worker activity pauses</small></span></div><div><b>00:00</b><span>Ready to resume<small>Within your plan’s limits</small></span></div></div><p class="muted">Asia/Kolkata · ${now.date}</p></section></div>`;
}
function tasks() {
  return `<section class="panel"><h2>A task worth doing, done well.</h2><form id="task-form"><div class="form-row"><label>Project<select name="projectId">${options()}</select></label><label>Priority<select name="priority"><option value="1">Normal</option><option value="2">High</option><option value="3">Urgent</option></select></label></div><label>Task title<input name="title" required maxlength="180" placeholder="What should we improve?"></label><label>Acceptance criteria<textarea name="acceptance" maxlength="12000" required placeholder="What should be true when this is ready for review?"></textarea></label><button>Add approved task</button><p class="muted">Queued tasks are authorized for local work. Completion goes to review; releases stay with you.</p></form></section><div class="section-title"><h2>Task board</h2><label><span class="sr">Filter tasks</span><select id="task-filter"><option value="all">All projects</option>${options()}</select></label></div><section class="panel">${taskRows(state.tasks.filter((t) => filter === "all" || t.projectId === filter))}</section>`;
}
function feedback() {
  return `<section class="panel"><h2>From conversation to direction</h2><p class="muted">Discuss ideas in chat, then capture the agreed feedback here. Feedback becomes work only when you create an approved task.</p><form id="feedback-form"><label>Project<select name="projectId">${options()}</select></label><label>Feedback<textarea name="body" required maxlength="8000" placeholder="What worked, what needs changing, and why?"></textarea></label><label>Conversation or source link (optional)<input name="source" type="url" pattern="https?://.*" maxlength="2000" placeholder="https://…"></label><button>Save feedback</button></form></section><section class="panel"><h2>Feedback inbox</h2>${state.feedback.length ? state.feedback.map((f) => `<article class="task"><div><small>${esc(name(f.projectId))} · ${new Date(f.createdAt).toLocaleDateString()}</small><p>${esc(f.body)}</p>${/^https?:\/\//i.test(f.source) ? `<a href="${esc(f.source)}" rel="noopener noreferrer" target="_blank">Open conversation ↗</a>` : ""}</div>${badge("captured")}</article>`).join("") : '<div class="empty"><h3>Ready for your perspective</h3><p>Agreed feedback will appear here.</p></div>'}</section>`;
}
function instructions() {
  return `<section class="panel"><h2>How Brainforge works</h2><p class="muted">Global direction applies to every project. Project instructions add context.</p><form id="instructions-form"><label>Global instructions<textarea name="instructions" rows="7" maxlength="12000" required>${esc(state.settings.instructions)}</textarea></label><button>Save instructions</button></form></section>${state.projects.map((p) => `<section class="panel"><h2>${esc(p.name)}</h2><form data-project-form="${p.id}"><label>Scheduling weight<input name="weight" type="number" min="0" max="100" step="1" value="${p.weight}" required></label><label class="check"><input name="enabled" type="checkbox" ${p.enabled ? "checked" : ""}> Include in scheduling</label><label>Project instructions<textarea name="instructions" maxlength="12000">${esc(p.instructions)}</textarea></label><button>Save project</button></form></section>`).join("")}`;
}
function reports() {
  const rows = state.reports.filter((r) => reportVisible(r));
  return `<section class="panel"><h2>The daily picture</h2><p>Reports are prepared at 10 PM IST and retained for 30 days. Projects, tasks, and instructions stay.</p>${
    rows.length
      ? rows
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(
            (r) =>
              `<article class="report"><small>${esc(r.date)} · 22:00 IST</small><h3>${esc(r.title || "Daily studio report")}</h3><pre>${esc(r.body)}</pre></article>`,
          )
          .join("")
      : '<div class="empty"><h3>Your first report is ahead</h3><p>The connected local worker will publish progress, blockers and validation results here.</p></div>'
  }</section>`;
}
function settings() {
  return `<div class="two-col"><section class="panel"><h2>Worker connection</h2>${badge(state.worker.status)}<p>${state.worker.lastSeen ? "Last seen " + esc(new Date(state.worker.lastSeen).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })) + " IST" : "No local worker heartbeat received."}</p><p class="muted">${mode === "demo" ? "Demo controls do not start a worker." : "The local worker must also be configured and enabled on the laptop."}</p><button id="worker-toggle">${state.settings.workerEnabled ? "Pause scheduling" : "Allow scheduling"}</button><h3>Operating policy</h3><p>11 PM–midnight pause · skip blocked tasks · branches and PRs · user-controlled releases.</p></section><section class="panel"><h2>Usage & limits</h2><strong class="usage">${state.worker.quota == null ? "Unavailable" : esc(state.worker.quota) + "% used"}</strong><p>Account quota percentages require a supported quota source. Execution token counts are recorded separately in worker checkpoints.</p><div class="notice">No purchased credits. No API billing fallback.</div></section></div><section class="panel"><h2>Connection checklist</h2><ul><li>GitHub owner: brainforgegames</li><li>Firebase: ${mode === "demo" ? "pending setup" : "configured"}</li><li>Sikhi Khoj repository: awaiting mapping confirmation</li><li>Drivenix & Reflex Trainer: transfers pending</li><li>Worker activation: local setup required</li></ul></section>`;
}
function render() {
  const gated = mode === "firebase" && (!auth || auth.denied || auth.error);
  root.innerHTML = `<aside class="${menu ? "open" : ""}"><a class="brand" href="#"><span>BF</span><div>BRAINFORGE<small>COMMAND CENTER</small></div></a><small class="nav-label">WORKSPACE</small><nav>${["Overview", "Projects", "Tasks", "Feedback", "Instructions", "Reports", "Settings"].map((s, i) => `<button data-page="${s}" class="${page === s ? "active" : ""}"><span>${["◈", "▦", "☷", "◌", "≡", "▤", "⚙"][i]}</span>${s}</button>`).join("")}</nav><div class="sidebar-foot"><span class="dot"></span> Quality over speed<small>Built with intention.</small></div></aside><div class="workspace"><header><button id="menu" class="menu" aria-label="Toggle navigation" aria-expanded="${menu}">☰</button><span>Workspace <b>/ ${page}</b></span><div>${mode === "demo" ? badge("local demo") : badge("admin workspace")}<button id="auth">${mode === "demo" ? "Local only" : auth ? "Sign out" : "Sign in"}</button></div></header><main><div class="page-heading"><div><p class="eyebrow">BRAINFORGE COMMAND CENTER</p><h1>${page === "Overview" ? "Studio overview" : page}</h1></div><span class="muted">${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date())} · IST</span></div>${mode === "demo" ? '<div class="demo-banner">Local preview · Data stays in this browser. Firebase sync and the worker are not connected.</div>' : ""}${gated ? `<section class="panel empty"><h2>${auth?.error ? "Connection needs attention" : "Your studio, privately"}</h2><p>${esc(auth?.error || "Sign in with the authorized admin Google account to access workspace data.")}</p><button id="login">Sign in with Google</button></section>` : { Overview: overview, Projects: () => `<p class="muted">Weights are relative shares of worker time. All projects start equally weighted.</p>${projects()}<section class="panel"><h2>Keep every project moving</h2><p>Blocked projects yield to eligible work. Change weights and project direction in Instructions.</p><button data-page="Instructions">Edit scheduling & instructions</button></section>`, Tasks: tasks, Feedback: feedback, Instructions: instructions, Reports: reports, Settings: settings }[page]()}</main><footer>Brainforge Games <span>Thoughtful progress, every day.</span></footer></div><div id="toast" role="status"></div>`;
  bind();
}
function toast(message) {
  document.querySelector("#toast").textContent = message;
  setTimeout(() => {
    const t = document.querySelector("#toast");
    if (t) t.textContent = "";
  }, 5000);
}
async function act(fn) {
  try {
    await fn();
    toast("Saved successfully");
  } catch (e) {
    toast(e.message);
  }
}
function bind() {
  document.querySelectorAll("[data-page]").forEach(
    (el) =>
      (el.onclick = () => {
        page = el.dataset.page;
        menu = false;
        render();
      }),
  );
  document.querySelectorAll("[data-project]").forEach(
    (el) =>
      (el.onclick = () => {
        page = "Instructions";
        render();
        document
          .querySelector(`[data-project-form="${el.dataset.project}"]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }),
  );
  document.querySelector("#menu").onclick = () => {
    menu = !menu;
    render();
  };
  document.querySelector("#auth").onclick = () =>
    mode === "demo"
      ? toast("Firebase setup is pending. This preview stores data locally.")
      : act(() => (auth ? logout() : login()));
  document.querySelector("#login")?.addEventListener("click", () => act(login));
  document.querySelector("#task-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    void act(() =>
      save(
        "tasks",
        crypto.randomUUID(),
        validateTask({
          ...d,
          priority: Number(d.priority),
          status: "queued",
          approved: true,
          createdAt: Date.now(),
        }),
      ),
    );
  });
  document
    .querySelectorAll("[data-status]")
    .forEach(
      (el) =>
        (el.onchange = () =>
          act(() =>
            save("tasks", el.dataset.status, {
              status: el.value,
              updatedAt: Date.now(),
            }),
          )),
    );
  const f = document.querySelector("#task-filter");
  if (f) {
    f.value = filter;
    f.onchange = () => {
      filter = f.value;
      render();
    };
  }
  document.querySelector("#feedback-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    void act(() =>
      save("feedback", crypto.randomUUID(), { ...d, createdAt: Date.now() }),
    );
  });
  document
    .querySelector("#instructions-form")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      void act(() =>
        save("settings", "global", {
          instructions: new FormData(e.target).get("instructions"),
        }),
      );
    });
  document.querySelectorAll("[data-project-form]").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        const d = new FormData(form);
        void act(() =>
          save("projects", form.dataset.projectForm, {
            weight: Number(d.get("weight")),
            enabled: d.has("enabled"),
            instructions: d.get("instructions"),
          }),
        );
      }),
  );
  document
    .querySelector("#worker-toggle")
    ?.addEventListener("click", () =>
      act(() =>
        save("settings", "global", {
          workerEnabled: !state.settings.workerEnabled,
        }),
      ),
    );
}
render();
void boot(
  (s) => {
    state = s;
    render();
  },
  (u) => {
    auth = u;
    render();
  },
).catch((e) => toast(e.message));
