import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

export function worktreeRoot({
  root,
  configured,
  platform = process.platform,
  env = process.env,
}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (configured !== undefined && configured !== "") {
    if (
      typeof configured !== "string" ||
      !paths.isAbsolute(configured) ||
      (platform === "win32" &&
        !/^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(configured))
    )
      throw Error("worktreeRoot must be an absolute local path.");
    return paths.normalize(configured);
  }
  if (platform !== "win32") return paths.join(root, ".local", "worktrees");
  const base = env.LOCALAPPDATA || paths.join(os.homedir(), "AppData", "Local");
  return paths.join(base, "bcc", "w");
}

export function taskWorktreePath(
  root,
  repo,
  taskId,
  platform = process.platform,
) {
  if (typeof taskId !== "string" || !taskId) throw Error("Task ID is missing.");
  const paths = platform === "win32" ? path.win32 : path.posix;
  // Hash the full identity: sanitizing/truncating alone can collide across tasks/repos.
  const key = createHash("sha256")
    .update(repo)
    .update("\0")
    .update(taskId)
    .digest("hex")
    .slice(0, 24);
  return paths.join(root, key);
}

export async function prepareWorktree({
  repo,
  taskId,
  branch,
  baseBranch,
  root,
  local,
  savedWork,
  git,
}) {
  // Command-scoped only: no global, registry or repository configuration changes.
  const run = (args) => git(["-c", "core.longpaths=true", ...args], repo);
  const entries = (await run(["worktree", "list", "--porcelain", "-z"]))
    .split("\0\0")
    .filter(Boolean)
    .map((record) => {
      const fields = record.split("\0");
      return {
        work: fields.find((v) => v.startsWith("worktree "))?.slice(9),
        branch: fields.find((v) => v.startsWith("branch "))?.slice(7),
      };
    });
  const registered = entries.filter((e) => e.branch === `refs/heads/${branch}`);
  if (registered.length > 1)
    throw Error(
      "Task branch has multiple worktrees; inspect preserved folders.",
    );
  const legacyName = taskId.replace(/[^a-zA-Z0-9-]/g, "");
  const legacy = legacyName ? path.join(local, "worktrees", legacyName) : null;
  const work = path.resolve(
    savedWork ||
      registered[0]?.work ||
      (legacy && existsSync(legacy)
        ? legacy
        : taskWorktreePath(root, repo, taskId)),
  );
  if (savedWork || registered.length || existsSync(work)) {
    if (
      !existsSync(work) ||
      !entries.some(
        (e) =>
          path.resolve(e.work) === path.resolve(work) &&
          e.branch === `refs/heads/${branch}`,
      )
    )
      throw Error(
        "Existing task folder or checkpoint is not a registered task worktree; preserved for inspection.",
      );
    const actualBranch = await run([
      "-C",
      work,
      "symbolic-ref",
      "--quiet",
      "HEAD",
    ]);
    if (actualBranch.trim() !== `refs/heads/${branch}`)
      throw Error(
        "Existing task worktree branch changed; preserved for inspection.",
      );
    // Verify HEAD without changing its index or files; dirty files remain untouched.
    await run(["-C", work, "rev-parse", "--verify", "HEAD"]);
    return work;
  }
  await mkdir(path.dirname(work), { recursive: true });
  await run(["fetch", "origin", baseBranch]);
  const refs = await run([
    "for-each-ref",
    "--format=%(refname)",
    `refs/heads/${branch}`,
  ]);
  const exists = refs.split(/\r?\n/).includes(`refs/heads/${branch}`);
  await run(
    exists
      ? ["worktree", "add", work, branch]
      : ["worktree", "add", "-b", branch, work, `origin/${baseBranch}`],
  );
  return work;
}
