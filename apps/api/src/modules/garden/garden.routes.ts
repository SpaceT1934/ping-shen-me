import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { legacyImportSchema } from '@apple/contracts';
import { DomainError } from '@apple/domain';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
import { createResourceService } from './resource.service.js';
import { createSessionService } from '../session/session.service.js';
import { bootstrapDto } from './http-presenters.js';
import { objectBody, idempotencyKey } from './http-utils.js';
import { registerProjectRoutes } from './project.routes.js';
import { registerRecordRoutes } from './record.routes.js';
import { registerTaskRoutes } from './task.routes.js';
import { registerGoalRoutes } from './goal.routes.js';
import { registerResultRoutes } from './result.routes.js';
import { registerReportRoutes } from './report.routes.js';
export const registerGardenRoutes: FastifyPluginAsync<{
  repository: GardenRepository;
  env: Env;
}> = async (app, { repository, env }) => {
  const service = createResourceService(repository);
  const sessions = createSessionService(repository, env);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    const ownOrigin = `${request.protocol}://${request.headers.host}`;
    if (request.method !== 'GET' && origin && origin !== env.CORS_ORIGIN && origin !== ownOrigin)
      throw new DomainError('INVALID_ORIGIN', '请求来源不允许', 403);
  });
  app.post('/session', async (request, reply) => {
    objectBody.parse(request.body ?? {});
    const userId = await sessions.start(request, reply);
    return { mode: 'anonymous', ...bootstrapDto(await service.read(userId)) };
  });
  app.get('/bootstrap', async (request) =>
    bootstrapDto(await service.read(await sessions.require(request))),
  );
  app.get('/exports/garden', async (request) => {
    const state = await service.read(await sessions.require(request));
    const snake = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(snake);
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [
            key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
            snake(child),
          ]),
        );
      return value;
    };
    return snake({ ...state, operations: [] });
  });
  app.patch('/onboarding', async (request) => {
    z.object({ onboarding_completed: z.literal(true) })
      .strict()
      .parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      'PATCH /onboarding',
      request.body ?? {},
      (_state, run) => bootstrapDto(run({ type: 'onboard' })),
    );
  });
  // Preserve one-time imports of browser prototypes, without exposing the old command API.
  app.post('/imports/legacy', async (request) => {
    const body = legacyImportSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      'POST /imports/legacy',
      request.body ?? {},
      (_state, run) =>
        bootstrapDto(
          run({
            type: 'import.legacy',
            legacy: {
              projects: body.legacy.projects,
              tasks: body.legacy.tasks.map((item) => ({
                id: item.id,
                projectId: item.project_id,
                title: item.title,
                when: item.when,
                done: item.done,
              })),
              entries: body.legacy.entries.map((item) => ({
                id: item.id,
                projectId: item.project_id,
                content: item.content,
                type: item.type,
                date: item.date,
                taskId: item.task_id,
              })),
            },
            onboardingCompleted: body.onboarding_completed,
          }),
        ),
    );
  });

  registerProjectRoutes(app, { service, sessions });
  registerRecordRoutes(app, { service, sessions });
  registerTaskRoutes(app, { service, sessions });
  registerGoalRoutes(app, { service, sessions });
  registerResultRoutes(app, { service, sessions });
  registerReportRoutes(app, { service, sessions });
};
