import type { GardenState } from '@apple/contracts';
import { dateInZone, growthFor, goalPercent } from '@apple/domain';
export function createGardenView(state: GardenState) {
  const today = dateInZone(new Date(), state.timeZone);
  return {
    projects: state.projects.map((project) => {
      const goal = state.goals.find((item) => item.id === project.currentGoalId);
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
        growth: growthFor(state, project.id),
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
