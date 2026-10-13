import type { FastifyPluginAsync } from 'fastify';
import { commandSchema } from '@apple/contracts';
import { z } from 'zod';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
import { createGardenService } from './garden.service.js';
import { createSessionService } from '../session/session.service.js';
export const registerGardenRoutes: FastifyPluginAsync<{
  repository: GardenRepository;
  env: Env;
}> = async (app, { repository, env }) => {
  const service = createGardenService(repository);
  const sessions = createSessionService(repository, env);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    const ownOrigin = `${request.protocol}://${request.headers.host}`;
    if (request.method !== 'GET' && origin && origin !== env.CORS_ORIGIN && origin !== ownOrigin) {
      reply.status(403).send({
        error: { code: 'INVALID_ORIGIN', message: '请求来源不允许', requestId: request.id },
      });
    }
  });
  app.post('/session', async (request, reply) => ({
    mode: 'anonymous',
    state: await service.read(await sessions.start(request, reply)),
  }));
  app.get('/garden', async (request) => service.read(await sessions.require(request)));
  app.post('/garden/commands', async (request) =>
    service.mutate(await sessions.require(request), commandSchema.parse(request.body)),
  );
  app.get('/reports', async (request) => {
    const query = z
      .object({ period: z.enum(['7天', '30天', '本月', '全部']).default('7天') })
      .parse(request.query);
    return service.report(await sessions.require(request), query.period);
  });
};
