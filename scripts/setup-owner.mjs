import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRequire } from "node:module";
import { credential } from "../orchestrator/credential.mjs";
const projectId = process.env.BCC_FIREBASE_PROJECT_ID;
if (!projectId) throw Error("Set BCC_FIREBASE_PROJECT_ID.");
const require = createRequire(import.meta.url),
  cli = require("firebase-tools/lib/auth"),
  account = cli.getGlobalDefaultAccount();
if (account?.user?.email !== "brainforgegames@gmail.com" || !account.user.sub)
  throw Error(
    "Sign in to Firebase CLI with the Brainforge Google account first.",
  );
const auth = getAuth(
  initializeApp({ credential: credential("firebase-cli"), projectId }),
);
let user;
try {
  user = await auth.getUserByEmail(account.user.email);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({
    uid: "brainforge-admin",
    email: account.user.email,
    emailVerified: true,
    displayName: "Brainforge Admin",
  });
}
if (!user.providerData.some((p) => p.providerId === "google.com"))
  user = await auth.updateUser(user.uid, {
    providerToLink: {
      providerId: "google.com",
      uid: account.user.sub,
      email: account.user.email,
      displayName: "Brainforge Admin",
    },
  });
console.log(
  JSON.stringify({
    uid: user.uid,
    email: user.email,
    googleLinked: user.providerData.some((p) => p.providerId === "google.com"),
  }),
);
