import path from "node:path";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

export function projectVersion(text) {
  const matches = [...text.matchAll(/^m_EditorVersion: ([0-9]+\.[0-9]+\.[0-9]+[abfp][0-9]+)\r?$/gm)];
  if (matches.length !== 1) throw Error("Unity ProjectVersion.txt must specify one exact editor version.");
  return matches[0][1];
}

export function requireEditorVersion(expected, output) {
  if (output.trim() !== expected)
    throw Error(`Unity editor version mismatch: required ${expected}, received ${output.trim()}. No upgrade attempted.`);
}

// Always copy, including dirty/untracked source and .meta files. Never import in the
// task checkout or restore files over a contributor's changes after an import.
export async function copyUnitySource(source, destination) {
  source = path.resolve(source);
  destination = path.resolve(destination);
  const relative = path.relative(source, destination);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
    throw Error("Unity verification copy must be outside the source checkout.");
  const excluded = new Set([".git", "Library", "Temp", "Logs", "obj", ".local", "node_modules"]);
  async function copy(entry, target) {
    const info = await lstat(entry);
    if (info.isSymbolicLink()) throw Error("Unity verification refuses symbolic links; source preserved.");
    if (info.isDirectory()) {
      await mkdir(target, { recursive: true });
      for (const name of await readdir(entry)) {
        if (entry === source && excluded.has(name)) continue;
        await copy(path.join(entry, name), path.join(target, name));
      }
    } else if (info.isFile()) {
      await pipeline(createReadStream(entry), createWriteStream(target, { flags: "wx" }));
    } else throw Error("Unity verification refuses special files; source preserved.");
  }
  await copy(source, destination);
}

export async function prepareUnity({ source, config, local, run }) {
  if (!config || !path.isAbsolute(config.editor || ""))
    throw Error("Unity verification requires an absolute installed editor path.");
  const timeout = config.timeoutMs ?? 300000;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 900000)
    throw Error("Unity timeoutMs must be between 1000 and 900000.");
  const expected = projectVersion(await readFile(path.join(source, "ProjectSettings", "ProjectVersion.txt"), "utf8"));
  const version = await run(config.editor, ["-version"], source, { timeout: 30000 });
  if (version.code !== 0 || version.stopped) throw Error("Unable to read installed Unity version.");
  requireEditorVersion(expected, version.out);
  await mkdir(local, { recursive: true });
  const folder = await mkdtemp(path.join(local, "unity-"));
  const work = path.join(folder, "project");
  const dispose = () => rm(work, { recursive: true, force: true });
  try {
    await copyUnitySource(source, work);
    const log = path.join(folder, "editor.log");
    const result = await run(config.editor, ["-batchmode", "-nographics", "-quit", "-projectPath", work, "-logFile", log], work, { timeout });
    if (result.code !== 0 || result.stopped) throw Error(`Unity import/compile failed; inspect ${log}.`);
    // Exit zero alone is insufficient for script compilation failures.
    const output = await readFile(log, "utf8");
    if (/error CS\d+|Scripts have compiler errors|Aborting batchmode due to failure/i.test(output))
      throw Error(`Unity compilation failed; inspect ${log}.`);
    return { work, dispose, version: expected, log };
  } catch (error) {
    await dispose();
    throw error;
  }
}
