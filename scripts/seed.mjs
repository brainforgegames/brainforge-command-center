import { initialState } from "../src/domain.js";
import { database } from "../orchestrator/database.mjs";
const project = process.env.BCC_FIREBASE_PROJECT_ID,
  uid = process.env.BCC_ADMIN_UID;
if (!project || !uid)
  throw Error("Set BCC_FIREBASE_PROJECT_ID and BCC_ADMIN_UID locally.");
const db = database(project, process.env.BCC_CREDENTIAL_MODE),
  state = initialState();
// Create-only prevents re-running setup from resetting instructions, weights or admin ownership.
for (const p of state.projects) {
  try {
    await db.doc("projects/" + p.id).create(p);
  } catch (e) {
    if (e.code !== 6) throw e;
  }
}
for (const [ref, data] of [
  ["config/admin", { uid }],
  ["settings/global", state.settings],
  ["worker/status", state.worker],
]) {
  try {
    await db.doc(ref).create(data);
  } catch (e) {
    if (e.code !== 6) throw e;
  }
}
console.log("Workspace initialized without replacing existing data.");
