import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeDatabase } from "./runtime-database.mjs";
import { istParts, makeReport } from "./policy.mjs";
import { archiveCompletion } from './analytics.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = istParts();
// The Windows trigger runs every minute. Reports and their maintenance are daily,
// so never scan the entire task collection on each daytime invocation.
if (now.hour < 22) process.exit(0);
const marker = path.join(root, '.local', 'last-published-report.txt');
if ((await readFile(marker, 'utf8').catch(() => '')).trim() === now.date) process.exit(0);
const config = JSON.parse(
  await readFile(path.join(root, "worker.config.json"), "utf8"),
);
const db = runtimeDatabase(root,config);
const reportRef = db.doc('reports/' + now.date);
async function rememberPublished() {
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, now.date, 'utf8');
}
if ((await reportRef.get()).exists) {
  await rememberPublished();
  await db.terminate();
  process.exit(0);
}
// Archive explicit verified timestamps before report cleanup; daily buckets never expire.
const completed = await db.collection('tasks').where('status', '==', 'done').get();
for (const task of completed.docs) await archiveCompletion(db, { ...task.data(), id: task.id });
// Independent of the development lock and Codex quota: a long AI run cannot delay reports.
const expired = await db
  .collection("reports")
  .where("expiresAt", "<=", Date.now())
  .limit(400)
  .get();
if (!expired.empty) {
  const batch = db.batch();
  expired.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
if (now.hour >= 22) {
  const ref = db.doc("reports/" + now.date);
  if (!(await ref.get()).exists) {
    const state = {
      tasks: (await db.collection("tasks").get()).docs.map((d) => d.data()),
      worker: (await db.doc("worker/status").get()).data(),
      settings: (await db.doc("settings/global").get()).data(),
      projects: (await db.collection("projects").get()).docs.map((d) =>
        d.data(),
      ),
    };
    try {
      await ref.create(makeReport(state, now.date));
      await rememberPublished();
      console.log("Daily report published.");
    } catch (e) {
      if (e.code !== 6) throw e;
    }
  }
}
