import type { GardenState, Goal } from '@apple/contracts';
// Stage is derived from manually harvested, unique goals; actions only receive watering feedback.
export const growthStages = [
  { threshold: 0, name: '树苗期', size: 48 },
  { threshold: 3, name: '成长中', size: 62 },
  { threshold: 6, name: '茁壮成长', size: 77 },
  { threshold: 9, name: '硕果累累', size: 90 },
] as const;
export function growthFor(state: GardenState, projectId: string) {
  const count = state.records.filter(
    (item) => !item.deletedAt && item.type === 'action' && item.projectId === projectId,
  ).length;
  const harvestCount = new Set(
    state.results
      .filter((item) => item.projectId === projectId && item.harvestedAt)
      .map((item) => item.goalId),
  ).size;
  const threshold = state.projects.find((item) => item.id === projectId)?.treeStageThreshold ?? 3;
  const stageIndex = Math.min(3, Math.floor(harvestCount / threshold));
  return { ...growthStages[stageIndex]!, count, harvestCount, threshold, stageIndex };
}
export function fruitStage(percent: number) {
  return percent >= 100 ? 4 : percent > 60 ? 3 : percent > 30 ? 2 : percent > 0 ? 1 : 0;
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
