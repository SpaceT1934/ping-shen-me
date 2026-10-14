import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { z } from 'zod';
import { resultDto } from './http-presenters.js';
import {
  identifier,
  page,
  resourceId,
  idempotencyKey,
  projectFor,
  objectBody,
} from './http-utils.js';
export function registerResultRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.get('/results', async (request) => {
    const query = z.object({ project_id: identifier.optional() }).parse(request.query);
    const state = await service.read(await sessions.require(request));
    if (query.project_id) projectFor(state, query.project_id);
    return page(
      state.results
        .filter((item) => !query.project_id || item.projectId === query.project_id)
        .map(resultDto),
      request.query,
      (item) => item.completed_at,
      `results:${query.project_id || ''}`,
    );
  });
  app.post('/results/:id/harvest', async (request) => {
    const id = resourceId(request);
    objectBody.parse(request.body ?? {});
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `POST /results/${id}/harvest`,
      {},
      (_state, run) => {
        const state = run({ type: 'result.harvest', id, followUp: 'continue' });
        return { result: resultDto(state.results.find((item) => item.id === id)!) };
      },
    );
  });
}
