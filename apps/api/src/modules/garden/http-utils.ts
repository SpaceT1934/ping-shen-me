import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { GardenState } from '@apple/contracts';
import { DomainError } from '@apple/domain';
import type { createResourceService } from './resource.service.js';
import type { createSessionService } from '../session/session.service.js';
export type RouteContext = {
  service: ReturnType<typeof createResourceService>;
  sessions: ReturnType<typeof createSessionService>;
};
export const identifier = z.string().min(1).max(100);
const pageQuery = z.object({
  cursor: z.string().max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const resourceId = (request: FastifyRequest) =>
  identifier.parse((request.params as { id?: string }).id);
export const objectBody = z.object({}).strict();
export function idempotencyKey(request: FastifyRequest) {
  const parsed = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[\x21-\x7e]+$/)
    .safeParse(request.headers['idempotency-key']);
  if (!parsed.success)
    throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', '写入请求需要 Idempotency-Key 请求头', 400);
  return parsed.data;
}
export function page<T extends { id: string }>(
  items: T[],
  query: unknown,
  at: (item: T) => string,
  scope: string,
) {
  const { cursor, limit } = pageQuery.parse(query);
  let marker: { at: number; id: string; scope: string } | null = null;
  if (cursor) {
    try {
      marker = z
        .object({ at: z.number(), id: identifier, scope: z.literal(scope) })
        .parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    } catch {
      throw new DomainError('INVALID_CURSOR', '分页游标无效，请从第一页重新读取', 400);
    }
  }
  const sorted = [...items].sort(
    (a, b) => Date.parse(at(b)) - Date.parse(at(a)) || b.id.localeCompare(a.id),
  );
  const remaining = marker
    ? sorted.filter(
        (item) =>
          Date.parse(at(item)) < marker!.at ||
          (Date.parse(at(item)) === marker!.at && item.id.localeCompare(marker!.id) < 0),
      )
    : sorted;
  const selected = remaining.slice(0, limit);
  const last = selected[selected.length - 1];
  return {
    items: selected,
    next_cursor:
      remaining.length > limit && last
        ? Buffer.from(JSON.stringify({ at: Date.parse(at(last)), id: last.id, scope })).toString(
            'base64url',
          )
        : null,
  };
}
export function projectFor(state: GardenState, id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) throw new DomainError('NOT_FOUND', '项目不存在', 404);
  return project;
}
export function validateDate(at: string | undefined) {
  if (at && Date.parse(at) > Date.now())
    throw new DomainError('VALIDATION_ERROR', '已发生的记录不能填写未来时间', 422);
}
