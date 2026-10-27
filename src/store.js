import { initialState, reportVisible } from "./domain.js";
import { validateAllocation } from "./allocation.js";
const configured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
export let mode = configured ? "firebase" : "demo";
let data = initialState(),
  callback = () => {},
  remote = null;
export const snapshot = () => structuredClone(data);
export async function boot(onChange, onAuth) {
  callback = onChange;
  // Opt-in loopback server exposes the coordinator's queue read-only.
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    try {
      const response=await fetch('/api/local-board',{cache:'no-store'});
      if(response.headers.get('content-type')?.includes('application/json')) {
        mode='local';
        const refresh=async()=>{
          try {
            const res=await fetch('/api/local-board',{cache:'no-store'});
            if(!res.ok)throw Error('Queue unavailable');
            data={...initialState(),...await res.json(),analyticsLoaded:true};
          } catch { data.queueSync={...data.queueSync,state:'Local queue unavailable · showing last view'}; }
          callback(snapshot());
        };
        await refresh();onAuth({local:true});setInterval(refresh,10000);return;
      }
    } catch { /* No local queue server: use the configured cloud or preview. */ }
  }
  if (!configured) {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).get("sample") === "1"
    ) {
      data = (await import("./sample.js")).sampleState();
      data.analyticsLoaded = true;
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
    data.projects = initialState().projects.map((p) => ({
      ...p,
      ...data.projects.find((old) => old.id === p.id),
    }));
    data.analyticsLoaded = true;
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
  if(mode==='local')throw Error('Discuss changes in chat; this board reads the durable worker queue.');
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
export async function saveAllocations(values) {
  if(mode==='local')throw Error('Discuss priority changes in chat; this board reads the durable worker queue.');
  const rows = validateAllocation(data.projects, values);
  if (remote) return remote.saveAllocations(rows);
  data.projects = data.projects.map((p) => ({
    ...p,
    ...rows.find((r) => r.id === p.id),
  }));
  localStorage.setItem("bcc-demo-v1", JSON.stringify(data));
  callback(snapshot());
}
export const logout = () => remote?.logout();

export async function loadPreview(id) { if (!remote) throw Error("Sample preview: no real screenshots stored here."); return remote.loadPreview(id); }
