import { studioSummary, recentFirst } from "./presentation.js";

// Keep sentences intact: decimals, version numbers and URLs are not delimiters.
export function readableBullets(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/\n+/);
  return entries.flatMap((line) => String(line).replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim().split(/(?<=[.!?])\s+(?=[A-Z])/)).filter(Boolean);
}

export function workRows(state, view = "all", project = "all", status = "all", now = Date.now()) {
  const summary = studioSummary(state, now);
  const rows = view === "today" ? summary.today : view === "open" ? summary.open : state.tasks;
  return recentFirst(rows).filter((t) => (project === "all" || t.projectId === project) && (status === "all" || t.status === status));
}

export function noteSections(value) {
  const groups = [];
  let group = { heading: "Notes", items: [] };
  for (const line of String(value || "").split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      if (group.items.length) groups.push(group);
      group = { heading: heading[1], items: [] };
    } else if (line.trim()) group.items.push(...readableBullets(line));
  }
  if (group.items.length) groups.push(group);
  return groups;
}

export function reportEntry(value) {
  const raw = String(value || ""), parts = raw.split(/\s+·\s+(?=\d{1,2}\s+[A-Za-z]{3},)/);
  const body = parts[0], prefix = body.match(/^([^:]{1,48}):\s+(.*)$/s);
  return { project: prefix?.[1] || "Studio update", items: readableBullets(prefix?.[2] || body), time: parts.slice(1).join(" · ") };
}
