import { afterEach, expect, it, vi } from 'vitest';
import { gardenApi } from '../src/lib/garden/garden-api';
import { createGardenView } from '../src/lib/garden/view-model';
const at = '2026-10-17T00:00:00Z';
const goal = (id: string, current = 0) => ({
  id,
  project_id: 'p1',
  title: id,
  mode: 'count',
  current_value: current,
  target_value: 2,
  status: 'active',
  completed_at: null,
  created_at: at,
  unit: '条',
});
const project = {
  id: 'p1',
  name: '视频',
  status: 'active',
  goal: goal('g1'),
  goals: [goal('g1'), goal('g2', 1)],
  growth: {
    action_count: 1,
    harvest_count: 1,
    tree_stage_threshold: 1,
    stage: 1,
    stage_key: 'stage_1',
  },
  created_at: at,
  icon: 'video',
  color: 'sage',
};
const ok = (data: unknown) =>
  new Response(JSON.stringify({ code: 'OK', data, request_id: 'test' }));
afterEach(() => vi.unstubAllGlobals());
it('保存非主要目标的贡献并重新读取，保留所有目标、关联记录及独立收获阶段', async () => {
  let saved: Record<string, unknown> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/v1/record-batches/commit') {
        saved = JSON.parse(String(init.body));
        return ok({
          batch_id: 'b1',
          saved_items: [],
          growth_changes: [],
          completed_results: [],
          feedback_text: '已保存',
        });
      }
      if (path === '/api/v1/bootstrap')
        return ok({ onboarding_completed: true, version: 5, projects: [project] });
      const items = path.startsWith('/api/v1/projects?')
        ? [project]
        : path.startsWith('/api/v1/records?')
          ? [
              {
                id: 'r1',
                project_id: 'p1',
                type: 'action',
                content: '发布一条视频',
                source_text: null,
                source: 'text',
                emotion: null,
                occurred_at: at,
                created_at: at,
                source_task_id: null,
                goal_id: 'g2',
                contribution: 1,
              },
            ]
          : path.startsWith('/api/v1/results?')
            ? [
                {
                  id: 'old-result',
                  project_id: 'p1',
                  goal_id: 'old-goal',
                  title: '历史目标',
                  completed_at: at,
                  harvested_at: at,
                  days_to_complete: 1,
                  action_count: 1,
                  idea_count: 0,
                },
              ]
            : [];
      return ok({ items, next_cursor: null });
    }),
  );
  const response = await gardenApi.mutate({
    operationId: '615f012d-7b8f-4ffa-902c-26f8f04bf31d',
    expectedVersion: 4,
    command: {
      type: 'records.save',
      items: [
        {
          content: '发布一条视频',
          projectId: 'p1',
          goalId: 'g2',
          type: 'action',
          date: '2026-10-17',
          dueDate: null,
          contribution: 1,
          goalType: 'manual',
          target: 1,
          unit: '',
        },
      ],
    },
  });
  expect(saved.items).toMatchObject([{ goal_id: 'g2', contribution: 1, progress_confirmed: true }]);
  expect(response.state.goals).toHaveLength(2);
  expect(response.state.records[0]).toMatchObject({ goalId: 'g2', contribution: 1 });
  expect(createGardenView(response.state).projects[0]!.growth).toMatchObject({
    harvestCount: 1,
    stageIndex: 1,
    threshold: 1,
  });
});
it('创建项目和首个目标使用一个原子请求，避免半成品项目', async () => {
  const writes: Array<{ path: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      if (init.method === 'POST') {
        writes.push({ path, body: JSON.parse(String(init.body)) });
        return ok({ projects: [project] });
      }
      if (path === '/api/v1/bootstrap')
        return ok({ onboarding_completed: true, version: 1, projects: [project] });
      return ok({
        items: path.startsWith('/api/v1/projects?') ? [project] : [],
        next_cursor: null,
      });
    }),
  );
  await gardenApi.mutate({
    operationId: '2bc60c9d-dae2-4437-b87a-9e49f8d4dd1d',
    expectedVersion: 0,
    command: {
      type: 'project.create',
      name: '视频',
      icon: 'video',
      color: 'sage',
      goal: { title: '发布2条视频', type: 'count', target: 2, unit: '条' },
    },
  });
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    path: '/api/v1/projects/batch',
    body: { projects: [{ goal: { title: '发布2条视频', target_value: 2 } }] },
  });
});
