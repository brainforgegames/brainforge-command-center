const pages = { today: 'Today', projects: 'Projects', work: 'Work board', reports: 'Reports', analytics: 'Analytics', ideas: 'Ideas' };
const project = value => /^[a-z0-9][a-z0-9_-]{0,99}$/.test(value || '') ? value : 'all';
const choice = (value, values) => values.includes(value) ? value : 'all';

export function parseRoute(hash = '') {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const page = pages[path] || 'Today', params = new URLSearchParams(query);
  return {
    page,
    workView: page === 'Work board' ? choice(params.get('view'), ['all', 'today', 'open']) : 'all',
    projectFilter: page === 'Work board' ? project(params.get('project')) : 'all',
    statusFilter: page === 'Work board' ? choice(params.get('status'), ['all', 'queued', 'running', 'review', 'blocked', 'done']) : 'all',
    previewFilter: page === 'Screenshots' ? project(params.get('project')) : 'all',
  };
}

export function routeHash(route) {
  const slug = Object.keys(pages).find(key => pages[key] === route.page) || 'today';
  const params = new URLSearchParams();
  if (slug === 'work') {
    if (route.workView && route.workView !== 'all') params.set('view', route.workView);
    if (route.projectFilter && route.projectFilter !== 'all') params.set('project', route.projectFilter);
    if (route.statusFilter && route.statusFilter !== 'all') params.set('status', route.statusFilter);
  }
  if (slug === 'screenshots' && route.previewFilter && route.previewFilter !== 'all') params.set('project', route.previewFilter);
  return `#/${slug}${params.size ? '?' + params : ''}`;
}

// Only explicit navigation writes history. Rendering and live subscriptions never do.
export function createNavigation(browser, onRoute) {
  let current = '';
  function restore() {
    const route = parseRoute(browser.location.hash), hash = routeHash(route);
    if (browser.location.hash !== hash) browser.history.replaceState(null, '', hash);
    if (current === hash) return;
    current = hash;
    onRoute(route);
  }
  browser.addEventListener('popstate', restore);
  browser.addEventListener('hashchange', restore);
  restore(); // Replace the first entry; never insert a sentinel that traps Back.
  return {
    navigate(route) {
      const next = parseRoute(routeHash(route)), hash = routeHash(next);
      if (hash === current) return false;
      browser.history.pushState(null, '', hash);
      current = hash;
      onRoute(next);
      return true;
    },
  };
}
