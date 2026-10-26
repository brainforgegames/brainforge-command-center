import { istParts } from "./domain.js";
import { taskResults } from "./report-results.js";
export const statusLabels = {
  queued: "Planned",
  running: "In progress",
  review: "Ready for review",
  blocked: "Issue to resolve",
  done: "Completed",
};
export const priorityProjects = (projects) => [...projects].sort((a,b) => {
  const active = p => p.enabled && Number(p.weight) > 0;
  return Number(active(b))-Number(active(a)) || Number(b.weight||0)-Number(a.weight||0) || String(a.name||a.id).localeCompare(String(b.name||b.id));
});
export const stamp = (t) => Number(t.updatedAt || t.createdAt || 0);
export const recentFirst = (tasks) =>
  [...tasks].sort((a, b) => stamp(b) - stamp(a));
export function when(value) {
  if (!value || !Number.isFinite(Number(value))) return "Time not recorded";
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(Number(value))) + " IST"
  );
}
export function ownerView(task) {
  const raw = task.ownerUpdate || {},
    u = { ...raw, ...(raw.brief || {}) },
    research = task.kind === "research";
  return {
    title:
      u.title || (research ? "Find the best next improvements" : task.title),
    done:
      task.status === "done"
        ? taskResults(task).completed.join("\n") || "No verified outcome recorded. See the original work notes."
        : u.done || (task.status === "review"
          ? "A first version is ready. I still need to finish my review."
          : task.status === "running"
            ? "Work is underway. No completed result recorded yet."
            : "No completed result yet."),
    issue:
      u.issue ||
      (task.status === "blocked"
        ? "A setup or checking issue interrupted this task. I will investigate it."
        : ""),
    next:
      u.next ||
      (task.status === "blocked"
        ? "Investigate the issue, then retry. Other ready work can continue."
        : task.status === "review"
          ? "Review the work and merge it if the checks pass."
          : research
            ? "Compare ideas and prepare an improvement plan. Product changes need a task or plan first."
            : task.status === "done"
              ? "Use this result to choose the next improvement."
              : "Carry out the agreed task and check the result."),
    question:
      u.needsOwner === true && u.question?.trim() ? u.question.trim() : "",
    answerHint:
      u.answerHint || "Reply in our chat. I will update the task here.",
  };
}
export function studioSummary(state, now = Date.now(), includeStudio = true) {
  const studio = state.settings?.studioUpdate;
  const tasks = recentFirst([
      ...state.tasks,
      ...(includeStudio && studio
        ? [
            {
              id: "studio-update",
              projectId: "studio",
              status: "update",
              updatedAt: studio.updatedAt,
              ownerUpdate: studio.ownerUpdate || studio,
            },
          ]
        : []),
    ]),
    today = tasks.filter(
      (t) =>
        stamp(t) &&
        istParts(new Date(stamp(t))).date === istParts(new Date(now)).date,
    );
  return {
    open: state.tasks.filter((t) => t.status !== "done"),
    checking: tasks.filter((t) => t.status === "review"),
    today,
    completed: today.filter((t) => taskResults(t).completed.length > 0),
    readyForReview: today.filter((t) => t.status === "review"),
    issues: tasks.filter((t) => t.status === "blocked"),
    questions: tasks
      .filter((t) => t.status !== "done" && ownerView(t).question)
      .concat(
        includeStudio && state.worker?.ownerQuestion
          ? [
              {
                id: "worker-signin",
                projectId: "studio",
                status: "blocked",
                updatedAt: state.worker.lastSeen,
                ownerUpdate: {
                  needsOwner: true,
                  question: state.worker.ownerQuestion,
                  answerHint:
                    "Complete the sign-in on the laptop. Do not paste passwords or tokens in chat.",
                },
              },
            ]
          : [],
      ),
    active: tasks.filter((t) => t.status === "running" && state.projects.some(p => p.id === t.projectId && p.enabled && p.weight > 0)),
    parked: tasks.filter((t) => t.status === "running" && !state.projects.some(p => p.id === t.projectId && p.enabled && p.weight > 0)),
    planned: tasks.filter((t) => t.status === "queued"),
  };
}
export function workerView(state, now = Date.now()) {
  const w = state.worker || {},
    stale = !w.lastSeen || now - w.lastSeen > 5 * 60000;
  if (!state.settings.workerEnabled)
    return {
      title: "Work is paused",
      detail: "Scheduling is paused. Saved progress is safe.",
      tone: "paused",
    };
  if (istParts(new Date(now)).hour === 23)
    return {
      title: "Daily rest hour",
      detail: "Work resumes after midnight, within the plan limits.",
      tone: "paused",
    };
  if (stale)
    return {
      title: "Waiting for laptop connection",
      detail:
        "The worker has not checked in recently. The laptop needs to be awake and online.",
      tone: "blocked",
    };
  if (w.ownerQuestion)
    return {
      title: "Your help is needed",
      detail: "Open Your help for the specific action needed to resume.",
      tone: "blocked",
    };
  if (w.nextAttemptAt > now)
    return {
      title: w.cooldownReason === "model-capacity" ? "Waiting for model availability" : "Waiting for usage to reset",
      detail:
        "Progress is saved. The worker will retry after " +
        when(w.nextAttemptAt) +
        ".",
      tone: "paused",
    };
  const freshWorkers = Object.values(w.workers || {}).filter(x => now-x.lastSeen < 5*60000);
  const activeWorkers = freshWorkers.filter(x => /^Working:/.test(x.status));
  if (activeWorkers.length) return {title: `${activeWorkers.length} ${activeWorkers.length === 1 ? "worker is" : "workers are"} making progress`, detail: "Independent project work, with one shared Unity testing slot.", tone:"running"};
  if (state.tasks.some((t) => t.status === "running" && state.projects?.some(p => p.id === t.projectId && p.enabled && p.weight > 0)))
    return {
      title: "Work is moving",
      detail: "The worker is carrying out an agreed task.",
      tone: "running",
    };
  return {
    title: "Ready for the next step",
    detail:
      "The worker checks the queue regularly and skips work that is stuck.",
    tone: "ready",
  };
}
