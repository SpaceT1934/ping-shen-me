import type { GardenState, Goal } from '@apple/contracts';
export const growthStages = [
  { threshold: 0, name: '刚种下', size: 48 },
  { threshold: 1, name: '萌芽', size: 62 },
  { threshold: 5, name: '枝叶舒展', size: 77 },
  { threshold: 12, name: '茂盛', size: 90 },
] as const;
export function growthFor(state: GardenState, projectId: string) {
  const count = state.records.filter(
    (item) => !item.deletedAt && item.type === 'action' && item.projectId === projectId,
  ).length;
  const stageIndex = growthStages.reduce(
    (stage, item, index) => (count >= item.threshold ? index : stage),
    0,
  );
  return { count, stageIndex, ...growthStages[stageIndex]! };
}
export function goalPercent(goal: Goal | undefined) {
  return goal ? Math.min(100, (goal.currentValue / goal.target) * 100) : 0;
}
export function dateInZone(time: string | Date, timeZone = 'Asia/Shanghai') {
  return new Date(time).toLocaleDateString('sv-SE', { timeZone });
}
export function createReport(
  state: GardenState,
  period: '7天' | '30天' | '本月' | '全部',
  now = new Date(),
) {
  const end = dateInZone(now, state.timeZone);
  const date = new Date(`${end}T00:00:00Z`);
  if (period === '本月') date.setUTCDate(1);
  else date.setUTCDate(date.getUTCDate() - (period === '7天' ? 6 : 29));
  const start = date.toISOString().slice(0, 10);
  const within = (value: string) => period === '全部' || (value >= start && value <= end);
  const actions = state.records.filter(
    (item) => !item.deletedAt && item.type === 'action' && within(item.date),
  );
  return {
    actions,
    activeCount: new Set(actions.map((item) => item.projectId).filter(Boolean)).size,
    resultCount: state.results.filter((item) =>
      within(dateInZone(item.completedAt, state.timeZone)),
    ).length,
    projects: state.projects.map((project) => ({
      projectId: project.id,
      count: actions.filter((item) => item.projectId === project.id).length,
      delta: state.progressEvents
        .filter(
          (item) => item.projectId === project.id && within(dateInZone(item.at, state.timeZone)),
        )
        .reduce((sum, item) => sum + item.deltaPercent, 0),
    })),
  };
}
