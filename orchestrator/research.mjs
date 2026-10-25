import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
export async function ensureResearchTask(ref, data) {
  // Existing create-only writes stall in the current REST client on HTTP 409.
  // The single-laptop worker lock serializes creation; check before submitting.
  if ((await ref.get()).exists) return false;
  await ref.create(data);
  return true;
}
export function researchPath(date, scope = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("Invalid research date.");
  if (scope && !/^[a-z][a-z0-9-]{0,60}$/.test(scope))
    throw Error("Invalid research scope.");
  return `bcc-research/${scope ? scope + "/" : ""}${date}.md`;
}
export const publishReview = (task, project, enabled) =>
  !!enabled && !(task.kind === "research" && project.privateResearch);
export function validateProjectTask(task, project) {
  if (project.researchOnly && task.kind !== "research")
    throw Error(
      "This project is for private strategy research. Product changes need a separate project task.",
    );
}
export function validateResearch(paths, body, allowed) {
  if (!paths.length || paths.some((p) => p !== allowed))
    throw Error(
      "Research may change only its dated research document, not application code.",
    );
  if (body.trim().split(/\s+/).length < 200)
    throw Error("Research needs a substantive evidence-based proposal.");
  for (const heading of ["Evidence", "Improvements", "Checks", "Blockers"])
    if (!new RegExp("^#{1,3} " + heading, "mi").test(body))
      throw Error("Research is missing " + heading + ".");
  if (
    /-----BEGIN .*PRIVATE KEY-----|(?:ghp_|glpat-)[A-Za-z0-9_-]{15,}|ya29\.[A-Za-z0-9_-]+/.test(
      body,
    )
  )
    throw Error(
      "Potential credential detected; research must not expose credentials.",
    );
  return true;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const allowed = researchPath(process.argv[2], process.argv[3] || "");
  const run = (args) => {
    const r = spawnSync("git", args, { encoding: "utf8", windowsHide: true });
    if (r.status !== 0) throw Error("Unable to inspect research changes.");
    return r.stdout.trim().split(/\r?\n/).filter(Boolean);
  };
  const paths = [
    ...new Set([
      ...run(["diff", "--name-only"]),
      ...run(["diff", "--cached", "--name-only"]),
      ...run(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ];
  validateResearch(paths, await readFile(allowed, "utf8"), allowed);
  console.log(
    "Research scope, required evidence sections and credential checks passed.",
  );
}
