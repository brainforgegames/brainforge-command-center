// Largest remainders keep integer percentage labels at exactly 100, including legacy weights.
export function allocationShares(projects) {
  const total = projects.reduce(
    (n, p) => n + (p.enabled && p.weight > 0 ? p.weight : 0),
    0,
  );
  if (!total) return Object.fromEntries(projects.map((p) => [p.id, 0]));
  const rows = projects.map((p) => {
    const exact = p.enabled && p.weight > 0 ? (p.weight / total) * 100 : 0;
    return {
      id: p.id,
      value: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });
  let remaining = 100 - rows.reduce((n, p) => n + p.value, 0);
  [...rows]
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, remaining)
    .forEach((p) => p.value++);
  return Object.fromEntries(rows.map((p) => [p.id, p.value]));
}
export function validateAllocation(projects, values) {
  if (
    Object.keys(values).length !== projects.length ||
    projects.some(
      (p) =>
        !Number.isInteger(values[p.id]) ||
        values[p.id] < 0 ||
        values[p.id] > 100,
    )
  )
    throw Error("Use a whole percentage from 0 to 100 for every project.");
  if (Object.values(values).reduce((a, b) => a + b, 0) !== 100)
    throw Error("Set the total to 100% before saving.");
  return projects.map((p) => ({
    id: p.id,
    weight: values[p.id],
    enabled: values[p.id] > 0,
  }));
}
export function suggestedAllocation(projects) {
  const proposed = {
    "sikhi-khoj": 30,
    drivenix: 25,
    "reflex-trainer": 25,
    "brainforge-company": 10,
    "bcc-improvements": 10,
  };
  return projects.length === 5 && projects.every((p) => p.id in proposed)
    ? proposed
    : allocationShares(
        projects.map((p) => ({ ...p, weight: 1, enabled: true })),
      );
}
