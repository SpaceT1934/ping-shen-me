import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@apple/contracts';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
import { createAiClient } from '../ai/ai.client.js';
import { z } from 'zod';
export const registerHealthRoutes: FastifyPluginAsync<{
  repository: GardenRepository;
  env: Env;
}> = async (app, { repository, env }) => {
  app.get('/health', async (): Promise<HealthResponse> => ({ status: 'ok', service: 'apple-api' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await repository.probe();
    } catch {
      return reply.status(503).send({
        code: 'DATABASE_UNAVAILABLE',
        message: '数据库暂时不可用',
        request_id: _request.id,
      });
    }
    if (env.AI_REQUIRED_ON_DEPLOY) {
      try {
        const capability = await createAiClient(env, 2000)(
          '/capabilities',
          z.object({ aiConfigured: z.boolean(), asrEnabled: z.boolean() }),
        );
        if (!capability.aiConfigured) throw new Error('not configured');
      } catch {
        return reply
          .status(503)
          .send({ code: 'AI_NOT_READY', message: 'AI 服务尚未就绪', request_id: _request.id });
      }
    }
    return {
      status: 'ok',
      database: 'connected',
      driver: repository.driver,
      ...(env.AI_REQUIRED_ON_DEPLOY ? { ai_service: 'connected' } : {}),
    };
  });
};
