// Categories are supplied with evidence by the worker, never guessed from words.
export const resultCategories = ["completed", "limitation", "pending", "proposal", "next"];
export function validResults(value) {
  return Array.isArray(value) && value.every(item => item &&
    resultCategories.includes(item.category) && typeof item.text === "string" &&
    item.text.trim().length > 0 && item.text.length <= 160);
}
export function taskResults(task) {
  const update = task.ownerUpdate || {};
  const results = validResults(update.results) ? update.results : [];
  const originalResults = Array.isArray(update.results) ? update.results : [];
  return {
    completed: task.status === "done" ? results.filter(r => r.category === "completed").map(r => r.text) : [],
    details: [
      ...originalResults.filter(r => r && typeof r.text === "string" &&
        (!validResults(update.results) || task.status !== "done" || r.category !== "completed")).map(r => r.text),
      // Keep the original note even when it predates structured categories.
      update.brief?.done, update.done, update.brief?.issue, update.issue,
      update.brief?.next, update.next,
    ].filter(Boolean),
  };
}

// Old strings have no reliable outcome classification. Preserve them, but do not
// certify their contents by showing them under a finished-work heading.
export function reportSections(report) {
  const sections = report.ownerSections || report.sections || [];
  return sections.map(section => {
    if (section.category === "completed" && section.items.every(item =>
      item && typeof item === "object" && item.category === "completed" &&
      item.status === "done" && typeof item.text === "string" && item.text.trim())) return section;
    if (section.category === "completed" || /^(completed today|what was finished|finished work|finished results|completed results|completed|finished|results)$/i.test(section.heading?.trim() || "")) {
      return { ...section, category: "details", heading: "Past result notes · not verified" };
    }
    return section;
  });
}
