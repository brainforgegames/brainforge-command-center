import test from "node:test";
import assert from "node:assert/strict";
import {
  allocationShares,
  validateAllocation,
  suggestedAllocation,
} from "../src/allocation.js";
import { initialState, selectTask } from "../src/domain.js";
test("five project shares total 100, rounding and parked projects remain correct", () => {
  const p = initialState().projects;
  assert.equal(p.length, 5);
  assert.deepEqual(Object.values(allocationShares(p)), [20, 20, 20, 20, 20]);
  const suggested = suggestedAllocation(p);
  assert.deepEqual(
    validateAllocation(p, suggested).map((p) => p.weight),
    [30, 25, 25, 10, 10],
  );
  assert.deepEqual(
    p.map((p) => p.weight),
    [1, 1, 1, 1, 1],
  );
  p[0].enabled = false;
  const shares = allocationShares(p);
  assert.equal(shares[p[0].id], 0);
  assert.equal(
    Object.values(shares).reduce((a, b) => a + b, 0),
    100,
  );
  const thirds = allocationShares(p.slice(1, 4));
  assert.deepEqual(Object.values(thirds), [34, 33, 33]);
  p.forEach((p) => (p.weight = 0));
  assert.equal(
    Object.values(allocationShares(p)).reduce((a, b) => a + b, 0),
    0,
  );
});
test("a saved split drives the actual weighted scheduler and 0% parks a project", () => {
  const p = initialState().projects,
    values = Object.fromEntries(
      p.map((p, i) => [p.id, [40, 30, 20, 10, 0][i]]),
    );
  const rows = validateAllocation(p, values),
    projects = p.map((p) => ({ ...p, ...rows.find((r) => r.id === p.id) }));
  const tasks = projects.map((p) => ({
    projectId: p.id,
    status: "queued",
    approved: true,
    priority: 1,
    createdAt: 0,
  }));
  const served = {};
  for (let n = 0; n < 1000; n++) {
    const t = selectTask(projects, tasks, served);
    served[t.projectId] = (served[t.projectId] || 0) + 1;
  }
  assert.deepEqual(served, {
    "brainforge-company": 100,
    drivenix: 300,
    "reflex-trainer": 200,
    "sikhi-khoj": 400,
  });
  assert.throws(
    () => validateAllocation(p, { ...values, drivenix: 29 }),
    /100%/,
  );
  assert.throws(
    () => validateAllocation(p, { ...values, drivenix: 30.5 }),
    /whole/,
  );
  assert.throws(
    () => validateAllocation(p, { ...values, injected: 0 }),
    /whole/,
  );
});
