import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command, GardenState } from '@apple/contracts';
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
  const raw = response.headers['set-cookie'];
  const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;
  return { cookie, state: response.json().state as GardenState };
}
const createProject: Command = {
  type: 'project.create',
  name: '学习',
  icon: 'book',
  color: 'blue',
  goal: { title: '完成学习', type: 'manual', target: 1, unit: '' },
};
async function command(
  cookie: string,
  version: number,
  value: Command,
  operationId = randomUUID(),
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/garden/commands',
    headers: { cookie },
    payload: { command: value, expectedVersion: version, operationId },
  });
}
describe('真实数据库与 HTTP 手动流程', () => {
  it('没有会话不能读取，匿名会话带 HttpOnly Cookie', async () => {
    expect((await app.inject({ url: '/api/v1/garden' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'POST', url: '/api/v1/session', payload: {} });
    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('不同用户不能修改对方项目', async () => {
    const a = await session();
    const b = await session();
    const created = await command(a.cookie, 0, createProject);
    const projectId = created.json().state.projects[0].id;
    const attack = await command(b.cookie, 0, {
      type: 'project.status',
      id: projectId,
      status: 'archived',
    });
    expect(attack.statusCode).toBe(404);
    const own = await app.inject({ url: '/api/v1/garden', headers: { cookie: a.cookie } });
    expect(own.json().projects[0].status).toBe('active');
  });
  it('完成任务通过事务保存，重复提交不生成第二次成长', async () => {
    const owner = await session();
    let state = (await command(owner.cookie, 0, createProject)).json().state as GardenState;
    state = (
      await command(owner.cookie, state.version, {
        type: 'task.create',
        projectId: state.projects[0]!.id,
        title: '学习半小时',
        dueDate: null,
      })
    ).json().state;
    const operationId = randomUUID();
    const complete: Command = { type: 'task.complete', id: state.tasks[0]!.id, completed: true };
    const first = await command(owner.cookie, state.version, complete, operationId);
    const repeated = await command(owner.cookie, state.version, complete, operationId);
    expect(first.statusCode).toBe(200);
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().state.records).toHaveLength(1);
    expect(repeated.json().state.growthEvents).toHaveLength(1);
    const restored = await app.inject({ url: '/api/v1/garden', headers: { cookie: owner.cookie } });
    expect(restored.json().tasks[0].completedAt).toBeTruthy();
  });
  it('并发修改只接受一个版本，避免覆盖数据', async () => {
    const owner = await session();
    const state = (await command(owner.cookie, 0, createProject)).json().state as GardenState;
    const responses = await Promise.all(
      ['第一件事', '第二件事'].map((title) =>
        command(owner.cookie, state.version, {
          type: 'task.create',
          projectId: state.projects[0]!.id,
          title,
          dueDate: null,
        }),
      ),
    );
    expect(responses.map((item) => item.statusCode).sort()).toEqual([200, 409]);
    const restored = await app.inject({ url: '/api/v1/garden', headers: { cookie: owner.cookie } });
    expect(restored.json().tasks).toHaveLength(1);
  });
  it('失败的批量记录整体回滚', async () => {
    const owner = await session();
    const state = (await command(owner.cookie, 0, createProject)).json().state as GardenState;
    const draft = {
      content: '一件事',
      date: '2026-10-13',
      dueDate: null,
      contribution: 0,
      goalType: 'manual' as const,
      target: 1,
      unit: '',
    };
    const response = await command(owner.cookie, state.version, {
      type: 'records.save',
      items: [
        { ...draft, type: 'action', projectId: state.projects[0]!.id },
        { ...draft, type: 'task', projectId: null },
      ],
    });
    expect(response.statusCode).toBe(400);
    const restored = await app.inject({ url: '/api/v1/garden', headers: { cookie: owner.cookie } });
    expect(restored.json().records).toHaveLength(0);
    expect(restored.json().version).toBe(state.version);
  });
  it('目标成果唯一，报告统计新成果，跨站写请求被拒绝', async () => {
    const owner = await session();
    const state = (await command(owner.cookie, 0, createProject)).json().state as GardenState;
    const done = await command(owner.cookie, state.version, {
      type: 'goal.progress',
      id: state.goals[0]!.id,
      value: 1,
    });
    expect(done.json().state.results).toHaveLength(1);
    const report = await app.inject({
      url: '/api/v1/reports?period=' + encodeURIComponent('全部'),
      headers: { cookie: owner.cookie },
    });
    expect(report.json().resultCount).toBe(1);
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/session',
      headers: { origin: 'https://other.example' },
      payload: {},
    });
    expect(blocked.statusCode).toBe(403);
  });
});
