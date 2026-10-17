import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './http-utils.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { commitInputSchema, recordPatchSchema } from '@apple/contracts';
import { DomainError, dateInZone } from '@apple/domain';
import { recordDto, growthChanges, resultDto } from './http-presenters.js';
import {
  identifier,
  page,
  resourceId,
  idempotencyKey,
  validateDate,
  projectFor,
} from './http-utils.js';
export function registerRecordRoutes(app: FastifyInstance, { service, sessions }: RouteContext) {
  app.get('/records', async (request) => {
    const query = z
      .object({
        project_id: identifier.optional(),
        type: z.enum(['action', 'idea', 'goal']).optional(),
      })
      .parse(request.query);
    const state = await service.read(await sessions.require(request));
    if (query.project_id) projectFor(state, query.project_id);
    return page(
      state.records
        .filter(
          (item) =>
            !item.deletedAt &&
            (!query.project_id || item.projectId === query.project_id) &&
            (!query.type || item.type === query.type),
        )
        .map(recordDto),
      request.query,
      (item) => item.occurred_at,
      `records:${query.project_id || ''}:${query.type || ''}`,
    );
  });
  app.post('/record-batches/commit', async (request) => {
    const body = commitInputSchema.parse(request.body);
    body.items.forEach((item, index) => {
      try {
        validateDate(item.occurred_at);
      } catch (error) {
        if (error instanceof DomainError)
          Object.assign(error, {
            details: [
              {
                client_item_id: item.client_item_id,
                field: `items.${index}.occurred_at`,
                message: error.message,
              },
            ],
          });
        throw error;
      }
    });
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      'POST /record-batches/commit',
      request.body ?? {},
      (before, run, now) => {
        body.items.forEach((item, index) => {
          if (
            item.project_id &&
            !before.projects.some(
              (project) => project.id === item.project_id && project.status === 'active',
            )
          )
            throw Object.assign(
              new DomainError('VALIDATION_ERROR', '关联项目不存在或不可记录', 422),
              {
                details: [
                  {
                    client_item_id: item.client_item_id,
                    field: `items.${index}.project_id`,
                    message: '请选择自己的进行中项目',
                  },
                ],
              },
            );
        });
        const state = run({
          type: 'records.save',
          items: body.items.map((item) => ({
            content: item.content,
            projectId: item.project_id,
            type: item.type,
            date: dateInZone(item.occurred_at || now),
            dueDate: item.due_at ? dateInZone(item.due_at) : null,
            dueAt: item.due_at ?? null,
            occurredAt: item.occurred_at || now,
            source: body.source,
            sourceText: item.source_text,
            emotion: item.emotion,
            goalId: item.goal_id,
            contribution: item.contribution,
            goalType: 'manual',
            target: 1,
            unit: '',
          })),
        });
        const batchId = randomUUID();
        let recordIndex = before.records.length;
        let taskIndex = before.tasks.length;
        const savedItems = body.items.map((item) => ({
          client_item_id: item.client_item_id,
          id:
            item.type === 'task' ? state.tasks[taskIndex++]!.id : state.records[recordIndex++]!.id,
          type: item.type,
          project_id: item.project_id,
        }));
        (state.recordBatches ||= []).push({
          id: batchId,
          rawText: body.raw_text,
          source: body.source,
          itemIds: savedItems.map((item) => item.id),
          createdAt: now,
        });
        return {
          batch_id: batchId,
          saved_items: savedItems,
          growth_changes: growthChanges(before, state),
          completed_results: state.results
            .filter((item) => !before.results.some((old) => old.id === item.id))
            .map(resultDto),
          feedback_text: '记录已保存，每一步都算数。',
        };
      },
    );
  });
  app.patch('/records/:id', async (request) => {
    const id = resourceId(request);
    const body = recordPatchSchema.parse(request.body);
    validateDate(body.occurred_at);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `PATCH /records/${id}`,
      request.body ?? {},
      (initial, run) => {
        const record = initial.records.find((item) => item.id === id && !item.deletedAt);
        if (!record) throw new DomainError('NOT_FOUND', '记录不存在', 404);
        const occurredAt = body.occurred_at || recordDto(record).occurred_at;
        const state = run({
          type: 'record.update',
          id,
          content: body.content ?? record.content,
          recordType: body.type ?? record.type,
          projectId: body.project_id === undefined ? record.projectId : body.project_id,
          date: dateInZone(occurredAt),
          contribution:
            (body.project_id === undefined || body.project_id === record.projectId) &&
            (body.type === undefined || body.type === record.type)
              ? record.contribution
              : 0,
        });
        const updated = state.records.find((item) => item.id === id)!;
        Object.assign(updated, {
          source: record.source,
          sourceText: record.sourceText,
          emotion: record.emotion,
          occurredAt,
        });
        return { record: recordDto(updated), growth_changes: growthChanges(initial, state) };
      },
    );
  });
  app.delete('/records/:id', async (request) => {
    const id = resourceId(request);
    return service.write(
      await sessions.require(request),
      idempotencyKey(request),
      `DELETE /records/${id}`,
      {},
      (initial, run) => ({
        deleted: true,
        growth_changes: growthChanges(initial, run({ type: 'record.delete', id })),
      }),
    );
  });
}
