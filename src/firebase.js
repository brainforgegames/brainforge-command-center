import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  where,
  writeBatch,
  getDoc, orderBy, limit,
} from "firebase/firestore";
import { initialState } from "./domain.js";
export async function connect(onChange, onAuth) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app),
    db = getFirestore(app),
    uid = import.meta.env.VITE_ADMIN_UID;
  let subscriptions = [];
  onAuthStateChanged(auth, (user) => {
    subscriptions.forEach((f) => f());
    subscriptions = [];
    onChange(initialState());
    if (!user) {
      onAuth(null);
      return;
    }
    if (!uid || user.uid !== uid) {
      onAuth({ denied: true });
      void signOut(auth);
      return;
    }
    onAuth(user);
    const state = initialState();
    for (const name of ["projects", "tasks", "reports", "previews", "ideas"]) {
      const ref =
        name === "ideas" ? query(collection(db, name), orderBy("updatedAt", "desc"), limit(12)) : name === "previews" ? query(collection(db, name), orderBy("capturedAt", "desc"), limit(12)) : name === "reports"
          ? query(collection(db, name), where("expiresAt", ">", Date.now()))
          : collection(db, name);
      subscriptions.push(
        onSnapshot(
          ref,
          (s) => {
            state[name] = s.docs.map((d) => ({ ...d.data(), id: d.id }));
            if (name === "ideas") { state.ideasLoaded = true; state.ideasUnavailable = false; }
            onChange(structuredClone(state));
          },
          (e) => { if(name === "ideas") { state.ideasLoaded = true; state.ideasUnavailable = true; onChange(structuredClone(state)); } else onAuth({ error: e.message }); },
        ),
      );
    }
    subscriptions.push(
      onSnapshot(
        doc(db, "settings", "global"),
        (s) => {
          if (s.exists()) state.settings = s.data();
          onChange(structuredClone(state));
        },
        (e) => onAuth({ error: e.message }),
      ),
    );
    subscriptions.push(
      onSnapshot(
        doc(db, "worker", "status"),
        (s) => {
          if (s.exists()) state.worker = s.data();
          onChange(structuredClone(state));
        },
        (e) => onAuth({ error: e.message }),
      ),
    );
  });
  return {
    loadPreview: async (id) => {
      if (!auth.currentUser || auth.currentUser.uid !== uid) throw Error("Sign in to see this screenshot.");
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error("Invalid screenshot.");
      const result = await getDoc(doc(db, "previews", id, "images", "main"));
      if (!result.exists()) throw Error("This screenshot is unavailable.");
      if (!auth.currentUser || auth.currentUser.uid !== uid) throw Error("Sign in again.");
      return result.data().dataUrl;
    },
    login: () => signInWithPopup(auth, new GoogleAuthProvider()),
    logout: () => signOut(auth),
    saveAllocations: async (rows) => {
      const batch = writeBatch(db);
      rows.forEach(({ id, weight, enabled }) =>
        batch.update(doc(db, "projects", id), { weight, enabled }),
      );
      await batch.commit();
    },
    save: (name, id, value) =>
      setDoc(doc(db, name, name === "settings" ? "global" : id), value, {
        merge: true,
      }),
  };
}
