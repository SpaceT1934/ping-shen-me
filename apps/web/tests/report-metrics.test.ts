import { expect, it } from 'vitest';
import { emptyGarden } from '@apple/domain';
import type { Entry, Result, Goal } from '@apple/contracts';
import { periodMetrics, periodChange } from '../src/lib/garden/report-metrics';

it('报告按上海时间边界统计真实行动、已摘果实和独立项目，未摘果实不计入收获', () => {
  const state = emptyGarden();
  state.records = [
    {
      id: 'a',
      type: 'action',
      projectId: 'p1',
      occurredAt: '2026-10-17T00:00:00+08:00',
      deletedAt: null,
    },
    {
      id: 'b',
      type: 'action',
      projectId: 'p1',
      occurredAt: '2026-10-17T22:00:00+08:00',
      deletedAt: null,
    },
    {
      id: 'c',
      type: 'action',
      projectId: 'p2',
      occurredAt: '2026-10-18T00:00:00+08:00',
      deletedAt: null,
    },
    {
      id: 'd',
      type: 'action',
      projectId: 'p2',
      occurredAt: '2026-10-17T10:00:00+08:00',
      deletedAt: '2026-10-17T11:00:00Z',
    },
  ] as Entry[];
  state.results = [{ harvestedAt: null }, { harvestedAt: '2026-10-17T12:00:00+08:00' }] as Result[];
  state.goals = [{ completedAt: '2026-10-17T11:00:00+08:00', archivedAt: null }] as Goal[];
  expect(periodMetrics(state, '2026-10-17T00:00:00+08:00', '2026-10-18T00:00:00+08:00')).toEqual([
    2, 1, 1, 1,
  ]);
  expect(periodChange(2, 0)).toBe('本期新增');
  expect(periodChange(2, 4)).toBe('较上期 -50%');
  expect(periodChange(0, 0)).toBe('与上期持平');
});
