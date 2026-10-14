import { z } from 'zod';
import {
  bootstrapSchema,
  pageSchema,
  projectDtoSchema,
  recordDtoSchema,
  taskDtoSchema,
  resultDtoSchema,
  reportDtoSchema,
  commitResponseSchema,
  growthChangeSchema,
  legacySchema,
  goalCreateSchema,
  type CommandEnvelope,
  type GardenState,
  type ProjectDto,
  type RecordDto,
  type TaskDto,
  type ResultDto,
  type GoalInput,
} from '@apple/contracts';
import { dateInZone } from '@apple/domain';
import { apiRequest } from '../api';
import { createUuid } from '../uuid';
import { retainRequest, finishOperation } from './request-operations';
const atDate = (value: string | null) => (value ? `${value}T00:00:00+08:00` : null);
async function all<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>[]> {
  const items: z.infer<T>[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const response = await apiRequest(
      `${path}${path.includes('?') ? '&' : '?'}${params}`,
      pageSchema(schema),
    );
    items.push(...response.items);
    cursor = response.next_cursor;
  } while (cursor);
  return items;
}
function hydrate(
  bootstrap: z.infer<typeof bootstrapSchema>,
  projects: ProjectDto[],
  records: RecordDto[],
  tasks: TaskDto[],
  results: ResultDto[],
): GardenState {
  return {
    schemaVersion: 2,
    version: bootstrap.version,
    onboardingCompleted: bootstrap.onboarding_completed,
    timeZone: 'Asia/Shanghai',
    projects: projects.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      icon: item.icon,
      color: item.color,
      createdAt: item.created_at,
      currentGoalId: item.goal?.id || null,
      serverGrowth: { count: item.growth.action_count, stageIndex: item.growth.stage },
    })),
    goals: projects.flatMap((item) =>
      item.goal
        ? [
            {
              id: item.goal.id,
              projectId: item.id,
              title: item.goal.title,
              type: item.goal.mode === 'percent' ? ('percentage' as const) : item.goal.mode,
              target: item.goal.target_value ?? 1,
              currentValue: item.goal.current_value ?? (item.goal.completed_at ? 1 : 0),
              unit: item.goal.unit,
              createdAt: item.goal.created_at,
              completedAt: item.goal.completed_at,
              archivedAt: null,
            },
          ]
        : [],
    ),
    records: records.map((item) => ({
      id: item.id,
      projectId: item.project_id,
      type: item.type,
      content: item.content,
      date: dateInZone(item.occurred_at),
      createdAt: item.created_at,
      deletedAt: null,
      sourceTaskId: item.source_task_id,
      source: item.source,
      sourceText: item.source_text,
      emotion: item.emotion,
      occurredAt: item.occurred_at,
      goalId: null,
      contribution: 0,
    })),
    tasks: tasks.map((item) => ({
      id: item.id,
      projectId: item.project_id,
      title: item.content,
      dueDate: item.due_at ? dateInZone(item.due_at) : null,
      dueAt: item.due_at,
      completedAt: item.completed_at,
      createdAt: item.created_at,
      actionId: item.action_id,
      deletedAt: null,
    })),
    results: results.map((item) => ({
      id: item.id,
      projectId: item.project_id,
      goalId: item.goal_id,
      title: item.title,
      completedAt: item.completed_at,
      harvestedAt: item.harvested_at,
      days: item.days_to_complete,
      actionCount: item.action_count,
      ideaCount: item.idea_count,
      followUp: null,
    })),
    growthEvents: [],
    progressEvents: [],
    operations: [],
  };
}
async function read(): Promise<GardenState> {
  const [bootstrap, projects, records, tasks, results] = await Promise.all([
    apiRequest('/bootstrap', bootstrapSchema),
    all('/projects?status=all', projectDtoSchema),
    all('/records', recordDtoSchema),
    all('/tasks', taskDtoSchema),
    all('/results', resultDtoSchema),
  ]);
  return hydrate(bootstrap, projects, records, tasks, results);
}
const changeSchema = z.object({
  growth_changes: z.array(growthChangeSchema).optional(),
  completed_results: z.array(resultDtoSchema).optional(),
});
const goalBody = (goal: GoalInput) => ({
  title: goal.title,
  mode: goal.type === 'percentage' ? 'percent' : goal.type,
  ...(goal.type === 'manual'
    ? {}
    : { target_value: goal.type === 'percentage' ? 100 : goal.target }),
  unit: goal.unit,
});
async function mutate(envelope: CommandEnvelope) {
  const { command, operationId } = envelope;
  const write = <T>(
    path: string,
    method: string,
    body: unknown,
    schema: z.ZodType<T>,
    suffix = '',
  ) => {
    const key = operationId + suffix;
    const request = retainRequest(key, { path, method, body });
    return apiRequest(request.path, schema, {
      method: request.method,
      headers: { 'Idempotency-Key': key },
      ...(request.method === 'DELETE' ? {} : { body: JSON.stringify(request.body) }),
    });
  };
  let changes: z.infer<typeof changeSchema> = {};
  switch (command.type) {
    case 'onboard':
      await write('/onboarding', 'PATCH', { onboarding_completed: true }, bootstrapSchema);
      break;
    case 'project.create': {
      if (command.goal) goalCreateSchema.parse(goalBody(command.goal));
      const created = await write(
        '/projects/batch',
        'POST',
        {
          projects: [
            {
              client_item_id: operationId,
              name: command.name,
              icon: command.icon,
              color: command.color,
            },
          ],
        },
        z.object({ projects: z.array(projectDtoSchema) }),
      );
      if (command.goal)
        await write(
          `/projects/${created.projects[0]!.id}/goals`,
          'POST',
          goalBody(command.goal),
          z.object({}),
          ':goal',
        );
      break;
    }
    case 'project.update':
      await write(
        `/projects/${command.id}`,
        'PATCH',
        { name: command.name, icon: command.icon, color: command.color },
        z.object({}),
      );
      break;
    case 'project.status':
      await write(`/projects/${command.id}`, 'PATCH', { status: command.status }, z.object({}));
      break;
    case 'goal.create':
      await write(
        `/projects/${command.projectId}/goals`,
        'POST',
        goalBody(command.goal),
        z.object({}),
      );
      break;
    case 'goal.progress': {
      changes = await write(
        `/goals/${command.id}/progress`,
        'PATCH',
        command.manual ? { completed: true } : { current_value: command.value },
        changeSchema,
      );
      break;
    }
    case 'task.create':
      await write(
        `/projects/${command.projectId}/tasks`,
        'POST',
        { content: command.title, due_at: atDate(command.dueDate) },
        z.object({}),
      );
      break;
    case 'task.update':
      await write(
        `/tasks/${command.id}`,
        'PATCH',
        { content: command.title, due_at: atDate(command.dueDate) },
        z.object({}),
      );
      break;
    case 'task.complete':
      changes = await write(
        `/tasks/${command.id}/${command.completed ? 'complete' : 'reopen'}`,
        'POST',
        {},
        changeSchema,
      );
      break;
    case 'task.delete':
      await write(`/tasks/${command.id}`, 'DELETE', {}, z.object({}));
      break;
    case 'records.save': {
      const saved = await write(
        '/record-batches/commit',
        'POST',
        {
          raw_text:
            command.rawText ??
            command.items.map((item) => item.sourceText ?? item.content).join('\n'),
          source: 'text',
          items: command.items.map((item, index) => ({
            client_item_id: `${operationId}:${index}`,
            content: item.content,
            type: item.type,
            project_id: item.projectId,
            emotion: item.emotion ?? null,
            source_text: item.sourceText ?? item.content,
            ...(item.type === 'task'
              ? { due_at: atDate(item.dueDate) }
              : item.occurredAt || item.date !== dateInZone(new Date())
                ? { occurred_at: item.occurredAt || atDate(item.date) }
                : {}),
          })),
        },
        commitResponseSchema,
      );
      changes = saved;
      break;
    }
    case 'record.update':
      changes = await write(
        `/records/${command.id}`,
        'PATCH',
        {
          content: command.content,
          project_id: command.projectId,
          type: command.recordType,
          occurred_at: atDate(command.date),
        },
        changeSchema,
      );
      break;
    case 'record.delete':
      await write(`/records/${command.id}`, 'DELETE', {}, z.object({}));
      break;
    case 'result.harvest': {
      const harvested = await write(
        `/results/${command.id}/harvest`,
        'POST',
        {},
        z.object({ result: resultDtoSchema }),
      );
      if (command.followUp === 'complete')
        await write(
          `/projects/${harvested.result.project_id}`,
          'PATCH',
          { status: 'completed' },
          z.object({}),
          ':project',
        );
      break;
    }
    case 'import.legacy':
      await write(
        '/imports/legacy',
        'POST',
        {
          legacy: {
            projects: command.legacy.projects,
            tasks: command.legacy.tasks.map((item) => ({
              id: item.id,
              project_id: item.projectId,
              title: item.title,
              when: item.when,
              done: item.done,
            })),
            entries: command.legacy.entries.map((item) => ({
              id: item.id,
              project_id: item.projectId,
              content: item.content,
              type: item.type,
              date: item.date,
              task_id: item.taskId,
            })),
          },
          onboarding_completed: command.onboardingCompleted,
        },
        bootstrapSchema,
      );
      break;
  }
  const state = await read();
  finishOperation(operationId);
  return {
    state,
    feedback: {
      growthProjectIds: (changes.growth_changes || [])
        .filter((item) => item.action_delta > 0)
        .map((item) => item.project_id),
      resultIds: (changes.completed_results || []).map((item) => item.id),
    },
  };
}
export const gardenApi = {
  read,
  mutate,
  exportData: () =>
    apiRequest('/exports/garden', z.object({ schema_version: z.literal(2) }).passthrough()),
  report: (period: string) =>
    apiRequest(
      `/reports?range=${({ '7天': '7d', '30天': '30d', 本月: 'month', 全部: 'all' } as Record<string, string>)[period] || '7d'}`,
      reportDtoSchema,
    ),
};
export async function initializeGarden(): Promise<GardenState> {
  const session = await apiRequest('/session', bootstrapSchema, { method: 'POST', body: '{}' });
  if (!session.onboarding_completed && session.version === 0) {
    try {
      const parsed = legacySchema.safeParse(
        JSON.parse(localStorage.getItem('apple-ui-garden-v1') || 'null'),
      );
      if (parsed.success && localStorage.getItem('apple-legacy-imported-v2') !== 'true') {
        await mutate({
          operationId: createUuid(),
          expectedVersion: 0,
          command: {
            type: 'import.legacy',
            legacy: parsed.data,
            onboardingCompleted:
              localStorage.getItem('apple-ui-onboarding-completed-v1') === 'true',
          },
        });
        localStorage.setItem('apple-legacy-imported-v2', 'true');
      }
    } catch {
      /* 原始缓存保留，可再次导入；正常首屏继续读取服务端。 */
    }
  }
  return read();
}
