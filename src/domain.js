export const PROJECTS = [
  {
    id: "sikhi-khoj",
    name: "Sikhi Khoj",
    short: "SK",
    description: "Discovery, learning & connection",
    weight: 1,
    enabled: true,
    instructions: "",
  },
  {
    id: "drivenix",
    name: "Drivenix",
    short: "DX",
    description: "Build the next driving experience",
    weight: 1,
    enabled: true,
    instructions: "",
  },
  {
    id: "reflex-trainer",
    name: "Reflex Trainer",
    short: "RT",
    description: "Sharper reactions, every day",
    weight: 1,
    enabled: true,
    instructions: "",
  },
];
export const QUALITY =
  "Prioritize quality and correctness over speed. Consider edge cases, accessibility, security, and the user experience. Run relevant checks, document evidence, use branches and PRs, and handle review and merging. Only Play Store and App Store publishing remain with the user. Work on a user task or stated plan; otherwise research ideas and propose a plan before product changes. If blocked, record the reason and continue another eligible task. Ask the owner only for specific decisions, information or access. Never purchase credits or use API-key billing.";
export const TARGETS = {
  "sikhi-khoj": [
    { id: "app", name: "Unity app", repository: "brainforgegames/Sikhi_Khoj" },
    {
      id: "website",
      name: "Website",
      repository: "brainforgegames/sikhi-khoj-app",
    },
  ],
  drivenix: [{ id: "app", name: "App" }],
  "reflex-trainer": [{ id: "app", name: "App" }],
};
export const targetName = (task) =>
  TARGETS[task.projectId]?.find((t) => t.id === (task.target || "app"))?.name ||
  "App";
export function initialState() {
  return {
    projects: structuredClone(PROJECTS),
    tasks: [],
    feedback: [],
    reports: [],
    settings: { instructions: QUALITY, workerEnabled: false },
    worker: { status: "Not connected", lastSeen: null, quota: null },
  };
}
export function istParts(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}
export const isPaused = (now) => istParts(now).hour === 23;
export const reportDue = (now, lastDate) =>
  istParts(now).hour >= 22 && istParts(now).date !== lastDate;
export const reportVisible = (r, now = Date.now()) => Number(r.expiresAt) > now;
export function selectTask(projects, tasks, served = {}) {
  const eligible = projects.filter(
    (p) =>
      p.enabled &&
      Number.isFinite(p.weight) &&
      p.weight > 0 &&
      tasks.some(
        (t) =>
          t.projectId === p.id && t.status === "queued" && t.approved === true,
      ),
  );
  eligible.sort(
    (a, b) =>
      (served[a.id] || 0) / a.weight - (served[b.id] || 0) / b.weight ||
      a.id.localeCompare(b.id),
  );
  const p = eligible[0];
  return p
    ? tasks
        .filter(
          (t) =>
            t.projectId === p.id &&
            t.status === "queued" &&
            t.approved === true,
        )
        .sort(
          (a, b) =>
            b.priority - a.priority ||
            (served[`${p.id}:${a.target || "app"}`] || 0) -
              (served[`${p.id}:${b.target || "app"}`] || 0) ||
            a.createdAt - b.createdAt,
        )[0]
    : null;
}
export function validateTask(t) {
  if (!t.title?.trim() || t.title.length > 180)
    throw Error("Use a task title between 1 and 180 characters.");
  if (!PROJECTS.some((p) => p.id === t.projectId))
    throw Error("Choose a project.");
  t.target ||= "app";
  if (!TARGETS[t.projectId].some((target) => target.id === t.target))
    throw Error("Choose a valid app or website target.");
  if (!t.acceptance?.trim() || t.acceptance.length > 12000)
    throw Error(
      "Add acceptance criteria (up to 12,000 characters) before queuing work.",
    );
  return t;
}
export const STATUSES = ["queued", "running", "review", "blocked", "done"];
