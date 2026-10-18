import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  projectAnalysisInputSchema,
  projectAnalysisSchema,
  recordAnalysisInputSchema,
  recordAnalysisSchema,
  reportSummaryInputSchema,
  reportSummarySchema,
  transcriptionInputSchema,
  transcriptionSchema,
  actionFeedbackSchema,
  taskPlanInputSchema,
  taskPlanSchema,
  projectCategorySchema,
} from '@apple/contracts';
import { DomainError, isFeelingOnly } from '@apple/domain';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
import { createSessionService } from '../session/session.service.js';
import { createAiClient } from './ai.client.js';
import { reportDto } from '../garden/http-presenters.js';
import { registerEmotionRoutes } from './emotion.routes.js';

const pythonRecords = z.object({
  emotion_text: z.string().min(1).max(2000).nullable().default(null),
  items: z
    .array(
      z.object({
        content: z.string(),
        type: z.enum(['action', 'task', 'idea', 'goal']),
        project_id: z.string().nullable(),
        goal_id: z.string().nullable().default(null),
        emotion: z.string().nullable(),
        source_text: z.string(),
      }),
    )
    .max(50),
});
const pythonProjects = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string(),
        goal_text: z.string().nullable(),
        source_text: z.string(),
        category: projectCategorySchema.default('其他'),
      }),
    )
    .max(20),
});

export const registerAiRoutes: FastifyPluginAsync<{
  repository: GardenRepository;
  env: Env;
}> = async (app, { repository, env }) => {
  const sessions = createSessionService(repository, env);
  const call = createAiClient(env);
  const requests = new Map<string, { at: number; count: number }>();
  const summaries = new Map<string, { at: number; value: { summary: string } }>();
  const limit = (user: string) => {
    const now = Date.now();
    for (const [id, item] of requests) if (now - item.at >= 60_000) requests.delete(id);
    const item = requests.get(user) ?? { at: now, count: 0 };
    if (item.count >= 10)
      throw new DomainError('RATE_LIMITED', '操作有点频繁，请一分钟后再试', 429);
    item.count += 1;
    requests.set(user, item);
  };
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (
      request.method !== 'GET' &&
      origin &&
      origin !== env.CORS_ORIGIN &&
      origin !== `${request.protocol}://${request.headers.host}`
    )
      throw new DomainError('INVALID_ORIGIN', '请求来源不允许', 403);
  });
  app.get('/ai/capabilities', async (request) => {
    await sessions.require(request);
    try {
      const data = await call(
        '/capabilities',
        z.object({ aiConfigured: z.boolean(), asrEnabled: z.boolean() }),
      );
      return { ai_configured: data.aiConfigured, asr_enabled: data.asrEnabled };
    } catch {
      return { ai_configured: false, asr_enabled: false };
    }
  });
  app.post('/ai/projects/analyze', async (request) => {
    const user = await sessions.require(request);
    const body = projectAnalysisInputSchema.parse(request.body);
    limit(user);
    const result = await call('/projects/analyze', pythonProjects, body);
    const mapped = {
      candidates: result.candidates,
    };
    if (
      mapped.candidates.some((item) => !item.source_text || !body.text.includes(item.source_text))
    )
      throw new DomainError('AI_PARSE_FAILED', '草稿来源校验失败，请手动创建', 503);
    const parsed = projectAnalysisSchema.safeParse(mapped);
    if (!parsed.success)
      throw new DomainError('AI_PARSE_FAILED', '项目草稿校验失败，请手动创建', 503);
    return parsed.data;
  });
  app.post('/ai/records/analyze', async (request) => {
    const user = await sessions.require(request);
    const body = recordAnalysisInputSchema.parse(request.body);
    limit(user);
    if (isFeelingOnly(body.text)) return { items: [], emotion_text: body.text };
    const state = await repository.read(user);
    const projects = state.projects
      .filter((p) => p.status === 'active')
      .map((p) => ({
        id: p.id,
        name: p.name,
        goal: state.goals.find((g) => g.id === p.currentGoalId)?.title ?? null,
        goals: state.goals
          .filter((g) => g.projectId === p.id && !g.completedAt && !g.archivedAt)
          .map((g) => ({ id: g.id, title: g.title, mode: g.type, unit: g.unit })),
      }));
    const ids = new Set(projects.map((p) => p.id));
    const result = await call('/records/analyze', pythonRecords, { text: body.text, projects });
    const feelings = result.items.filter(
      (item) => isFeelingOnly(item.content) || isFeelingOnly(item.source_text),
    );
    const mapped = {
      emotion_text: result.emotion_text ?? feelings[0]?.source_text ?? null,
      items: result.items
        .filter((item) => !feelings.includes(item))
        .map((item) => ({
          content: item.content,
          type: item.type,
          client_item_id: randomUUID(),
          project_id: item.project_id && ids.has(item.project_id) ? item.project_id : null,
          goal_id:
            item.type === 'action' &&
            state.goals.some(
              (goal) =>
                goal.id === item.goal_id &&
                goal.projectId === item.project_id &&
                !goal.completedAt &&
                !goal.archivedAt,
            )
              ? item.goal_id
              : null,
          emotion: item.emotion,
          source_text: item.source_text,
        })),
    };
    if (
      (mapped.emotion_text && !body.text.includes(mapped.emotion_text)) ||
      mapped.items.some(
        (item) =>
          !item.source_text ||
          !body.text.includes(item.source_text) ||
          (['task', 'goal'].includes(item.type) && item.content.length > 200),
      )
    )
      throw new DomainError('AI_PARSE_FAILED', '记录草稿校验失败，请手动整理', 503);
    const parsed = recordAnalysisSchema.safeParse(mapped);
    if (!parsed.success)
      throw new DomainError('AI_PARSE_FAILED', '记录草稿校验失败，请手动整理', 503);
    return parsed.data;
  });
  app.post('/ai/tasks/plan', async (request) => {
    const user = await sessions.require(request);
    const body = taskPlanInputSchema.parse(request.body);
    const state = await repository.read(user);
    const project = state.projects.find(
      (item) => item.id === body.project_id && item.status === 'active',
    );
    if (!project) throw new DomainError('NOT_FOUND', '请先选择一个进行中的项目', 404);
    limit(user);
    return call('/tasks/plan', taskPlanSchema, { text: body.text, project_name: project.name });
  });
  app.post('/ai/reports/summarize', async (request) => {
    const user = await sessions.require(request);
    const { period } = reportSummaryInputSchema.parse(request.body);
    const state = await repository.read(user);
    const key = `${user}:${state.version}:${period}`;
    const cached = summaries.get(key);
    if (cached && Date.now() - cached.at < 600_000) return cached.value;
    const range = ({ '7天': '7d', '30天': '30d', 本月: 'month', 全部: 'all' } as const)[period];
    const report = reportDto(state, range);
    if (!report.action_count && !report.active_project_count && !report.new_result_count)
      return { summary: '还没有新的行动，从今天的一件小事开始吧。' };
    limit(user);
    const result = await call('/reports/summarize', reportSummarySchema, {
      period,
      action_count: report.action_count,
      active_count: report.active_project_count,
      result_count: report.new_result_count,
      projects: report.projects.map((p) => ({
        name: p.project_name,
        count: p.action_count,
      })),
    });
    for (const [id, item] of summaries) if (Date.now() - item.at >= 600_000) summaries.delete(id);
    if (summaries.size >= 200) summaries.delete(summaries.keys().next().value!);
    summaries.set(key, { at: Date.now(), value: result });
    return result;
  });
  const feedbackCache = new Map<string, { at: number; value: { text: string } }>();
  app.post('/ai/feedback', async (request) => {
    z.object({})
      .strict()
      .parse(request.body ?? {});
    const user = await sessions.require(request);
    const state = await repository.read(user);
    const actions = state.records
      .filter((item) => !item.deletedAt && item.type === 'action' && !isFeelingOnly(item.content))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((item) => item.content);
    const fallback = {
      text: actions.length
        ? '今天的努力已经好好记下了，按自己的节奏慢慢来。'
        : '每个想开始的方向，都值得被温柔照顾。',
    };
    if (!actions.length) return fallback;
    const key = `${user}:${state.version}`;
    const cached = feedbackCache.get(key);
    if (cached && Date.now() - cached.at < 600_000) return cached.value;
    limit(user);
    let value = fallback;
    try {
      value = await call('/feedback', actionFeedbackSchema, { actions });
    } catch {
      /* Feedback never blocks saved actions or navigation. */
    }
    for (const [id, item] of feedbackCache)
      if (Date.now() - item.at >= 600_000) feedbackCache.delete(id);
    if (feedbackCache.size >= 200) feedbackCache.delete(feedbackCache.keys().next().value!);
    feedbackCache.set(key, { at: Date.now(), value });
    return value;
  });
  app.post('/asr/transcribe', { bodyLimit: 7 * 1024 * 1024 }, async (request) => {
    const user = await sessions.require(request);
    const body = transcriptionInputSchema.parse(request.body);
    limit(user);
    return call('/asr/transcribe', transcriptionSchema, {
      audio_base64: body.audio_base64,
      mime_type: body.mime_type,
    });
  });
  await app.register(registerEmotionRoutes, { repository, env, limit });
};
