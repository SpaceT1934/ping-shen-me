import { z } from 'zod';
import { colorSchema, spriteSchema, legacySchema } from './garden.js';
const id = z.string().min(1).max(100);
export const timestampSchema = z.iso.datetime({ offset: true });
const name = z.string().trim().min(1).max(100);
const content = z.string().trim().min(1).max(2000);
export const rangeSchema = z.enum(['7d', '30d', 'month', 'all']);
export const growthDtoSchema = z.object({
  action_count: z.number().int().nonnegative(),
  harvest_count: z.number().int().nonnegative().default(0),
  tree_stage_threshold: z.union([z.literal(1), z.literal(2)]).default(2),
  stage: z.number().int().nonnegative(),
  stage_key: z.string(),
});
export const goalDtoSchema = z.object({
  id,
  project_id: id,
  title: z.string(),
  mode: z.enum(['count', 'percent', 'manual']),
  current_value: z.number().nullable(),
  target_value: z.number().nullable(),
  status: z.enum(['active', 'completed']),
  completed_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  unit: z.string(),
});
export const projectDtoSchema = z.object({
  id,
  name: z.string(),
  status: z.enum(['active', 'completed', 'archived']),
  goal: goalDtoSchema.nullable(),
  goals: z.array(goalDtoSchema).optional(),
  growth: growthDtoSchema,
  created_at: timestampSchema,
  icon: spriteSchema,
  color: colorSchema,
});
export const taskDtoSchema = z.object({
  id,
  project_id: id,
  content: z.string(),
  status: z.enum(['pending', 'completed']),
  due_at: timestampSchema.nullable(),
  completed_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  action_id: id.nullable(),
});
export const recordDtoSchema = z.object({
  id,
  project_id: id.nullable(),
  type: z.enum(['action', 'idea', 'goal']),
  content: z.string(),
  source_text: z.string().nullable(),
  source: z.enum(['text', 'voice', 'task_complete']),
  emotion: z.string().nullable(),
  occurred_at: timestampSchema,
  created_at: timestampSchema,
  source_task_id: id.nullable(),
  goal_id: id.nullable().default(null),
  contribution: z.number().nonnegative().default(0),
});
export const resultDtoSchema = z.object({
  id,
  project_id: id,
  goal_id: id,
  title: z.string(),
  completed_at: timestampSchema,
  harvested_at: timestampSchema.nullable(),
  days_to_complete: z.number().int().positive(),
  action_count: z.number().int().nonnegative(),
  idea_count: z.number().int().nonnegative(),
});
export const growthChangeSchema = z.object({
  project_id: id,
  project_name: z.string(),
  action_delta: z.number().int(),
  before: growthDtoSchema,
  after: growthDtoSchema,
});
export const commitItemSchema = z
  .object({
    client_item_id: id,
    content,
    type: z.enum(['action', 'task', 'idea', 'goal']),
    project_id: id.nullable(),
    goal_id: id.nullable().default(null),
    contribution: z.number().nonnegative().max(1e9).default(0),
    progress_confirmed: z.boolean().default(false),
    emotion: z.string().max(100).nullable().default(null),
    source_text: z.string().max(10000).nullable().default(null),
    occurred_at: timestampSchema.optional(),
    due_at: timestampSchema.nullable().optional(),
  })
  .strict();
export const commitInputSchema = z
  .object({
    raw_text: z.string().max(10000).default(''),
    source: z.enum(['text', 'voice']).default('text'),
    items: z.array(commitItemSchema).min(1).max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    value.items.forEach((item, index) => {
      if (ids.has(item.client_item_id))
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'client_item_id'],
          message: '本批次条目编号不能重复',
        });
      ids.add(item.client_item_id);
      if (
        item.contribution > 0 &&
        (!item.progress_confirmed || !item.goal_id || item.type !== 'action')
      )
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'contribution'],
          message: '目标贡献需要关联行动目标并由用户确认',
        });
      if (item.type !== 'action' && item.goal_id)
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'goal_id'],
          message: '只有行动可以关联目标',
        });
      if (item.type === 'task' && !item.project_id)
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'project_id'],
          message: '计划需要关联项目',
        });
      if (item.type === 'task' && item.content.length > 200)
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'content'],
          message: '计划最多 200 字',
        });
      if (item.type === 'task' && item.occurred_at)
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'occurred_at'],
          message: '计划请使用 due_at',
        });
      if (item.type !== 'task' && item.due_at)
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'due_at'],
          message: '已发生记录请使用 occurred_at',
        });
    });
  });
export const commitResponseSchema = z.object({
  batch_id: id,
  saved_items: z.array(
    z.object({
      client_item_id: id,
      id,
      type: z.enum(['action', 'task', 'idea', 'goal']),
      project_id: id.nullable(),
    }),
  ),
  growth_changes: z.array(growthChangeSchema),
  completed_results: z.array(resultDtoSchema),
  feedback_text: z.string(),
});
export const goalCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    mode: z.enum(['count', 'percent', 'manual']),
    target_value: z.number().positive().max(1e9).optional(),
    unit: z.string().max(30).default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === 'count' && (!value.target_value || !Number.isInteger(value.target_value)))
      ctx.addIssue({ code: 'custom', path: ['target_value'], message: '数量目标请填写正整数' });
    if (value.mode === 'percent' && value.target_value !== undefined && value.target_value !== 100)
      ctx.addIssue({ code: 'custom', path: ['target_value'], message: '百分比目标固定为 100' });
    if (value.mode === 'manual' && value.target_value !== undefined)
      ctx.addIssue({ code: 'custom', path: ['target_value'], message: '手动目标不填写数量' });
  });
export const projectBatchSchema = z
  .object({
    projects: z
      .array(
        z
          .object({
            client_item_id: id,
            name,
            icon: spriteSchema.default('green'),
            color: colorSchema.default('sage'),
            goal: goalCreateSchema.nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.projects.map((item) => item.client_item_id)).size !== value.projects.length)
      ctx.addIssue({ code: 'custom', path: ['projects'], message: '项目条目编号不能重复' });
  });
export const projectPatchSchema = z
  .object({
    name: name.optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
    icon: spriteSchema.optional(),
    color: colorSchema.optional(),
    current_goal_id: id.optional(),
    tree_stage_threshold: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '请提供需要修改的字段');
export const taskInputSchema = z
  .object({
    content: z.string().trim().min(1).max(200),
    due_at: timestampSchema.nullable().optional(),
  })
  .strict();
export const progressInputSchema = z
  .object({
    current_value: z.number().nonnegative().max(1e9).optional(),
    completed: z.literal(true).optional(),
  })
  .strict();
export const recordPatchSchema = z
  .object({
    content: content.optional(),
    type: z.enum(['action', 'idea', 'goal']).optional(),
    project_id: id.nullable().optional(),
    occurred_at: timestampSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '请提供需要修改的字段');
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), next_cursor: z.string().nullable() });
}
export const bootstrapSchema = z.object({
  onboarding_completed: z.boolean(),
  projects: z.array(projectDtoSchema),
  version: z.number().int().nonnegative(),
});
export const reportDtoSchema = z.object({
  range: rangeSchema,
  start_at: timestampSchema.nullable(),
  end_at: timestampSchema,
  action_count: z.number().int().nonnegative(),
  active_project_count: z.number().int().nonnegative(),
  new_result_count: z.number().int().nonnegative(),
  projects: z.array(
    z.object({
      project_id: id,
      project_name: z.string(),
      action_count: z.number().int().nonnegative(),
      goal_progress: goalDtoSchema
        .pick({ mode: true, current_value: true, target_value: true })
        .nullable(),
    }),
  ),
  summary: z.string().nullable(),
  recent_actions: z.array(recordDtoSchema),
});
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type RecordDto = z.infer<typeof recordDtoSchema>;
export type TaskDto = z.infer<typeof taskDtoSchema>;
export type ResultDto = z.infer<typeof resultDtoSchema>;

// One-time prototype import uses snake_case on the wire, then maps to the old local model.
export const legacyImportSchema = z
  .object({
    onboarding_completed: z.boolean(),
    legacy: z
      .object({
        projects: legacySchema.shape.projects,
        tasks: z.array(
          z.object({
            id,
            project_id: id,
            title: z.string().min(1).max(200),
            when: z.string(),
            done: z.boolean(),
          }),
        ),
        entries: z.array(
          z.object({
            id,
            project_id: id.nullable(),
            content: z.string().min(1).max(2000),
            type: z.enum(['action', 'task', 'idea', 'goal']),
            date: z.iso.date(),
            task_id: id.optional(),
          }),
        ),
      })
      .strict(),
  })
  .strict();
