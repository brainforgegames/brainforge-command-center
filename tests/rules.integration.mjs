import { readFile } from "node:fs/promises";
import test, { before, after } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-bcc",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "config/admin"), { uid: "owner" });
    await setDoc(doc(db, "settings/global"), {
      instructions: "Quality first",
      workerEnabled: false,
    });
    await setDoc(doc(db, "projects/sikhi-khoj"), {
      name: "Sikhi Khoj",
      weight: 1,
      enabled: true,
      instructions: "",
    });
  });
});
after(async () => {
  await env.cleanup();
});
const task = {
  title: "Improve onboarding",
  acceptance: "Works on a phone",
  projectId: "sikhi-khoj",
  priority: 1,
  status: "queued",
  approved: true,
  createdAt: 1000,
};
test("anonymous and other signed-in accounts cannot read or write", async () => {
  for (const ctx of [
    env.unauthenticatedContext(),
    env.authenticatedContext("stranger"),
  ]) {
    const db = ctx.firestore();
    await assertFails(getDocs(collection(db, "tasks")));
    await assertFails(setDoc(doc(db, "tasks/nope"), task));
    await assertFails(getDoc(doc(db, "settings/global")));
  }
});
test("admin can manage approved tasks but cannot promote own identity or forge reports", async () => {
  const db = env.authenticatedContext("owner").firestore();
  await assertSucceeds(setDoc(doc(db, "tasks/approved"), task));
  await assertSucceeds(
    updateDoc(doc(db, "tasks/approved"), { status: "review", updatedAt: 2000 }),
  );
  await assertFails(setDoc(doc(db, "config/admin"), { uid: "stranger" }));
  await assertFails(setDoc(doc(db, "reports/fake"), { body: "fake" }));
  await assertFails(setDoc(doc(db, "worker/status"), { status: "fake" }));
});
test("schema rejects arbitrary project, oversized data and injected fields", async () => {
  const db = env.authenticatedContext("owner").firestore();
  await assertFails(
    setDoc(doc(db, "tasks/inject"), { ...task, command: "bad" }),
  );
  await assertFails(
    setDoc(doc(db, "tasks/wrong-project"), { ...task, projectId: "other" }),
  );
  await assertFails(
    setDoc(doc(db, "tasks/too-long"), { ...task, title: "a".repeat(181) }),
  );
  await assertFails(updateDoc(doc(db, "projects/sikhi-khoj"), { weight: -1 }));
  await assertSucceeds(
    updateDoc(doc(db, "projects/sikhi-khoj"), { weight: 3 }),
  );
  await assertSucceeds(
    setDoc(doc(db, "tasks/website"), { ...task, target: "website" }),
  );
  await assertFails(
    setDoc(doc(db, "tasks/invalid-target"), {
      ...task,
      projectId: "drivenix",
      target: "website",
    }),
  );
});
test("owner time split writes are atomic and new project tasks are supported", async () => {
  const db = env.authenticatedContext("owner").firestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "projects/bcc-improvements"), {
      name: "BCC Improvements",
      weight: 1,
      enabled: true,
      instructions: "",
    });
  });
  const batch = writeBatch(db);
  batch.update(doc(db, "projects/sikhi-khoj"), { weight: 60, enabled: true });
  batch.update(doc(db, "projects/bcc-improvements"), {
    weight: 40,
    enabled: true,
  });
  await assertSucceeds(batch.commit());
  const bad = writeBatch(db);
  bad.update(doc(db, "projects/sikhi-khoj"), { weight: 50 });
  bad.update(doc(db, "projects/bcc-improvements"), { weight: 101 });
  await assertFails(bad.commit());
  if ((await getDoc(doc(db, "projects/sikhi-khoj"))).data().weight !== 60)
    throw Error("Rejected allocation partially applied");
  await assertSucceeds(
    setDoc(doc(db, "tasks/company"), {
      ...task,
      projectId: "brainforge-company",
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, "tasks/bcc"), { ...task, projectId: "bcc-improvements" }),
  );
  await assertFails(
    updateDoc(
      doc(
        env.authenticatedContext("stranger").firestore(),
        "projects/bcc-improvements",
      ),
      { weight: 0 },
    ),
  );
});
