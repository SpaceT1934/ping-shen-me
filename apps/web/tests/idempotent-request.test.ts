import { afterEach, expect, it, vi } from 'vitest';
import type { CommandEnvelope } from '@apple/contracts';
import { gardenApi } from '../src/lib/garden/garden-api';
import { finishOperation } from '../src/lib/garden/request-operations';
const operationId = '0976c112-7ed6-4074-9af4-5e5f9cf5971d';
afterEach(() => {
  finishOperation(operationId);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('保存结果未知且跨过午夜后重试，沿用原始正文和幂等头', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T10:00:00+08:00'));
  const requests: RequestInit[] = [];
  const ok = (data: unknown) =>
    new Response(JSON.stringify({ code: 'OK', data, request_id: 'test' }), { status: 200 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/v1/record-batches/commit') {
        requests.push(init);
        if (requests.length === 1) throw new Error('响应在网络中丢失');
        return ok({
          batch_id: 'b1',
          saved_items: [
            { client_item_id: operationId + ':0', id: 'r1', type: 'action', project_id: null },
          ],
          growth_changes: [],
          completed_results: [],
          feedback_text: '已保存',
        });
      }
      if (path === '/api/v1/bootstrap')
        return ok({ onboarding_completed: true, version: 1, projects: [] });
      return ok({ items: [], next_cursor: null });
    }),
  );
  const command: CommandEnvelope = {
    operationId,
    expectedVersion: 0,
    command: {
      type: 'records.save',
      rawText: '原始文字',
      items: [
        {
          content: '完成一件事',
          projectId: null,
          type: 'action',
          date: '2026-10-14',
          dueDate: null,
          contribution: 0,
          goalType: 'manual',
          target: 1,
          unit: '',
        },
      ],
    },
  };
  await expect(gardenApi.mutate(command)).rejects.toThrow('连接暂时中断');
  vi.setSystemTime(new Date('2026-10-15T10:00:00+08:00'));
  await gardenApi.mutate(command);
  expect(requests[1]!.body).toBe(requests[0]!.body);
  expect(requests[1]!.headers).toEqual(requests[0]!.headers);
  expect(JSON.parse(String(requests[1]!.body)).items[0]).not.toHaveProperty('occurred_at');
});
