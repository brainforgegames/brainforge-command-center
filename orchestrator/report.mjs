import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "./database.mjs";
import { istParts, makeReport } from "./policy.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(root, "worker.config.json"), "utf8"),
);
const db = database(config.firebaseProjectId, config.credentialMode);
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
const now = istParts();
if (now.hour >= 22) {
  const ref = db.doc("reports/" + now.date);
  if (!(await ref.get()).exists) {
    const state = {
      tasks: (await db.collection("tasks").get()).docs.map((d) => d.data()),
      worker: (await db.doc("worker/status").get()).data(),
    };
    try {
      await ref.create(makeReport(state, now.date));
      console.log("Daily report published.");
    } catch (e) {
      if (e.code !== 6) throw e;
    }
  }
}
