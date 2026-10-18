import type { FastifyPluginAsync } from 'fastify';
import { emotionChatInputSchema, emotionReplySchema, type EmotionChat } from '@apple/contracts';
import { dateInZone, isFeelingOnly } from '@apple/domain';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
import { createSessionService } from '../session/session.service.js';
import { createAiClient } from './ai.client.js';

/** Read-only companionship: no commands, record creation, or goal contribution in this route. */
export const registerEmotionRoutes: FastifyPluginAsync<{
  repository: GardenRepository;
  env: Env;
  limit: (user: string) => void;
}> = async (app, { repository, env, limit }) => {
  const sessions = createSessionService(repository, env);
  const call = createAiClient(env, 12_000);
  app.post('/ai/emotions/respond', async (request): Promise<EmotionChat> => {
    const user = await sessions.require(request);
    const body = emotionChatInputSchema.parse(request.body);
    limit(user);
    const state = await repository.read(user);
    const date = dateInZone(new Date(), state.timeZone);
    const actions = state.records
      .filter(
        (item) =>
          !item.deletedAt &&
          item.type === 'action' &&
          item.date === date &&
          !isFeelingOnly(item.content),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const today = {
      date,
      action_count: actions.length,
      actions: actions.slice(0, 6).map((item) => ({
        id: item.id,
        content: item.content,
        project_name: state.projects.find((project) => project.id === item.projectId)?.name ?? null,
      })),
    };
    const opening = /累|疲惫|疲倦|困/.test(body.text)
      ? '听起来你现在有些累。'
      : '你现在的感受，值得被认真听见。';
    const fallback = today.actions.length
      ? `${opening}今天的记录里还有「${today.actions[0]!.content.slice(0, 60)}」${actions.length > 1 ? '和其他小事' : ''}，这些付出不会因为此刻疲惫就消失。不用急着证明自己，先慢慢歇一会儿也可以。`
      : `${opening}今天还没有保存的行动记录，但没有记录不等于没有付出，也不用靠做了多少事来证明自己。如果愿意，可以慢慢说说今天的感受。`;
    try {
      const result = await call('/emotions/respond', emotionReplySchema, { ...body, today });
      const allowed = new Set(today.actions.map((action) => action.id));
      if (result.referenced_action_ids.some((id) => !allowed.has(id)))
        throw new Error('Unverified action reference');
      return {
        ...result,
        referenced_action_ids: [...new Set(result.referenced_action_ids)],
        today,
        mode: 'ai',
      };
    } catch {
      return {
        reply: fallback,
        referenced_action_ids: today.actions.slice(0, 1).map((action) => action.id),
        today,
        mode: 'fallback',
      };
    }
  });
};
