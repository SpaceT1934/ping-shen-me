import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp(readEnv({ NODE_ENV: 'test' }));
}, 30000);
afterAll(async () => {
  await app?.close();
});
async function session() {
  const response = await app.inject({ method: 'POST', url: '/api/v1/session', payload: {} });
  expect(response.statusCode).toBe(200);
  expect(response.json().code).toBe('OK');
  const raw = response.headers['set-cookie'];
  return String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;
}
async function write(
  cookie: string,
  path: string,
  payload: Record<string, unknown> = {},
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  key: string = randomUUID(),
) {
  return app.inject({
    method,
    url: '/api/v1' + path,
    headers: { cookie, 'idempotency-key': key },
    ...(method === 'DELETE' ? {} : { payload }),
  });
}
async function read(cookie: string, path: string) {
  return app.inject({ url: '/api/v1' + path, headers: { cookie } });
}
async function setup(name = '学习') {
  const cookie = await session();
  const response = await write(cookie, '/projects/batch', {
    projects: [{ client_item_id: 'p1', name }],
  });
  expect(response.statusCode).toBe(200);
  return { cookie, project: response.json().data.projects[0] };
}
const item = (projectId: string | null, type = 'action', clientId = 'i1') => ({
  client_item_id: clientId,
  content: '做了一件事',
  type,
  project_id: projectId,
  emotion: null,
  source_text: '今天做了一件事',
});
describe('文档 V0.2 REST 联调', () => {
  it('新版分类与暂缓状态保存在服务端，暂缓时不能记入行动，恢复后可继续', async () => {
    const cookie = await session();
    const response = await write(cookie, '/projects/batch', {
      projects: [{ client_item_id: 'new-category', name: '新'.repeat(120), category: '个人创作' }],
    });
    expect(response.statusCode).toBe(200);
    const project = response.json().data.projects[0];
    expect(project.category).toBe('个人创作');
    expect(
      (
        await write(
          cookie,
          `/projects/${project.id}`,
          { status: 'paused', category: '兴趣爱好' },
          'PATCH',
        )
      ).statusCode,
    ).toBe(200);
    const paused = (await read(cookie, `/projects/${project.id}`)).json().data.project;
    expect(paused).toMatchObject({ status: 'paused', category: '兴趣爱好' });
    expect((await read(cookie, '/projects?status=paused')).json().data.items).toHaveLength(1);
    expect(
      (await write(cookie, '/record-batches/commit', { items: [item(project.id)] })).statusCode,
    ).toBe(422);
    expect((await read(cookie, '/records')).json().data.items).toHaveLength(0);
    await write(cookie, `/projects/${project.id}`, { status: 'active' }, 'PATCH');
    expect(
      (await write(cookie, '/record-batches/commit', { items: [item(project.id)] })).statusCode,
    ).toBe(200);
  });
  it('统一响应与会话、bootstrap；旧命令接口不再公开', async () => {
    expect((await app.inject({ url: '/api/v1/bootstrap' })).statusCode).toBe(401);
    const cookie = await session();
    const response = await read(cookie, '/bootstrap');
    expect(response.json()).toMatchObject({
      code: 'OK',
      data: { onboarding_completed: false, projects: [] },
      request_id: expect.any(String),
    });
    expect((await read(cookie, '/garden')).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/garden/commands', payload: {} }))
        .statusCode,
    ).toBe(404);
  });
  it('项目批量创建原子提交、同名冲突不留下半批数据', async () => {
    const { cookie, project } = await setup();
    const failed = await write(cookie, '/projects/batch', {
      projects: [
        { client_item_id: 'p2', name: '新方向' },
        { client_item_id: 'p3', name: '学习' },
      ],
    });
    expect(failed.statusCode).toBe(409);
    expect((await read(cookie, '/projects?status=all')).json().data.items).toHaveLength(1);
    const detail = (await read(cookie, `/projects/${project.id}`)).json().data.project;
    expect(detail.goal).toBeNull();
    expect(detail.growth).toEqual({
      action_count: 0,
      harvest_count: 0,
      tree_stage_threshold: 3,
      stage: 0,
      stage_key: 'stage_0',
    });
  });
  it('写入需要幂等头，同 key 返回原始结果，修改正文会冲突', async () => {
    const { cookie, project } = await setup();
    const key: string = randomUUID();
    const body = { raw_text: '原文', source: 'text', items: [item(project.id)] };
    const first = await write(cookie, '/record-batches/commit', body, 'POST', key);
    expect(first.statusCode).toBe(200);
    await write(cookie, '/record-batches/commit', {
      ...body,
      items: [item(project.id, 'action', 'i2')],
    });
    const replay = await write(cookie, '/record-batches/commit', body, 'POST', key);
    expect(replay.json().data).toEqual(first.json().data);
    expect((await read(cookie, '/records')).json().data.items).toHaveLength(2);
    expect(
      (
        await write(
          cookie,
          '/record-batches/commit',
          { ...body, raw_text: '另一个原文' },
          'POST',
          key,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/projects/batch',
          headers: { cookie },
          payload: { projects: [{ client_item_id: 'p2', name: '第二个' }] },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('行动/计划/灵感/目标建议整批保存，只有关联行动成长，不自动创建目标', async () => {
    const { cookie, project } = await setup();
    const response = await write(cookie, '/record-batches/commit', {
      raw_text: '完整原文',
      source: 'text',
      items: [
        item(project.id),
        item(project.id, 'task', 'i2'),
        item(null, 'idea', 'i3'),
        item(null, 'goal', 'i4'),
        item(project.id, 'action', 'i5'),
      ],
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.saved_items).toHaveLength(5);
    expect(data.growth_changes).toHaveLength(1);
    expect(data.growth_changes[0]).toMatchObject({
      action_delta: 2,
      before: { action_count: 0 },
      after: { action_count: 2 },
    });
    expect(data.completed_results).toEqual([]);
    expect((await read(cookie, `/projects/${project.id}`)).json().data.project.goal).toBeNull();
    expect((await read(cookie, '/records?type=goal')).json().data.items[0].project_id).toBeNull();
    expect((await read(cookie, `/projects/${project.id}/tasks`)).json().data.items).toHaveLength(1);
    expect((await read(cookie, '/records')).json().data.items).toHaveLength(4);
  });
  it('校验指向 client_item_id，未来时间和无项目任务整批失败', async () => {
    const { cookie, project } = await setup();
    const failed = await write(cookie, '/record-batches/commit', {
      items: [item(project.id), item(null, 'task', 'bad')],
    });
    expect(failed.statusCode).toBe(422);
    expect(failed.json().details).toContainEqual(
      expect.objectContaining({ client_item_id: 'bad', field: 'items.1.project_id' }),
    );
    const future = await write(cookie, '/record-batches/commit', {
      items: [{ ...item(project.id), occurred_at: new Date(Date.now() + 3600000).toISOString() }],
    });
    expect(future.statusCode).toBe(422);
    expect(future.json().details[0].client_item_id).toBe('i1');
    expect((await read(cookie, '/records')).json().data.items).toEqual([]);
  });
  it('任务重复完成和不同 key 完成只生成一个行动；支持显式撤销', async () => {
    const { cookie, project } = await setup();
    const task = (
      await write(cookie, `/projects/${project.id}/tasks`, {
        content: '学半小时',
        due_at: '2026-12-01T10:30:00+08:00',
      })
    ).json().data.task;
    expect(task.due_at).toBe('2026-12-01T10:30:00+08:00');
    const key: string = randomUUID();
    const first = await write(cookie, `/tasks/${task.id}/complete`, {}, 'POST', key);
    const replay = await write(cookie, `/tasks/${task.id}/complete`, {}, 'POST', key);
    expect(replay.json().data).toEqual(first.json().data);
    const second = await write(cookie, `/tasks/${task.id}/complete`);
    expect(second.json().data.growth_changes).toEqual([]);
    expect(second.json().data.action.id).toBe(first.json().data.action.id);
    expect(second.json().data.action.source).toBe('task_complete');
    expect((await read(cookie, '/records')).json().data.items).toHaveLength(1);
    await write(cookie, `/tasks/${task.id}/reopen`);
    expect(
      (await read(cookie, `/projects/${project.id}`)).json().data.project.growth.action_count,
    ).toBe(0);
  });
  it('目标模式、多目标独立进度、完成成果唯一，收获不修改项目状态', async () => {
    for (const mode of ['count', 'percent', 'manual']) {
      const { cookie, project } = await setup(mode);
      const goal = (
        await write(cookie, `/projects/${project.id}/goals`, {
          title: '阶段目标',
          mode,
          ...(mode === 'count' ? { target_value: 2 } : {}),
        })
      ).json().data.goal;
      if (mode === 'manual') expect([goal.current_value, goal.target_value]).toEqual([null, null]);
      if (mode === 'percent') expect(goal.target_value).toBe(100);
      const duplicate = await write(cookie, `/projects/${project.id}/goals`, {
        title: '不覆盖',
        mode: 'manual',
      });
      expect(duplicate.statusCode).toBe(200);
      const secondGoal = duplicate.json().data.goal;
      expect(secondGoal.id).not.toBe(goal.id);
      const done = await write(
        cookie,
        `/goals/${goal.id}/progress`,
        mode === 'manual' ? { completed: true } : { current_value: mode === 'count' ? 2 : 100 },
        'PATCH',
      );
      expect(done.statusCode).toBe(200);
      expect(done.json().data.completed_results).toHaveLength(1);
      const result = done.json().data.completed_results[0];
      await write(cookie, `/results/${result.id}/harvest`);
      await write(cookie, `/results/${result.id}/harvest`);
      const after = (await read(cookie, `/projects/${project.id}`)).json().data.project;
      expect(after.status).toBe('active');
      expect(after.goal.id).toBe(secondGoal.id);
      expect(after.goals).toHaveLength(2);
      expect(after.growth.harvest_count).toBe(1);
      expect(after.growth.stage).toBe(0);
      const next = await write(cookie, `/projects/${project.id}/goals`, {
        title: '下个目标',
        mode: 'manual',
      });
      expect(next.statusCode).toBe(200);
      expect((await read(cookie, '/results')).json().data.items).toHaveLength(1);
    }
  });
  it('分页稳定、无重复、游标不能跨筛选使用，limit 最大 100', async () => {
    const { cookie, project } = await setup();
    await write(cookie, '/record-batches/commit', {
      items: [
        item(project.id, 'action', 'a'),
        item(project.id, 'idea', 'b'),
        item(project.id, 'goal', 'c'),
      ],
    });
    const first = (await read(cookie, '/records?limit=2')).json().data;
    expect(first.items).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();
    const second = (
      await read(cookie, '/records?limit=2&cursor=' + encodeURIComponent(first.next_cursor))
    ).json().data;
    expect(second.items).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
    expect(
      (await read(cookie, '/records?type=action&cursor=' + encodeURIComponent(first.next_cursor)))
        .statusCode,
    ).toBe(400);
    expect((await read(cookie, '/records?limit=101')).statusCode).toBe(422);
  });
  it('报告使用 range、上海时间、真实发生时间；归档历史仍统计', async () => {
    const { cookie, project } = await setup();
    await write(cookie, '/record-batches/commit', {
      items: [item(project.id), item(null, 'action', 'i2')],
    });
    await write(cookie, `/projects/${project.id}`, { status: 'archived' }, 'PATCH');
    const report = (await read(cookie, '/reports?range=7d')).json().data;
    expect(report).toMatchObject({
      range: '7d',
      action_count: 2,
      active_project_count: 1,
      new_result_count: 0,
      summary: null,
    });
    expect(report.start_at).toMatch(/T00:00:00\+08:00$/);
    expect(report.end_at).toMatch(/T00:00:00\+08:00$/);
    expect((await read(cookie, '/reports?range=all')).json().data.start_at).toBeNull();
    expect((await read(cookie, '/bootstrap')).json().data.projects).toEqual([]);
  });
  it('跨用户读写被隔离、跨站写入被拒绝', async () => {
    const { cookie, project } = await setup();
    const other = await session();
    expect((await read(other, `/projects/${project.id}`)).statusCode).toBe(404);
    expect(
      (await write(other, `/projects/${project.id}`, { status: 'archived' }, 'PATCH')).statusCode,
    ).toBe(404);
    expect((await read(other, '/records?project_id=' + project.id)).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/session',
          headers: { origin: 'https://other.example' },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect((await read(cookie, `/projects/${project.id}`)).json().data.project.status).toBe(
      'active',
    );
  });
});

describe('PRD V1.1 REST 目标贡献与手动收获', () => {
  it('贡献需确认且只能归属同项目目标；重试不重复进度，成熟后并发收获只计一次', async () => {
    const { cookie, project } = await setup('发布');
    const goal = (
      await write(cookie, `/projects/${project.id}/goals`, {
        title: '发布2条视频',
        mode: 'count',
        target_value: 2,
        unit: '条',
      })
    ).json().data.goal;
    const untouched = await write(cookie, '/record-batches/commit', {
      items: [{ ...item(project.id), content: '剪完视频', goal_id: goal.id }],
    });
    expect(untouched.statusCode).toBe(200);
    expect(
      (await read(cookie, `/projects/${project.id}`)).json().data.project.goal.current_value,
    ).toBe(0);
    const contribution = {
      ...item(project.id),
      content: '发布2条视频',
      goal_id: goal.id,
      contribution: 2,
    };
    expect(
      (await write(cookie, '/record-batches/commit', { items: [contribution] })).statusCode,
    ).toBe(422);
    const secondProject = (
      await write(cookie, '/projects/batch', {
        projects: [{ client_item_id: 'other', name: '读书' }],
      })
    ).json().data.projects[0];
    expect(
      (
        await write(cookie, '/record-batches/commit', {
          items: [{ ...contribution, project_id: secondProject.id, progress_confirmed: true }],
        })
      ).statusCode,
    ).toBe(400);
    const key = randomUUID();
    const payload = { items: [{ ...contribution, progress_confirmed: true }] };
    const response = await write(cookie, '/record-batches/commit', payload, 'POST', key);
    expect(response.statusCode).toBe(200);
    expect(
      (await write(cookie, '/record-batches/commit', payload, 'POST', key)).json().data,
    ).toEqual(response.json().data);
    const result = response.json().data.completed_results[0];
    expect(result.action_count).toBe(2);
    expect(result.harvested_at).toBeNull();
    const before = (await read(cookie, `/projects/${project.id}`)).json().data.project;
    expect(before.growth).toMatchObject({ harvest_count: 0, stage: 0 });
    const picks = await Promise.all([
      write(cookie, `/results/${result.id}/harvest`),
      write(cookie, `/results/${result.id}/harvest`),
    ]);
    expect(picks.every((pick) => pick.statusCode === 200)).toBe(true);
    await write(cookie, `/projects/${project.id}`, { tree_stage_threshold: 1 }, 'PATCH');
    const after = (await read(cookie, `/projects/${project.id}`)).json().data.project;
    expect(after.growth).toMatchObject({ harvest_count: 1, stage: 1, tree_stage_threshold: 1 });
    expect(
      (await read(cookie, '/records'))
        .json()
        .data.items.filter((entry: { goal_id: string }) => entry.goal_id === goal.id),
    ).toHaveLength(2);
    const persisted = (await read(cookie, '/exports/garden')).json().data;
    expect(persisted.results).toHaveLength(1);
  });
});
