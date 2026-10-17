import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp(readEnv({ NODE_ENV: 'test', AI_SERVICE_TOKEN: 'test-service-token' }));
}, 30000);
afterAll(async () => {
  await app?.close();
});
afterEach(() => vi.unstubAllGlobals());
async function session() {
  const response = await app.inject({ method: 'POST', url: '/api/v1/session', payload: {} });
  return String(response.headers['set-cookie']).split(';')[0]!;
}
function post(cookie: string, path: string, payload: Record<string, unknown>, key = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: '/api/v1' + path,
    headers: { cookie, 'Idempotency-Key': key },
    payload,
  });
}
async function snapshot(cookie: string) {
  return (await app.inject({ url: '/api/v1/exports/garden', headers: { cookie } })).json().data;
}
function mockProvider(result: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(result), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
async function project(cookie: string, name = '自媒体') {
  const result = await post(cookie, '/projects/batch', {
    projects: [{ client_item_id: 'seed', name }],
  });
  expect(result.statusCode).toBe(200);
  return result.json().data.projects[0].id as string;
}
describe('AI 接入 V0.2（不调用真实模型）', () => {
  it('AI 任务拆解只读取自己的进行中项目，草稿不写入业务数据，错误结果被拒绝', async () => {
    const cookie = await session();
    const own = await project(cookie, '我的学习');
    const foreign = await project(await session(), '他人的工作');
    const before = await snapshot(cookie);
    const fetch = mockProvider({
      tasks: [{ title: '练习听力', description: '从一段短听力开始，记录没有听懂的部分。' }],
    });
    expect(
      (await post(cookie, '/ai/tasks/plan', { project_id: foreign, text: '达到7分' })).statusCode,
    ).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    const response = await post(cookie, '/ai/tasks/plan', {
      project_id: own,
      text: '三个月达到7分',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.tasks).toHaveLength(1);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
      project_name: '我的学习',
      text: '三个月达到7分',
    });
    expect((await snapshot(cookie)).version).toBe(before.version);
    mockProvider({ tasks: [{ title: '', description: 'invalid' }] });
    expect(
      (await post(cookie, '/ai/tasks/plan', { project_id: own, text: '三个月达到7分' })).statusCode,
    ).toBe(503);
  });
  it('无会话和外来来源不能调用 AI', async () => {
    const fetch = mockProvider({});
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/ai/records/analyze',
          payload: { text: '完成' },
        })
      ).statusCode,
    ).toBe(401);
    const cookie = await session();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/ai/projects/analyze',
          headers: { cookie, origin: 'https://evil.example' },
          payload: { text: '学习' },
        })
      ).statusCode,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('只发送当前用户项目，草稿不自动保存，外来项目 ID 被清空', async () => {
    const cookie = await session();
    const own = await project(cookie);
    const foreign = await project(await session(), '别人的英语');
    const before = await snapshot(cookie);
    const fetch = mockProvider({
      items: [
        {
          content: '剪视频',
          type: 'action',
          project_id: foreign,
          emotion: null,
          source_text: '剪视频',
        },
      ],
    });
    const response = await post(cookie, '/ai/records/analyze', {
      text: '剪视频',
      projects: [{ id: foreign }],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items[0].project_id).toBeNull();
    expect(response.json().data.items[0].client_item_id).toBeTruthy();
    const sent = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(sent.projects.map((p: { id: string }) => p.id)).toEqual([own]);
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBe('Bearer test-service-token');
    const after = await snapshot(cookie);
    expect(after.records).toHaveLength(0);
    expect(after.version).toBe(before.version);
  });
  it('确认后保留语音来源及原文，重复提交只产生一次行动和成长', async () => {
    const cookie = await session();
    const id = await project(cookie);
    const body = {
      raw_text: '今天剪视频',
      source: 'voice',
      items: [
        {
          client_item_id: 'draft-1',
          content: '剪视频',
          type: 'action',
          project_id: id,
          source_text: '今天剪视频',
        },
      ],
    };
    const key = randomUUID();
    expect((await post(cookie, '/record-batches/commit', body, key)).statusCode).toBe(200);
    expect((await post(cookie, '/record-batches/commit', body, key)).statusCode).toBe(200);
    const state = await snapshot(cookie);
    expect(state.records).toHaveLength(1);
    expect(state.records[0].source_text).toBe('今天剪视频');
    expect(state.records[0].source).toBe('voice');
    expect(state.growth_events).toHaveLength(1);
  });
  it('方向与正式目标在同一批次提交，重名失败整批回滚', async () => {
    const cookie = await session();
    const body = {
      projects: [
        { client_item_id: 'a', name: '英语', goal: { title: '雅思7分', mode: 'manual' } },
        { client_item_id: 'b', name: '自媒体' },
      ],
    };
    const key = randomUUID();
    const first = await post(cookie, '/projects/batch', body, key);
    expect(first.statusCode).toBe(200);
    expect(first.json().data.projects[0].goal.title).toBe('雅思7分');
    await post(cookie, '/projects/batch', body, key);
    expect((await snapshot(cookie)).projects).toHaveLength(2);
    const invalid = await post(cookie, '/projects/batch', {
      projects: [
        { client_item_id: 'c', name: '运动' },
        { client_item_id: 'd', name: '英语' },
      ],
    });
    expect(invalid.statusCode).toBe(409);
    expect((await snapshot(cookie)).projects).toHaveLength(2);
  });
  it('拒绝虚构原文，供应商失败不重试、不泄露响应', async () => {
    const cookie = await session();
    mockProvider({
      items: [
        {
          content: '假的',
          type: 'action',
          project_id: null,
          emotion: null,
          source_text: '凭空出现',
        },
      ],
    });
    expect((await post(cookie, '/ai/records/analyze', { text: '完成学习' })).json().code).toBe(
      'AI_PARSE_FAILED',
    );
    const fetch = mockProvider({ error: { message: 'SECRET_PROVIDER_RESPONSE' } }, 500);
    const failure = await post(cookie, '/ai/projects/analyze', { text: '学习' });
    expect(failure.statusCode).toBe(503);
    expect(failure.body).not.toContain('SECRET_PROVIDER_RESPONSE');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('回顾使用业务统计并缓存，空报告不调用模型', async () => {
    const cookie = await session();
    const fetch = mockProvider({ summary: '真实回顾' });
    await post(cookie, '/ai/reports/summarize', { period: '全部' });
    expect(fetch).not.toHaveBeenCalled();
    const id = await project(cookie);
    await post(cookie, '/record-batches/commit', {
      items: [{ client_item_id: 'r', type: 'action', content: '剪视频', project_id: id }],
    });
    await post(cookie, '/ai/reports/summarize', { period: '全部', action_count: 999 });
    await post(cookie, '/ai/reports/summarize', { period: '全部' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0]![1].body).action_count).toBe(1);
  });
  it('语音状态和请求字段符合 snake_case 契约', async () => {
    const cookie = await session();
    mockProvider({ aiConfigured: true, asrEnabled: true });
    const capability = await app.inject({ url: '/api/v1/ai/capabilities', headers: { cookie } });
    expect(capability.json().data).toEqual({ ai_configured: true, asr_enabled: true });
    const fetch = mockProvider({ text: '今天学习。' });
    const result = await post(cookie, '/asr/transcribe', {
      audio_base64: 'AAAA',
      mime_type: 'audio/wav',
    });
    expect(result.json().data.text).toBe('今天学习。');
    expect(JSON.parse(fetch.mock.calls[0]![1].body).audio_base64).toBe('AAAA');
  });
  it('每个会话一分钟最多十次 AI 请求', async () => {
    const cookie = await session();
    const fetch = mockProvider({ candidates: [] });
    for (let i = 0; i < 10; i++)
      expect((await post(cookie, '/ai/projects/analyze', { text: '学习' })).statusCode).toBe(200);
    expect((await post(cookie, '/ai/projects/analyze', { text: '学习' })).statusCode).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(10);
  });
});

it('短反馈只读已保存行动，模型不可用时回退且不改业务数据', async () => {
  const cookie = await session();
  const p = await project(cookie);
  await post(cookie, '/record-batches/commit', {
    items: [
      { client_item_id: 'feedback-action', content: '剪完视频', type: 'action', project_id: p },
    ],
  });
  const before = await snapshot(cookie);
  const fetch = mockProvider({ error: { code: 'UNAVAILABLE' } }, 503);
  const feedback = await post(cookie, '/ai/feedback', {});
  expect(feedback.statusCode).toBe(200);
  expect(feedback.json().data.text).toContain('努力');
  expect(JSON.parse(fetch.mock.calls[0]![1].body).actions).toEqual(['剪完视频']);
  expect(await snapshot(cookie)).toEqual(before);
  await post(cookie, '/ai/feedback', {});
  expect(fetch).toHaveBeenCalledTimes(1);
});
