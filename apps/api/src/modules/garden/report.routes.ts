import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { z } from 'zod';
import { rangeSchema } from '@apple/contracts';
import { reportDto } from './http-presenters.js';
export function registerReportRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.get('/reports', async (request) => {
    const { range } = z.object({ range: rangeSchema.default('7d') }).parse(request.query);
    return reportDto(await service.read(await sessions.require(request)), range);
  });
}
