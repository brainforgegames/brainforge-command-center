// Shared, decorative line icons; visible labels provide accessible names.
const paths = {
  brand: '<path d="M3 20 12 3l9 17h-7l-3-5-3 5Z"/>',
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3Z"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  tasks: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 6-7"/>',
  workers: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  reports: '<path d="M5 3h9l5 5v13H5Zm9 0v6h5M8 13h8m-8 4h8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  idea: '<path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0l-1 3H9Z"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  workspace: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1m4 0h1m-6 4h1m4 0h1m-5 10v-5h4v5"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.tasks}</svg>`;
