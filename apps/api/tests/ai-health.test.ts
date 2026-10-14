import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp(
    readEnv({ NODE_ENV: 'test', AI_REQUIRED_ON_DEPLOY: 'true', AI_SERVICE_TOKEN: 'test-token' }),
  );
}, 30000);
afterAll(async () => {
  await app?.close();
});
afterEach(() => vi.unstubAllGlobals());
it('启用部署就绪检查后，Python 服务故障不能误报发布成功', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream failed')));
  expect((await app.inject({ url: '/api/v1/health/ready' })).statusCode).toBe(503);
});
it('就绪检查只读取模型配置状态，不调用模型', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ aiConfigured: true, asrEnabled: true })));
  vi.stubGlobal('fetch', fetch);
  const response = await app.inject({ url: '/api/v1/health/ready' });
  expect(response.statusCode).toBe(200);
  expect(response.json().data.ai_service).toBe('connected');
  expect(fetch.mock.calls[0]![0]).toContain('/internal/v1/capabilities');
});
