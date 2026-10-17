import type { GardenState, Project, Goal, Task, Entry, Result } from '@apple/contracts';
import { growthFor, dateInZone } from '@apple/domain';
export const goalDto = (goal: Goal) => ({
  id: goal.id,
  project_id: goal.projectId,
  title: goal.title,
  mode: goal.type === 'percentage' ? ('percent' as const) : goal.type,
  current_value: goal.type === 'manual' ? null : goal.currentValue,
  target_value: goal.type === 'manual' ? null : goal.target,
  status: goal.completedAt ? ('completed' as const) : ('active' as const),
  completed_at: goal.completedAt,
  created_at: goal.createdAt,
  unit: goal.unit,
});
export const growthDto = (state: GardenState, projectId: string) => {
  const growth = growthFor(state, projectId);
  return {
    action_count: growth.count,
    harvest_count: growth.harvestCount,
    tree_stage_threshold: growth.threshold,
    stage: growth.stageIndex,
    stage_key: `stage_${growth.stageIndex}`,
  };
};
export const projectDto = (state: GardenState, project: Project) => {
  const goal = state.goals.find((item) => item.id === project.currentGoalId);
  return {
    id: project.id,
    name: project.name,
    category: project.category,
    status: project.status,
    goal: goal ? goalDto(goal) : null,
    goals: state.goals
      .filter((item) => item.projectId === project.id && !item.archivedAt)
      .map(goalDto),
    growth: growthDto(state, project.id),
    created_at: project.createdAt,
    icon: project.icon,
    color: project.color,
  };
};
export const taskDto = (task: Task) => ({
  id: task.id,
  project_id: task.projectId,
  content: task.title,
  status: task.completedAt ? ('completed' as const) : ('pending' as const),
  due_at: task.dueAt ?? (task.dueDate ? `${task.dueDate}T00:00:00+08:00` : null),
  completed_at: task.completedAt,
  created_at: task.createdAt,
  action_id: task.actionId,
});
export const recordDto = (record: Entry) => ({
  id: record.id,
  project_id: record.projectId,
  type: record.type,
  content: record.content,
  source_text: record.sourceText ?? null,
  source: record.source || (record.sourceTaskId ? ('task_complete' as const) : ('text' as const)),
  emotion: record.emotion ?? null,
  occurred_at: record.occurredAt || `${record.date}T00:00:00+08:00`,
  created_at: record.createdAt,
  source_task_id: record.sourceTaskId,
  goal_id: record.goalId,
  contribution: record.contribution,
});
export const resultDto = (result: Result) => ({
  id: result.id,
  project_id: result.projectId,
  goal_id: result.goalId,
  title: result.title,
  completed_at: result.completedAt,
  harvested_at: result.harvestedAt,
  days_to_complete: result.days,
  action_count: result.actionCount,
  idea_count: result.ideaCount,
});
export const bootstrapDto = (state: GardenState) => ({
  onboarding_completed: state.onboardingCompleted,
  version: state.version,
  projects: state.projects
    .filter((item) => item.status !== 'archived')
    .map((item) => projectDto(state, item)),
});
export const growthChanges = (before: GardenState, after: GardenState) =>
  after.projects.flatMap((project) => {
    const previous = growthDto(before, project.id);
    const next = growthDto(after, project.id);
    return next.action_count === previous.action_count
      ? []
      : [
          {
            project_id: project.id,
            project_name: project.name,
            action_delta: next.action_count - previous.action_count,
            before: previous,
            after: next,
          },
        ];
  });
export function reportDto(
  state: GardenState,
  range: '7d' | '30d' | 'month' | 'all',
  now = new Date(),
) {
  const today = dateInZone(now);
  const date = new Date(`${today}T00:00:00Z`);
  if (range === 'month') date.setUTCDate(1);
  else date.setUTCDate(date.getUTCDate() - (range === '7d' ? 6 : 29));
  const start = range === 'all' ? null : `${date.toISOString().slice(0, 10)}T00:00:00+08:00`;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const end = `${tomorrow.toISOString().slice(0, 10)}T00:00:00+08:00`;
  const within = (at: string) =>
    (!start || Date.parse(at) >= Date.parse(start)) && Date.parse(at) < Date.parse(end);
  const actions = state.records.filter(
    (item) => !item.deletedAt && item.type === 'action' && within(recordDto(item).occurred_at),
  );
  return {
    range,
    start_at: start,
    end_at: end,
    action_count: actions.length,
    active_project_count: new Set(actions.map((item) => item.projectId).filter(Boolean)).size,
    new_result_count: state.results.filter((item) => within(item.completedAt)).length,
    projects: state.projects.map((project) => {
      const goal = state.goals.find((item) => item.id === project.currentGoalId);
      const dto = goal ? goalDto(goal) : null;
      return {
        project_id: project.id,
        project_name: project.name,
        action_count: actions.filter((item) => item.projectId === project.id).length,
        goal_progress: dto
          ? { mode: dto.mode, current_value: dto.current_value, target_value: dto.target_value }
          : null,
      };
    }),
    summary: null,
    recent_actions: [...actions]
      .sort(
        (a, b) =>
          Date.parse(recordDto(b).occurred_at) - Date.parse(recordDto(a).occurred_at) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, 3)
      .map(recordDto),
  };
}
