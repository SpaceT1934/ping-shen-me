import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { z } from 'zod';
import { taskInputSchema } from '@apple/contracts';
import { dateInZone } from '@apple/domain';
import { taskDto, recordDto, growthChanges } from './http-presenters.js';
import { page, resourceId, idempotencyKey, projectFor, objectBody } from './http-utils.js';
export function registerTaskRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.get('/tasks', async (request) => {
    const state = await service.read(await sessions.require(request));
    return page(
      state.tasks.filter((item) => !item.deletedAt).map(taskDto),
      request.query,
      (item) => item.created_at,
      'tasks:all',
    );
  });
  app.get('/projects/:id/tasks', async (request) => {
    const id = resourceId(request);
    const query = z
      .object({ status: z.enum(['pending', 'completed', 'all']).default('all') })
      .parse(request.query);
    const state = await service.read(await sessions.require(request));
    projectFor(state, id);
    return page(
      state.tasks
        .filter(
          (item) =>
            item.projectId === id &&
            !item.deletedAt &&
            (query.status === 'all' ||
              Boolean(item.completedAt) === (query.status === 'completed')),
        )
        .map(taskDto),
      request.query,
      (item) => item.created_at,
      `tasks:${id}:${query.status}`,
    );
  });
  app.post('/projects/:id/tasks', async (request) => {
    const id = resourceId(request);
    const body = taskInputSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `POST /projects/${id}/tasks`,
      request.body ?? {},
      (_state, run) => {
        const state = run({
          type: 'task.create',
          projectId: id,
          title: body.content,
          dueDate: body.due_at ? dateInZone(body.due_at) : null,
        });
        const task = state.tasks[state.tasks.length - 1]!;
        task.dueAt = body.due_at ?? null;
        return { task: taskDto(task) };
      },
    );
  });
  app.patch('/tasks/:id', async (request) => {
    const id = resourceId(request);
    const body = taskInputSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `PATCH /tasks/${id}`,
      request.body ?? {},
      (_state, run) => {
        const state = run({
          type: 'task.update',
          id,
          title: body.content,
          dueDate: body.due_at ? dateInZone(body.due_at) : null,
        });
        const task = state.tasks.find((item) => item.id === id)!;
        task.dueAt = body.due_at ?? null;
        return { task: taskDto(task) };
      },
    );
  });
  for (const action of ['complete', 'reopen'] as const)
    app.post(`/tasks/:id/${action}`, async (request) => {
      const id = resourceId(request);
      objectBody.parse(request.body ?? {});
      return service.write(
        await sessions.require(request),
        idempotencyKey(request),
        `POST /tasks/${id}/${action}`,
        {},
        (before, run) => {
          const state = run({ type: 'task.complete', id, completed: action === 'complete' });
          const task = state.tasks.find((item) => item.id === id)!;
          const record = state.records.find((item) => item.id === task.actionId && !item.deletedAt);
          return {
            task: taskDto(task),
            action: record ? recordDto(record) : null,
            growth_changes: growthChanges(before, state),
            completed_results: [],
          };
        },
      );
    });
  app.delete('/tasks/:id', async (request) => {
    const id = resourceId(request);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `DELETE /tasks/${id}`,
      {},
      (_state, run) => {
        run({ type: 'task.delete', id });
        return { deleted: true };
      },
    );
  });
}
