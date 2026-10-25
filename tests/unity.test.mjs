import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import { copyUnitySource, prepareUnity, projectVersion, requireEditorVersion, unityCopyRoot } from "../orchestrator/unity.mjs";

test("Unity versions require an exact release including patch and suffix", () => {
  assert.equal(projectVersion("m_EditorVersion: 6000.0.66f2\r\nm_EditorVersionWithRevision: ignored\r\n"), "6000.0.66f2");
  for (const text of ["", "m_EditorVersion: latest", "m_EditorVersion: 6000.0.66f2\nm_EditorVersion: 6000.0.66f2"])
    assert.throws(() => projectVersion(text));
  requireEditorVersion("6000.0.66f2", "6000.0.66f2\r\n");
  for (const actual of ["6000.0.66f1", "6000.3.26f1", "6000.0.66f2-extra", ""])
    assert.throws(() => requireEditorVersion("6000.0.66f2", actual));
});

test("isolated import preserves dirty source, binary importer metadata and untracked files", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bcc-unity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  for (const dir of ["Assets", "ProjectSettings", "Packages", "Library", ".git", "Logs"])
    await mkdir(path.join(source, dir), { recursive: true });
  const files = {
    "Assets/Dirty.cs": Buffer.from("// pre-existing edit\r\n"),
    "Assets/Dirty.cs.meta": Buffer.from([0, 255, 13, 10, 42]),
    "Assets/untracked.txt": Buffer.from("keep me"),
    "ProjectSettings/ProjectVersion.txt": Buffer.from("m_EditorVersion: 6000.0.66f2\n"),
    "Packages/manifest.json": Buffer.from('{"dependencies":{}}'),
  };
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(source, name), content);
  await writeFile(path.join(source, "Library/stale"), "stale");
  let calls = 0;
  const result = await prepareUnity({ source, config: { editor: path.resolve("Unity.exe"), copyRoot: path.join(root, "copies") }, local: path.join(root, "logs"), run: async (exe, args, cwd, opts) => {
    assert.ok(opts.timeout <= 900000);
    calls++;
    if (args[0] === "-version") return { code: 0, out: "6000.0.66f2\n" };
    assert.notEqual(cwd, source);
    assert.equal(path.dirname(cwd), path.join(root, "copies"));
    assert.ok(!args.at(-1).startsWith(cwd + path.sep));
    assert.ok(args.includes("-batchmode") && args.includes("-quit"));
    assert.deepEqual((await readdir(cwd)).sort(), ["Assets", "Packages", "ProjectSettings"]);
    await writeFile(path.join(cwd, "Assets/Dirty.cs"), "import mutation");
    await writeFile(path.join(cwd, "Assets/Dirty.cs.meta"), "import metadata");
    await writeFile(args[args.indexOf("-logFile") + 1], "Import completed");
    return { code: 0 };
  } });
  assert.equal(calls, 2);
  await writeFile(path.join(root, "copies", "keep.txt"), "other attempt");
  await result.dispose();
  await result.dispose();
  assert.equal(await readFile(path.join(root, "copies", "keep.txt"), "utf8"), "other attempt");
  for (const [name, content] of Object.entries(files)) assert.deepEqual(await readFile(path.join(source, name)), content);
  await assert.rejects(readFile(path.join(result.work, "Assets/Dirty.cs")), { code: "ENOENT" });
  assert.equal(await readFile(result.log, "utf8"), "Import completed");
});

test("version mismatch never imports and a zero-exit compilation failure blocks", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bcc-unity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "source/ProjectSettings"), { recursive: true });
  const source = path.join(root, "source");
  await writeFile(path.join(source, "ProjectSettings/ProjectVersion.txt"), "m_EditorVersion: 6000.0.66f2\n");
  let calls = 0;
  const options = { source, config: { editor: path.resolve("Unity.exe"), copyRoot: path.join(root, "copies") }, local: path.join(root, "logs") };
  await assert.rejects(prepareUnity({ ...options, run: async () => { calls++; return { code: 0, out: "6000.3.26f1" }; } }), /mismatch/);
  assert.equal(calls, 1);
  await assert.rejects(prepareUnity({ ...options, run: async (exe, args) => {
    if (args[0] === "-version") return { code: 0, out: "6000.0.66f2" };
    await writeFile(args.at(-1), "error CS1002: ; expected");
    return { code: 0 };
  } }), /compilation failed/);
  const folder = (await readdir(options.local))[0];
  assert.deepEqual(await readdir(path.join(options.local, folder)), ["editor.log"]);
  assert.deepEqual(await readdir(options.config.copyRoot), []);
  assert.equal(await readFile(path.join(source, "ProjectSettings/ProjectVersion.txt"), "utf8"), "m_EditorVersion: 6000.0.66f2\n");
});

test("copy guard refuses nested destinations and linked source trees", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bcc-unity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  await mkdir(source);
  await assert.rejects(copyUnitySource(source, path.join(source, "copy")), /outside/);
  await assert.rejects(copyUnitySource(source, source), /outside/);
  await mkdir(path.join(root, "outside"));
  await writeFile(path.join(root, "outside/keep"), "unchanged");
  await symlink(path.join(root, "outside"), path.join(source, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(copyUnitySource(source, path.join(root, "copy")), /symbolic links/);
  assert.equal(await readFile(path.join(root, "outside/keep"), "utf8"), "unchanged");
});


test("Unity copy roots are portable, short and require absolute overrides", () => {
  assert.equal(unityCopyRoot({ platform: "win32", env: { LOCALAPPDATA: "D:\\Local" } }), "D:\\Local\\bcc\\u");
  assert.equal(unityCopyRoot({ platform: "win32", env: {}, home: "C:\\Users\\Editor" }), "C:\\Users\\Editor\\AppData\\Local\\bcc\\u");
  assert.equal(unityCopyRoot({ platform: "linux", temp: "/tmp" }), "/tmp/bcc/u");
  assert.equal(unityCopyRoot({ platform: "win32", configured: "D:\\u" }), "D:\\u");
  for (const configured of ["relative", "C:relative", "\\rooted", 42, null])
    assert.throws(() => unityCopyRoot({ platform: "win32", configured }), /absolute/);
});

test("unsafe copy roots preserve source and existing logs before import", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bcc-unity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source"), local = path.join(root, "logs");
  await mkdir(path.join(source, "ProjectSettings"), { recursive: true });
  await mkdir(local);
  await writeFile(path.join(source, "ProjectSettings/ProjectVersion.txt"), "m_EditorVersion: 6000.0.66f2\n");
  await writeFile(path.join(local, "keep.log"), "retain");
  for (const copyRoot of [source, path.join(source, "copies"), local, path.join(local, "copies"), root]) {
    await assert.rejects(prepareUnity({ source, local, config: { editor: path.resolve("Unity.exe"), copyRoot }, run: async (exe, args) => {
      assert.deepEqual(args, ["-version"]);
      return { code: 0, out: "6000.0.66f2" };
    } }), /outside source/);
  }
  const alias = path.join(root, "alias");
  await symlink(local, alias, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(prepareUnity({ source, local, config: { editor: path.resolve("Unity.exe"), copyRoot: alias }, run: async () => ({ code: 0, out: "6000.0.66f2" }) }), /outside source/);
  assert.equal(await readFile(path.join(local, "keep.log"), "utf8"), "retain");
  assert.equal(await readFile(path.join(source, "ProjectSettings/ProjectVersion.txt"), "utf8"), "m_EditorVersion: 6000.0.66f2\n");
});


test("example Node quality checks install locked dependencies first", async () => {
  const config = JSON.parse(await readFile(new URL("../orchestrator/worker.config.example.json", import.meta.url), "utf8"));
  for (const name of ["brainforge-company", "bcc-improvements"])
    assert.deepEqual(config.projects[name].checks, [["npm", "ci"], ["npm", "test"], ["npm", "run", "build"]]);
  assert.equal(config.enabled, false);
  assert.equal(config.projects["sikhi-khoj"].repositories.app.unity.editor, "");
});
