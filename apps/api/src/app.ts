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

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError || error instanceof ZodError) {
      const domain = error instanceof DomainError;
      return reply.status(domain ? error.statusCode : 400).send({
        error: {
          code: domain ? error.code : 'VALIDATION_ERROR',
          message: domain ? error.message : '请检查输入内容和日期',
          requestId: request.id,
        },
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
      error: {
        code: status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
        message: status >= 500 ? '服务暂时不可用' : '请求参数无效',
        requestId: request.id,
      },
    });
  });
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: '接口不存在', requestId: request.id },
    });
  });

  await app.register(registerHealthRoutes, { prefix: '/api/v1', repository });
  await app.register(registerGardenRoutes, { prefix: '/api/v1', repository, env });
  return app;
}
