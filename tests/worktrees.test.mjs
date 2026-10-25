import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  worktreeRoot,
  taskWorktreePath,
  prepareWorktree,
} from "../orchestrator/worktrees.mjs";

test("portable root selection and collision-resistant bounded task paths", () => {
  assert.equal(
    worktreeRoot({
      root: "C:\\deep\\bcc",
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Local" },
    }),
    "C:\\Local\\bcc\\w",
  );
  assert.equal(
    worktreeRoot({ root: "/bcc", platform: "linux" }),
    "/bcc/.local/worktrees",
  );
  assert.equal(
    worktreeRoot({ configured: "D:\\w", platform: "win32" }),
    "D:\\w",
  );
  for (const configured of ["relative", "C:relative", "\\rooted", 42])
    assert.throws(
      () => worktreeRoot({ configured, platform: "win32" }),
      /absolute/,
    );
  const a = taskWorktreePath("C:\\w", "repo-a", "../a!", "win32");
  assert.match(a, /^C:\\w\\[a-f0-9]{24}$/);
  assert.notEqual(a, taskWorktreePath("C:\\w", "repo-a", "a", "win32"));
  assert.notEqual(a, taskWorktreePath("C:\\w", "repo-b", "../a!", "win32"));
  assert.equal(taskWorktreePath("/w", "repo", "x".repeat(10000)).length, 27);
});

test("preparation scopes long paths and creates a new task without reset or deletion", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bcc-plan-"));
  try {
    for (const existingBranch of [false, true]) {
      const calls = [];
      const branch = `bcc/task-${existingBranch}`;
      const work = await prepareWorktree({
        repo: temp,
        taskId: branch,
        branch,
        baseBranch: "main",
        root: path.join(temp, "w"),
        local: temp,
        git: async (args) => {
          calls.push(args);
          if (args.includes("for-each-ref"))
            return existingBranch ? `refs/heads/${branch}\n` : "";
          return "";
        },
      });
      assert.deepEqual(calls.at(-1), [
        "-c",
        "core.longpaths=true",
        "worktree",
        "add",
        ...(existingBranch
          ? [work, branch]
          : ["-b", branch, work, "origin/main"]),
      ]);
      assert.ok(calls.every((args) => args[1] === "core.longpaths=true"));
      assert.equal(
        calls.some(
          (args) =>
            args.includes("reset") ||
            args.includes("remove") ||
            args.includes("prune"),
        ),
        false,
      );
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("registered and checkpoint worktrees take priority, including spaces and dirty files", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bcc-preserve-"));
  try {
    const work = path.join(temp, "old worktree");
    await mkdir(work);
    await writeFile(path.join(work, "edit.txt"), "user edit");
    const calls = [];
    const options = {
      repo: temp,
      taskId: "task",
      branch: "bcc/task",
      baseBranch: "main",
      root: path.join(temp, "new"),
      local: temp,
      git: async (args) => {
        calls.push(args);
        if (args.includes("list"))
          return `worktree ${work}\0HEAD abc\0branch refs/heads/bcc/task\0\0`;
        if (args.includes("symbolic-ref")) return "refs/heads/bcc/task\n";
        return "abc";
      },
    };
    assert.equal(await prepareWorktree(options), work);
    assert.equal(await prepareWorktree({ ...options, savedWork: work }), work);
    assert.equal(
      await readFile(path.join(work, "edit.txt"), "utf8"),
      "user edit",
    );
    assert.equal(
      calls.some((args) => args.includes("fetch") || args.includes("add")),
      false,
    );
    await assert.rejects(
      prepareWorktree({ ...options, savedWork: path.join(temp, "missing") }),
      /preserved/,
    );
    const partial = path.join(temp, "worktrees", "partial");
    await mkdir(partial, { recursive: true });
    await writeFile(path.join(partial, "edit.txt"), "preserve");
    await assert.rejects(
      prepareWorktree({ ...options, taskId: "partial", branch: "bcc/partial" }),
      /preserved/,
    );
    assert.equal(
      await readFile(path.join(partial, "edit.txt"), "utf8"),
      "preserve",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("real Git checkout supports long paths and preserves dirty worktrees across root changes", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bcc-wt-"));
  const git = async (args, cwd) =>
    execFileSync("git", ["-c", "core.longpaths=true", ...args], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    }).trimEnd();
  try {
    const repo = path.join(temp, "repo");
    await mkdir(repo);
    await git(["init", "-b", "main"], repo);
    await git(["config", "core.autocrlf", "false"], repo);
    const relative =
      Array(12).fill("long-directory-component").join("/") + "/file.txt";
    const file = path.join(repo, relative);
    assert.ok(file.length > 260);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "committed\n");
    await git(["-c", "core.longpaths=true", "add", "."], repo);
    await git(
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-m",
        "fixture",
      ],
      repo,
    );
    await git(["remote", "add", "origin", repo], repo);
    await writeFile(file, "source edit\n");
    const calls = [];
    const options = {
      repo,
      taskId: "task-1",
      branch: "bcc/task-1",
      baseBranch: "main",
      root: path.join(temp, "w"),
      local: path.join(temp, "local"),
      git: async (args, cwd) => {
        calls.push(args);
        return git(args, cwd);
      },
    };
    const work = await prepareWorktree(options);
    assert.equal(
      await readFile(path.join(work, relative), "utf8"),
      "committed\n",
    );
    await writeFile(path.join(work, relative), "task edit\n");
    await writeFile(path.join(work, "untracked.txt"), "keep\n");
    const changed = { ...options, root: path.join(temp, "new-root") };
    assert.equal(await prepareWorktree(changed), work);
    assert.equal(await prepareWorktree({ ...changed, savedWork: work }), work);
    assert.equal(await readFile(file, "utf8"), "source edit\n");
    assert.equal(
      await readFile(path.join(work, relative), "utf8"),
      "task edit\n",
    );
    assert.equal(
      await readFile(path.join(work, "untracked.txt"), "utf8"),
      "keep\n",
    );
    assert.ok(
      calls.every(
        (args) => args[0] === "-c" && args[1] === "core.longpaths=true",
      ),
    );
    await assert.rejects(
      prepareWorktree({ ...changed, savedWork: path.join(temp, "missing") }),
      /preserved/,
    );
    await git(["-C", work, "checkout", "-b", "user-branch"], repo);
    await assert.rejects(
      prepareWorktree({ ...changed, savedWork: work }),
      /preserved/,
    );
    // A failed/partial legacy checkout is never removed, reset or silently replaced.
    const legacy = path.join(options.local, "worktrees", "task-2");
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, "user.txt"), "keep");
    await assert.rejects(
      prepareWorktree({ ...options, taskId: "task-2", branch: "bcc/task-2" }),
      /preserved/,
    );
    assert.equal(await readFile(path.join(legacy, "user.txt"), "utf8"), "keep");
  } finally {
    // Only the unique disposable fixture created above is removed.
    await rm(temp, { recursive: true, force: true });
  }
});
