import type { GardenState } from '@apple/contracts';
import { dateInZone, growthFor, goalPercent, treeFruitsFor } from '@apple/domain';
export function createGardenView(state: GardenState) {
  const today = dateInZone(new Date(), state.timeZone);
  const harvestedGoals = new Set(
    state.results.filter((result) => result.harvestedAt).map((result) => result.goalId),
  );
  return {
    projects: state.projects.map((project) => {
      const onTreeGoals = state.goals.filter(
        (item) => item.projectId === project.id && !item.archivedAt && !harvestedGoals.has(item.id),
      );
      const goal =
        onTreeGoals.find((item) => item.id === project.currentGoalId) ||
        onTreeGoals.find((item) => !item.completedAt) ||
        onTreeGoals[0];
      return {
        ...project,
        goal: goal?.title || '还没有当前目标',
        goalId: goal?.id || null,
        goalType: goal?.type || ('manual' as const),
        goalCompleted: Boolean(goal?.completedAt),
        target: goal?.target || 1,
        progress: goal?.currentValue || 0,
        unit: goal?.unit || '',
        percent: goalPercent(goal),
        harvested: state.results.some((item) => item.projectId === project.id && item.harvestedAt),
        goals: state.goals.filter((item) => item.projectId === project.id && !item.archivedAt),
        growth: growthFor(state, project.id),
        fruits: treeFruitsFor(state, project.id),
      };
    }),
    tasks: state.tasks
      .filter((item) => !item.deletedAt)
      .map((task) => ({
        ...task,
        done: Boolean(task.completedAt),
        when: !task.dueDate ? '待安排' : task.dueDate === today ? '今天' : task.dueDate.slice(5),
      })),
    entries: state.records.filter((item) => !item.deletedAt),
  };
}
export type ProjectView = ReturnType<typeof createGardenView>['projects'][number];
