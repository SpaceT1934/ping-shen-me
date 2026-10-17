import type { GardenState } from '@apple/contracts';
export function periodMetrics(state: GardenState, startAt: string | null, endAt: string) {
  const start = startAt ? Date.parse(startAt) : -Infinity;
  const end = Date.parse(endAt);
  const within = (date: string | null) =>
    date !== null && Date.parse(date) >= start && Date.parse(date) < end;
  const actions = state.records.filter(
    (item) =>
      !item.deletedAt &&
      item.type === 'action' &&
      within(item.occurredAt || `${item.date}T12:00:00+08:00`),
  );
  return [
    actions.length,
    state.results.filter((item) => within(item.harvestedAt)).length,
    new Set(actions.flatMap((item) => (item.projectId ? [item.projectId] : []))).size,
    state.goals.filter((item) => !item.archivedAt && within(item.completedAt)).length,
  ];
}
export function periodChange(current: number, previous: number) {
  if (previous === 0) return current ? '本期新增' : '与上期持平';
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent ? `较上期 ${percent > 0 ? '+' : ''}${percent}%` : '与上期持平';
}
