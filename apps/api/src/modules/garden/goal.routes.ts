import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { goalCreateSchema, progressInputSchema } from '@apple/contracts';
import { DomainError } from '@apple/domain';
import { goalDto, projectDto, resultDto } from './http-presenters.js';
import { resourceId, idempotencyKey, projectFor } from './http-utils.js';
export function registerGoalRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.post('/projects/:id/goals', async (request) => {
    const id = resourceId(request);
    const body = goalCreateSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `POST /projects/${id}/goals`,
      request.body ?? {},
      (_state, run) => {
        const state = run({
          type: 'goal.create',
          projectId: id,
          replace: false,
          goal: {
            title: body.title,
            type: body.mode === 'percent' ? 'percentage' : body.mode,
            target: body.target_value ?? 1,
            unit: body.unit,
          },
        });
        const project = projectFor(state, id);
        const goal = state.goals.at(-1)!;
        return { goal: goalDto(goal), project: projectDto(state, project) };
      },
    );
  });
  app.patch('/goals/:id/progress', async (request) => {
    const id = resourceId(request);
    const body = progressInputSchema.parse(request.body);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `PATCH /goals/${id}/progress`,
      request.body ?? {},
      (before, run) => {
        const goal = before.goals.find((item) => item.id === id);
        if (!goal) throw new DomainError('NOT_FOUND', '目标不存在', 404);
        if (
          (goal.type === 'manual' &&
            (body.completed !== true || body.current_value !== undefined)) ||
          (goal.type !== 'manual' &&
            (body.current_value === undefined || body.completed !== undefined))
        )
          throw new DomainError(
            'VALIDATION_ERROR',
            goal.type === 'manual'
              ? '手动目标使用 completed=true'
              : '数量和百分比目标使用 current_value',
            422,
          );
        const state = run({
          type: 'goal.progress',
          id,
          value: goal.type === 'manual' ? 1 : body.current_value!,
        });
        return {
          goal: goalDto(state.goals.find((item) => item.id === id)!),
          project: projectDto(state, projectFor(state, goal.projectId)),
          completed_results: state.results
            .filter((item) => !before.results.some((old) => old.id === item.id))
            .map(resultDto),
        };
      },
    );
  });
}
