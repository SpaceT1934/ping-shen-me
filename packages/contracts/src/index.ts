import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('apple-api'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  request_id: z.string(),
  details: z
    .array(
      z.object({ client_item_id: z.string().optional(), field: z.string(), message: z.string() }),
    )
    .optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const recordTypeSchema = z.enum(['action', 'task', 'idea', 'goal']);
export const goalTypeSchema = z.enum(['count', 'manual', 'percentage']);

// AI 返回的候选项只作为草稿，用户确认后才进入正式业务数据。
export const recordDraftSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  type: recordTypeSchema,
  projectId: z.uuid().nullable(),
  emotion: z.string().max(100).nullable(),
  sourceText: z.string().max(10000),
});
export type RecordDraft = z.infer<typeof recordDraftSchema>;

export * from './garden.js';

export * from './http.js';
