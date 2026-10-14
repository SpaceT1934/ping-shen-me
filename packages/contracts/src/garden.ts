import { z } from 'zod';
const id = z.string().min(1).max(100);
const title = z.string().trim().min(1).max(200);
const date = z.iso.date();
const time = z.iso.datetime();
const provenance = {
  sourceText: z.string().max(10000).nullable().optional(),
  emotion: z.string().max(100).nullable().optional(),
};
export const spriteSchema = z.enum([
  'mascot',
  'apple',
  'golden',
  'green',
  'video',
  'book',
  'work',
  'calendar',
]);
export const colorSchema = z.enum(['sage', 'blue', 'peach', 'gold']);
export const goalModeSchema = z.enum(['count', 'manual', 'percentage']);
export const projectSchema = z.object({
  id,
  name: title,
  icon: spriteSchema,
  color: colorSchema,
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: time,
  currentGoalId: id.nullable(),
  serverGrowth: z
    .object({ count: z.number().int().nonnegative(), stageIndex: z.number().int().nonnegative() })
    .optional(),
});
export const goalSchema = z.object({
  ...provenance,
  id,
  projectId: id,
  title,
  type: goalModeSchema,
  target: z.number().positive().max(1e9),
  currentValue: z.number().nonnegative(),
  unit: z.string().max(30),
  createdAt: time,
  completedAt: time.nullable(),
  archivedAt: time.nullable(),
});
export const taskSchema = z.object({
  ...provenance,
  id,
  projectId: id,
  title,
  dueDate: date.nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  completedAt: time.nullable(),
  actionId: id.nullable(),
  createdAt: time,
  deletedAt: time.nullable(),
});
export const entrySchema = z.object({
  ...provenance,
  id,
  projectId: id.nullable(),
  content: z.string().trim().min(1).max(2000),
  type: z.enum(['action', 'idea', 'goal']),
  date,
  createdAt: time,
  deletedAt: time.nullable(),
  sourceTaskId: id.nullable(),
  source: z.enum(['text', 'voice', 'task_complete']).optional(),
  sourceText: z.string().max(10000).nullable().optional(),
  emotion: z.string().max(100).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  goalId: id.nullable(),
  contribution: z.number().nonnegative().max(1e9),
});
export const resultSchema = z.object({
  id,
  projectId: id,
  goalId: id,
  title,
  completedAt: time,
  harvestedAt: time.nullable(),
  actionCount: z.number().int().nonnegative(),
  ideaCount: z.number().int().nonnegative(),
  days: z.number().int().positive(),
  followUp: z.enum(['continue', 'complete', 'next_goal']).nullable(),
});
export const gardenSchema = z.object({
  schemaVersion: z.literal(2),
  version: z.number().int().nonnegative(),
  onboardingCompleted: z.boolean(),
  timeZone: z.literal('Asia/Shanghai'),
  projects: z.array(projectSchema).max(200),
  goals: z.array(goalSchema).max(2000),
  tasks: z.array(taskSchema).max(20000),
  records: z.array(entrySchema).max(50000),
  results: z.array(resultSchema).max(2000),
  growthEvents: z.array(
    z.object({ id, actionId: id, projectId: id, createdAt: time, revokedAt: time.nullable() }),
  ),
  progressEvents: z.array(
    z.object({ id, projectId: id, goalId: id, at: time, deltaPercent: z.number() }),
  ),
  recordBatches: z
    .array(
      z.object({
        id,
        rawText: z.string(),
        source: z.enum(['text', 'voice']),
        itemIds: z.array(id).optional(),
        createdAt: time,
      }),
    )
    .optional(),
  operations: z
    .array(
      z.object({
        id,
        fingerprint: z.string(),
        feedback: z.object({ growthProjectIds: z.array(id), resultIds: z.array(id) }),
      }),
    )
    .max(500),
});
export type GardenState = z.infer<typeof gardenSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Result = z.infer<typeof resultSchema>;
export const reportSchema = z.object({
  actions: z.array(entrySchema),
  activeCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  projects: z.array(
    z.object({ projectId: id, count: z.number().int().nonnegative(), delta: z.number() }),
  ),
});
export { draftInput as manualDraftSchema };
export const feedbackSchema = z.object({ growthProjectIds: z.array(id), resultIds: z.array(id) });
export type Feedback = z.infer<typeof feedbackSchema>;
export const mutationResponseSchema = z.object({ state: gardenSchema, feedback: feedbackSchema });
export type MutationResponse = z.infer<typeof mutationResponseSchema>;
const goalInput = z.object({
  title,
  type: goalModeSchema,
  target: z.number().positive().max(1e9),
  unit: z.string().max(30).default(''),
});
export type GoalInput = z.infer<typeof goalInput>;
const draftInput = z.object({
  ...provenance,
  content: z.string().trim().min(1).max(2000),
  projectId: id.nullable(),
  source: z.enum(['text', 'voice', 'task_complete']).optional(),
  sourceText: z.string().max(10000).nullable().optional(),
  emotion: z.string().max(100).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  type: z.enum(['action', 'task', 'idea', 'goal']),
  date,
  dueDate: date.nullable().default(null),
  contribution: z.number().nonnegative().max(1e9).default(0),
  goalType: goalModeSchema.default('manual'),
  target: z.number().positive().max(1e9).default(1),
  unit: z.string().max(30).default(''),
});
export type ManualDraft = z.infer<typeof draftInput>;
export const legacySchema = z.object({
  projects: z
    .array(
      z.object({
        id,
        name: title,
        goal: z.string().max(300),
        target: z.number().positive(),
        progress: z.number().nonnegative(),
        icon: spriteSchema,
        color: colorSchema,
        harvested: z.boolean(),
      }),
    )
    .max(200),
  tasks: z.array(z.object({ id, projectId: id, title, when: z.string(), done: z.boolean() })),
  entries: z.array(
    z.object({
      id,
      projectId: id.nullable(),
      content: z.string().min(1).max(2000),
      type: z.enum(['action', 'task', 'idea', 'goal']),
      date,
      taskId: id.optional(),
    }),
  ),
});
const payloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('onboard') }),
  z.object({
    type: z.literal('project.batch'),
    projects: z
      .array(
        z.object({
          name: title,
          icon: spriteSchema,
          color: colorSchema,
          goal: goalInput.nullable(),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    type: z.literal('project.create'),
    name: title,
    icon: spriteSchema,
    color: colorSchema,
    goal: goalInput.nullable(),
  }),
  z.object({
    type: z.literal('project.update'),
    id,
    name: title,
    icon: spriteSchema,
    color: colorSchema,
  }),
  z.object({
    type: z.literal('project.status'),
    id,
    status: z.enum(['active', 'completed', 'archived']),
  }),
  z.object({
    type: z.literal('goal.create'),
    projectId: id,
    goal: goalInput,
    replace: z.boolean(),
  }),
  z.object({
    type: z.literal('goal.progress'),
    id,
    value: z.number().nonnegative().max(1e9),
    manual: z.boolean().optional(),
  }),
  z.object({ type: z.literal('task.create'), projectId: id, title, dueDate: date.nullable() }),
  z.object({ type: z.literal('task.update'), id, title, dueDate: date.nullable() }),
  z.object({ type: z.literal('task.complete'), id, completed: z.boolean() }),
  z.object({ type: z.literal('task.delete'), id }),
  z.object({
    type: z.literal('records.save'),
    rawText: z.string().max(10000).optional(),
    items: z.array(draftInput).min(1).max(50),
  }),
  z.object({
    type: z.literal('record.update'),
    id,
    content: z.string().trim().min(1).max(2000),
    recordType: z.enum(['action', 'idea', 'goal']),
    projectId: id.nullable(),
    date,
    contribution: z.number().nonnegative().max(1e9),
  }),
  z.object({ type: z.literal('record.delete'), id }),
  z.object({
    type: z.literal('result.harvest'),
    id,
    followUp: z.enum(['continue', 'complete', 'next_goal']),
  }),
  z.object({
    type: z.literal('import.legacy'),
    legacy: legacySchema,
    onboardingCompleted: z.boolean(),
  }),
]);
export const commandSchema = z.object({
  operationId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  command: payloadSchema,
});
export type Command = z.infer<typeof payloadSchema>;
export type CommandEnvelope = z.infer<typeof commandSchema>;
