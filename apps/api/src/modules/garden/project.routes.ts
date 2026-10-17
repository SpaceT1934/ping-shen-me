import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { z } from 'zod';
import { projectBatchSchema, projectPatchSchema } from '@apple/contracts';
import { projectDto } from './http-presenters.js';
import { page, resourceId, idempotencyKey, projectFor } from './http-utils.js';
export function registerProjectRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.get('/projects', async (request) => {
    const query = z
      .object({ status: z.enum(['active', 'completed', 'archived', 'all']).default('active') })
      .parse(request.query);
    const state = await service.read(await sessions.require(request));
    return page(
      state.projects
        .filter((item) => query.status === 'all' || item.status === query.status)
        .map((item) => projectDto(state, item)),
      request.query,
      (item) => item.created_at,
      `projects:${query.status}`,
    );
  });
  app.get('/projects/:id', async (request) => {
    const state = await service.read(await sessions.require(request));
    return { project: projectDto(state, projectFor(state, resourceId(request))) };
  });
  app.post('/projects/batch', async (request) => {
    const body = projectBatchSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      'POST /projects/batch',
      request.body ?? {},
      (_state, run) => {
        const projects = body.projects.map((item) => {
          const state = run({
            type: 'project.create',
            name: item.name,
            icon: item.icon,
            color: item.color,
            goal: item.goal
              ? {
                  title: item.goal.title,
                  type: item.goal.mode === 'percent' ? 'percentage' : item.goal.mode,
                  target: item.goal.mode === 'manual' ? 1 : (item.goal.target_value ?? 100),
                  unit: item.goal.unit,
                }
              : null,
          });
          return {
            ...projectDto(state, state.projects[state.projects.length - 1]!),
            client_item_id: item.client_item_id,
          };
        });
        return { projects };
      },
    );
  });
  app.patch('/projects/:id', async (request) => {
    const id = resourceId(request);
    const body = projectPatchSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `PATCH /projects/${id}`,
      request.body ?? {},
      (initial, run) => {
        const project = projectFor(initial, id);
        let state = initial;
        if (body.name !== undefined || body.icon !== undefined || body.color !== undefined)
          state = run({
            type: 'project.update',
            id,
            name: body.name ?? project.name,
            icon: body.icon ?? project.icon,
            color: body.color ?? project.color,
          });
        if (body.current_goal_id)
          state = run({ type: 'goal.primary', projectId: id, goalId: body.current_goal_id });
        if (body.tree_stage_threshold)
          state = run({ type: 'project.threshold', id, threshold: body.tree_stage_threshold });
        if (body.status) state = run({ type: 'project.status', id, status: body.status });
        return { project: projectDto(state, projectFor(state, id)) };
      },
    );
  });
}
