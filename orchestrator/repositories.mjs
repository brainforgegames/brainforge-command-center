export function expectedRemote(project) {
  const provider = project.provider || "github";
  if (!["github", "gitlab"].includes(provider))
    throw Error("Unsupported repository provider.");
  if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(project.repository))
    throw Error("Configure an exact repository path.");
  return `https://${provider}.com/${project.repository}`;
}
export function canonicalRemote(value) {
  const ssh = /^git@(github\.com|gitlab\.com):(.+)$/.exec(value.trim());
  if (ssh) return `https://${ssh[1]}/${ssh[2].replace(/\.git$/, "")}`;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error("Repository remote URL is invalid.");
  }
  if (url.username || url.password)
    throw Error(
      "Remote contains embedded credentials. Save them in Git Credential Manager and use a credential-free origin URL.",
    );
  if (
    url.protocol !== "https:" ||
    !["github.com", "gitlab.com"].includes(url.hostname) ||
    url.port ||
    url.search ||
    url.hash
  )
    throw Error("Use a standard HTTPS or SSH GitHub/GitLab remote.");
  return `https://${url.hostname}${url.pathname.replace(/\/$/, "").replace(/\.git$/, "")}`;
}
export function gitlabReviewPush(branch, base, title, summary) {
  const clean = (value) =>
    String(value)
      .replace(/[\r\n\0]/g, " ")
      .slice(0, 4000);
  return [
    "push",
    "-u",
    "origin",
    branch,
    "-o",
    "merge_request.create",
    "-o",
    "merge_request.draft",
    "-o",
    `merge_request.target=${clean(base)}`,
    "-o",
    `merge_request.title=${clean(title)}`,
    "-o",
    `merge_request.description=${clean(summary)}`,
  ];
}
