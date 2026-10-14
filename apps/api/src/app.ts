import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { Env } from './config/env.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';
import { DomainError } from '@apple/domain';
import { createGardenRepository } from './repositories/sql-garden.repository.js';
import { registerGardenRoutes } from './modules/garden/garden.routes.js';
import { registerAiRoutes } from './modules/ai/ai.routes.js';

export async function buildApp(env: Env) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    bodyLimit: 1024 * 1024,
  });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(helmet);
  await app.register(cookie);
  const repository = await createGardenRepository(env);
  app.addHook('onClose', async () => repository.close());

  app.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode >= 400) return payload;
    return { code: 'OK', data: payload, request_id: request.id };
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError || error instanceof ZodError) {
      const domain = error instanceof DomainError;
      const body = request.body as
        | { items?: { client_item_id?: string }[]; projects?: { client_item_id?: string }[] }
        | undefined;
      const details =
        error instanceof ZodError
          ? error.issues.map((issue) => {
              const index = typeof issue.path[1] === 'number' ? issue.path[1] : undefined;
              const items = issue.path[0] === 'projects' ? body?.projects : body?.items;
              return {
                field: issue.path.join('.'),
                message: issue.message,
                ...(index === undefined || !items?.[index]?.client_item_id
                  ? {}
                  : { client_item_id: items[index]!.client_item_id }),
              };
            })
          : 'details' in error
            ? error.details
            : undefined;
      return reply.status(domain ? error.statusCode : 422).send({
        code: domain
          ? error.code === 'GOAL_EXISTS'
            ? 'ACTIVE_GOAL_EXISTS'
            : error.code
          : 'VALIDATION_ERROR',
        message: domain ? error.message : '请检查输入内容和日期',
        ...(details ? { details } : {}),
        request_id: request.id,
      });
    }
    const status =
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;
    if (status >= 500) request.log.error({ err: error }, '请求处理失败');
    reply.status(status).send({
      code: status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: status >= 500 ? '服务暂时不可用' : '请求参数无效',
      request_id: request.id,
    });
  });
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ code: 'NOT_FOUND', message: '接口不存在', request_id: request.id });
  });

  await app.register(registerHealthRoutes, { prefix: '/api/v1', repository, env });
  await app.register(registerGardenRoutes, { prefix: '/api/v1', repository, env });
  await app.register(registerAiRoutes, { prefix: '/api/v1', repository, env });
  return app;
}
