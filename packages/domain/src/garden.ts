import {
  gardenSchema,
  type GardenState,
  type CommandEnvelope,
  type GoalInput,
  type MutationResponse,
  type ManualDraft,
  type Entry,
} from '@apple/contracts';
import { dateInZone } from './selectors.js';
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export function emptyGarden(): GardenState {
  return {
    schemaVersion: 2,
    version: 0,
    onboardingCompleted: false,
    timeZone: 'Asia/Shanghai',
    projects: [],
    goals: [],
    tasks: [],
    records: [],
    results: [],
    growthEvents: [],
    progressEvents: [],
    operations: [],
  };
}
export type Runtime = { now: string; id: () => string };
function fail(message: string, code = 'INVALID_OPERATION', status = 400): never {
  throw new DomainError(code, message, status);
}
export function applyCommand(
  previous: GardenState,
  envelope: CommandEnvelope,
  fingerprint: string,
  runtime: Runtime,
): MutationResponse {
  const replay = previous.operations.find((item) => item.id === envelope.operationId);
  if (replay) {
    if (replay.fingerprint !== fingerprint)
      fail('同一提交编号不能用于不同操作', 'IDEMPOTENCY_CONFLICT', 409);
    return { state: previous, feedback: replay.feedback };
  }
  if (previous.version !== envelope.expectedVersion)
    fail('数据已更新，请刷新后重新提交', 'VERSION_CONFLICT', 409);
  const state = structuredClone(previous);
  const { now, id } = runtime;
  const today = dateInZone(now, state.timeZone);
  const affected = new Set<string>();
  const oldResultIds = new Set(state.results.map((item) => item.id));
  const projectFor = (projectId: string, writable = false) => {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) fail('项目不存在', 'NOT_FOUND', 404);
    if (writable && project.status !== 'active') fail('请先恢复项目，再继续记录');
    return project;
  };
  const nameAvailable = (name: string, except?: string) => {
    const normalized = name.normalize('NFKC').trim().toLocaleLowerCase();
    if (
      state.projects.some(
        (item) =>
          item.id !== except &&
          item.name.normalize('NFKC').trim().toLocaleLowerCase() === normalized,
      )
    )
      fail('已有同名项目，请换一个名字', 'DUPLICATE_PROJECT', 409);
  };
  const setProgress = (goalId: string, value: number) => {
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal) fail('目标不存在', 'NOT_FOUND', 404);
    if (goal.completedAt || goal.archivedAt) fail('历史目标不能修改进度，请创建新目标');
    const next = Math.min(goal.target, Math.max(0, value));
    if (next !== goal.currentValue)
      state.progressEvents.push({
        id: id(),
        projectId: goal.projectId,
        goalId,
        at: now,
        deltaPercent: ((next - goal.currentValue) / goal.target) * 100,
      });
    goal.currentValue = next;
  };
  const createGoal = (projectId: string, input: GoalInput, replace = false) => {
    const project = projectFor(projectId, true);
    const current = state.goals.find((item) => item.id === project.currentGoalId);
    if (current && !current.completedAt && !current.archivedAt) {
      if (!replace) fail('项目已有当前目标，替换前需要确认', 'GOAL_EXISTS', 409);
      current.archivedAt = now;
    }
    const target = input.type === 'manual' ? 1 : input.type === 'percentage' ? 100 : input.target;
    if (input.type === 'count' && !Number.isInteger(target)) fail('数量目标请填写整数');
    const goalId = id();
    state.goals.push({
      id: goalId,
      projectId,
      title: input.title,
      type: input.type,
      target,
      currentValue: 0,
      unit: input.type === 'percentage' ? '%' : input.unit,
      createdAt: now,
      completedAt: null,
      archivedAt: null,
    });
    project.currentGoalId = goalId;
  };
  const contribution = (record: Entry, reverse = false) => {
    if (!record.contribution || !record.goalId) return;
    const goal = state.goals.find((item) => item.id === record.goalId);
    // 已生成的成果是达成时的快照，后续纠错不会静默撤销成果。
    if (!goal || goal.completedAt || goal.archivedAt) return;
    setProgress(
      goal.id,
      goal.currentValue + (reverse ? -record.contribution : record.contribution),
    );
  };
  const makeRecord = (draft: ManualDraft, sourceTaskId: string | null = null): Entry => {
    if (draft.date > today) fail('已发生的记录不能填写未来日期');
    const project = draft.projectId ? projectFor(draft.projectId, true) : null;
    let goalId: string | null = null;
    if (draft.contribution) {
      if (draft.type !== 'action' || !project) fail('只有关联项目的行动可以推进目标');
      const goal = state.goals.find((item) => item.id === project.currentGoalId);
      if (!goal || goal.completedAt || goal.archivedAt || goal.type === 'manual')
        fail('当前目标不支持数量贡献');
      if (goal.type === 'count' && !Number.isInteger(draft.contribution))
        fail('数量贡献请填写整数');
      goalId = goal.id;
    }
    const record: Entry = {
      id: id(),
      projectId: draft.projectId,
      type: draft.type === 'goal' ? 'goal' : draft.type === 'idea' ? 'idea' : 'action',
      source: sourceTaskId ? 'task_complete' : draft.source || 'text',
      sourceText: draft.sourceText ?? null,
      emotion: draft.emotion ?? null,
      occurredAt: draft.occurredAt || (draft.date === today ? now : `${draft.date}T00:00:00+08:00`),
      content: draft.content,
      date: draft.date,
      createdAt: now,
      deletedAt: null,
      sourceTaskId,
      goalId,
      contribution: draft.contribution,
    };
    state.records.push(record);
    contribution(record);
    if (record.type === 'action' && project) affected.add(project.id);
    return record;
  };
  const command = envelope.command;
  switch (command.type) {
    case 'onboard':
      state.onboardingCompleted = true;
      break;
    case 'project.create': {
      if (state.projects.length >= 200) fail('项目数量已达到上限');
      nameAvailable(command.name);
      const projectId = id();
      state.projects.push({
        id: projectId,
        name: command.name,
        icon: command.icon,
        color: command.color,
        status: 'active',
        createdAt: now,
        currentGoalId: null,
      });
      if (command.goal) createGoal(projectId, command.goal);
      state.onboardingCompleted = true;
      break;
    }
    case 'project.update': {
      nameAvailable(command.name, command.id);
      Object.assign(projectFor(command.id), {
        name: command.name,
        icon: command.icon,
        color: command.color,
      });
      break;
    }
    case 'project.status':
      projectFor(command.id).status = command.status;
      break;
    case 'goal.create':
      createGoal(command.projectId, command.goal, command.replace);
      break;
    case 'goal.progress': {
      const goal = state.goals.find((item) => item.id === command.id);
      if (!goal) fail('目标不存在', 'NOT_FOUND', 404);
      projectFor(goal.projectId, true);
      if (command.value > goal.target) fail('进度不能超过目标值');
      if (goal.type === 'count' && !Number.isInteger(command.value)) fail('数量进度请填写整数');
      setProgress(command.id, command.value);
      break;
    }
    case 'task.create': {
      projectFor(command.projectId, true);
      state.tasks.push({
        id: id(),
        projectId: command.projectId,
        title: command.title,
        dueDate: command.dueDate,
        completedAt: null,
        actionId: null,
        createdAt: now,
        deletedAt: null,
      });
      break;
    }
    case 'task.update': {
      const task = state.tasks.find((item) => item.id === command.id && !item.deletedAt);
      if (!task) fail('任务不存在', 'NOT_FOUND', 404);
      projectFor(task.projectId, true);
      task.title = command.title;
      task.dueDate = command.dueDate;
      const action = state.records.find((item) => item.id === task.actionId);
      if (action) action.content = command.title;
      break;
    }
    case 'task.complete': {
      const task = state.tasks.find((item) => item.id === command.id && !item.deletedAt);
      if (!task) fail('任务不存在', 'NOT_FOUND', 404);
      projectFor(task.projectId, true);
      if (Boolean(task.completedAt) === command.completed) break;
      if (command.completed) {
        task.completedAt = now;
        const existing = state.records.find((item) => item.id === task.actionId);
        if (existing) {
          existing.deletedAt = null;
          existing.date = today;
          affected.add(task.projectId);
        } else
          task.actionId = makeRecord(
            {
              content: task.title,
              type: 'action',
              source: 'task_complete',
              projectId: task.projectId,
              date: today,
              dueDate: null,
              contribution: 0,
              goalType: 'manual',
              target: 1,
              unit: '',
            },
            task.id,
          ).id;
      } else {
        task.completedAt = null;
        const action = state.records.find((item) => item.id === task.actionId);
        if (action) action.deletedAt = now;
      }
      break;
    }
    case 'task.delete': {
      const task = state.tasks.find((item) => item.id === command.id && !item.deletedAt);
      if (!task) fail('任务不存在', 'NOT_FOUND', 404);
      if (task.completedAt) fail('请先撤销完成，再删除任务');
      task.deletedAt = now;
      break;
    }
    case 'records.save': {
      for (const draft of command.items) {
        if (draft.type === 'task' && draft.content.length > 200) fail('计划请控制在 200 字以内');
        if (draft.type === 'task') {
          if (!draft.projectId) fail('计划需要关联一个项目');
          projectFor(draft.projectId, true);
          state.tasks.push({
            id: id(),
            projectId: draft.projectId,
            title: draft.content,
            dueDate: draft.dueDate,
            dueAt: draft.dueAt ?? null,
            completedAt: null,
            actionId: null,
            createdAt: now,
            deletedAt: null,
          });
        } else makeRecord(draft);
      }
      break;
    }
    case 'record.update': {
      const record = state.records.find((item) => item.id === command.id && !item.deletedAt);
      if (!record) fail('记录不存在', 'NOT_FOUND', 404);
      if (record.sourceTaskId) fail('任务生成的行动请在任务中修改');
      const preserveContribution =
        record.projectId === command.projectId &&
        record.type === command.recordType &&
        record.contribution === command.contribution;
      if (!preserveContribution) contribution(record, true);
      const replacement = makeRecord({
        ...command,
        type: command.recordType,
        contribution: preserveContribution ? 0 : command.contribution,
        dueDate: null,
        goalType: 'manual',
        target: 1,
        unit: '',
      });
      state.records.pop();
      if (preserveContribution) {
        replacement.goalId = record.goalId;
        replacement.contribution = record.contribution;
      }
      Object.assign(record, replacement, { id: record.id, createdAt: record.createdAt });
      break;
    }
    case 'record.delete': {
      const record = state.records.find((item) => item.id === command.id && !item.deletedAt);
      if (!record) fail('记录不存在', 'NOT_FOUND', 404);
      if (record.sourceTaskId) fail('任务生成的行动请通过撤销任务完成来移除');
      contribution(record, true);
      record.deletedAt = now;
      break;
    }
    case 'result.harvest': {
      const result = state.results.find((item) => item.id === command.id);
      if (!result) fail('成果尚未达成', 'NOT_FOUND', 404);
      if (result.harvestedAt) break;
      result.harvestedAt = now;
      result.followUp = command.followUp;
      break;
    }
    case 'import.legacy': {
      if (
        state.projects.length ||
        state.records.length ||
        state.goals.length ||
        state.tasks.length ||
        state.results.length ||
        state.onboardingCompleted
      )
        fail('花园已有数据，不能重复导入', 'IMPORT_CONFLICT', 409);
      for (const old of command.legacy.projects) {
        const dates = command.legacy.entries
          .filter((item) => item.projectId === old.id)
          .map((item) => item.date)
          .sort();
        const createdAt = `${dates[0] || today}T00:00:00.000Z`;
        const goalId = id();
        state.projects.push({
          id: old.id,
          name: old.name,
          icon: old.icon,
          color: old.color,
          status: 'active',
          createdAt,
          currentGoalId: goalId,
        });
        state.goals.push({
          id: goalId,
          projectId: old.id,
          title: old.goal || '继续向前',
          type: 'count',
          target: old.target,
          currentValue: Math.min(old.target, old.progress),
          unit: '',
          createdAt,
          completedAt: null,
          archivedAt: null,
        });
      }
      const projectIds = new Set(state.projects.map((item) => item.id));
      for (const old of command.legacy.entries) {
        if (old.type !== 'action' && old.type !== 'idea') continue;
        state.records.push({
          id: old.id,
          projectId: old.projectId && projectIds.has(old.projectId) ? old.projectId : null,
          type: old.type,
          content: old.content,
          date: old.date,
          createdAt: `${old.date}T00:00:00.000Z`,
          deletedAt: null,
          sourceTaskId: old.taskId || null,
          goalId: null,
          contribution: 0,
        });
      }
      for (const old of command.legacy.tasks) {
        if (!projectIds.has(old.projectId)) continue;
        const action = state.records.find((item) => item.sourceTaskId === old.id);
        state.tasks.push({
          id: old.id,
          projectId: old.projectId,
          title: old.title,
          dueDate: old.when === '今天' ? today : null,
          createdAt: now,
          completedAt: old.done ? now : null,
          deletedAt: null,
          actionId: action?.id || null,
        });
        if (old.done && !action) {
          const record = makeRecord(
            {
              content: old.title,
              projectId: old.projectId,
              date: today,
              type: 'action',
              dueDate: null,
              contribution: 0,
              goalType: 'manual',
              target: 1,
              unit: '',
            },
            old.id,
          );
          state.tasks.at(-1)!.actionId = record.id;
        }
      }
      state.onboardingCompleted = command.onboardingCompleted;
      break;
    }
  }
  // 一个有效 Action 对应一个成长事件；纠错与撤销会调整有效性。
  const eventByAction = new Map(state.growthEvents.map((item) => [item.actionId, item]));
  for (const record of state.records) {
    const existing = eventByAction.get(record.id);
    const valid = !record.deletedAt && record.type === 'action' && record.projectId;
    if (valid) {
      if (existing) {
        existing.projectId = record.projectId!;
        existing.revokedAt = null;
      } else
        state.growthEvents.push({
          id: id(),
          actionId: record.id,
          projectId: record.projectId!,
          createdAt: now,
          revokedAt: null,
        });
    } else if (existing && !existing.revokedAt) existing.revokedAt = now;
  }
  for (const goal of state.goals) {
    if (goal.completedAt || goal.archivedAt || goal.currentValue < goal.target) continue;
    goal.completedAt = now;
    const project = projectFor(goal.projectId);
    const startDate = dateInZone(goal.createdAt, state.timeZone);
    const records = state.records.filter(
      (item) =>
        !item.deletedAt &&
        item.projectId === goal.projectId &&
        item.date >= startDate &&
        item.date <= today,
    );
    state.results.push({
      id: id(),
      projectId: project.id,
      goalId: goal.id,
      title: goal.title,
      completedAt: now,
      harvestedAt: null,
      actionCount: records.filter((item) => item.type === 'action').length,
      ideaCount: records.filter((item) => item.type === 'idea').length,
      days: Math.max(
        1,
        Math.floor(
          (Date.parse(`${today}T00:00:00Z`) -
            Date.parse(`${dateInZone(project.createdAt, state.timeZone)}T00:00:00Z`)) /
            86400000,
        ) + 1,
      ),
      followUp: null,
    });
  }
  // 历史版本已收获标记迁移为正式成果，保留原来的收获事实。
  if (command.type === 'import.legacy')
    for (const old of command.legacy.projects.filter((item) => item.harvested)) {
      const project = projectFor(old.id);
      const goal = state.goals.find((item) => item.id === project.currentGoalId)!;
      goal.currentValue = goal.target;
      goal.completedAt ||= now;
      let result = state.results.find((item) => item.goalId === goal.id);
      if (!result) {
        result = {
          id: id(),
          projectId: project.id,
          goalId: goal.id,
          title: goal.title,
          completedAt: now,
          harvestedAt: now,
          actionCount: state.records.filter(
            (item) => item.projectId === project.id && item.type === 'action',
          ).length,
          ideaCount: state.records.filter(
            (item) => item.projectId === project.id && item.type === 'idea',
          ).length,
          days: 1,
          followUp: 'continue',
        };
        state.results.push(result);
      }
      result.harvestedAt = now;
      result.followUp = 'continue';
    }
  const feedback = {
    growthProjectIds: [...affected],
    resultIds: state.results.filter((item) => !oldResultIds.has(item.id)).map((item) => item.id),
  };
  state.version += 1;
  state.operations.push({ id: envelope.operationId, fingerprint, feedback });
  state.operations = state.operations.slice(-500);
  return { state: gardenSchema.parse(state), feedback };
}
