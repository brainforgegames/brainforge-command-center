import { selectTask } from '../src/domain.js';

export const primaryProject = p => !!p?.enabled && Number.isFinite(p.weight) && p.weight > 0;
// This is an explicit exception for two owner-approved scopes, never a general
// permission to wake parked projects. Task approval remains independently required.
export function fallbackTask(task, settings) {
  return Array.isArray(settings.fallbackProjectOrder) &&
    settings.fallbackProjectOrder.includes(task.projectId) &&
    ((task.projectId === 'drivenix' && task.kind !== 'research') ||
     (task.projectId === 'brainforge-company' && task.kind === 'research'));
}
export function projectAllows(task, projects, settings) {
  const project = projects.find(p => p.id === task.projectId);
  return !!project && (primaryProject(project) || fallbackTask(task, settings));
}
export function selectScheduledTask(projects, tasks, served = {}, settings = {}, allTasks = tasks) {
  const implementation = tasks.filter(t => t.kind !== 'research');
  const primary = selectTask(projects, implementation, served);
  if (primary) return primary;
  const drivenix = implementation.filter(t => t.projectId === 'drivenix' && fallbackTask(t, settings));
  const fallback = selectTask([{ id: 'drivenix', enabled: true, weight: 1 }], drivenix, served);
  if (fallback) return fallback;
  // Only runnable, unclaimed implementation takes precedence; blocked or review
  // items must not idle an independent repository with approved research.
  const research = tasks.filter(t => t.kind === 'research');
  const regular = selectTask(projects, research, served);
  if (regular) return regular;
  return selectTask([{ id: 'brainforge-company', enabled: true, weight: 1 }],
    research.filter(t => fallbackTask(t, settings)), served);
}
