import { initialState, reportVisible } from "./domain.js";
const configured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const mode = configured ? "firebase" : "demo";
let data = initialState(),
  callback = () => {},
  remote = null;
export const snapshot = () => structuredClone(data);
export async function boot(onChange, onAuth) {
  callback = onChange;
  if (!configured) {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).get("sample") === "1"
    ) {
      data = (await import("./sample.js")).sampleState();
      callback(snapshot());
      onAuth({ demo: true });
      return;
    }
    try {
      data = JSON.parse(localStorage.getItem("bcc-demo-v1")) || initialState();
    } catch {
      data = initialState();
    }
    data.reports = data.reports.filter((r) => reportVisible(r));
    callback(snapshot());
    onAuth({ demo: true });
    return;
  }
  const { connect } = await import("./firebase.js");
  remote = await connect((state) => {
    data = state;
    callback(snapshot());
  }, onAuth);
}
export async function save(collection, id, value) {
  if (remote) return remote.save(collection, id, value);
  if (collection === "settings") data.settings = { ...data.settings, ...value };
  else {
    const rows = data[collection];
    const i = rows.findIndex((x) => x.id === id);
    if (i < 0) rows.push({ ...value, id });
    else rows[i] = { ...rows[i], ...value, id };
  }
  localStorage.setItem("bcc-demo-v1", JSON.stringify(data));
  callback(snapshot());
}
export const login = () => remote?.login();
export const logout = () => remote?.logout();
