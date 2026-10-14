import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { healthResponseSchema, apiErrorSchema } from '@apple/contracts';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
const env = readEnv({ NODE_ENV: 'test' });
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp(env);
}, 30000);
afterAll(async () => {
  await app?.close();
});
describe('基础 API', () => {
  it('无需 Docker，本地 PostgreSQL 已就绪', async () => {
    const health = await app.inject({ url: '/api/v1/health' });
    expect(health.statusCode).toBe(200);
    expect(healthResponseSchema.parse(health.json().data).status).toBe('ok');
    const ready = await app.inject({ url: '/api/v1/health/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.driver).toBe('pglite');
  });
  it('未知接口返回统一错误结构', async () => {
    const response = await app.inject({ url: '/api/v1/missing' });
    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json()).code).toBe('NOT_FOUND');
  });
  it('允许配置的前端来源访问', async () => {
    const response = await app.inject({
      url: '/api/v1/health',
      headers: { origin: env.CORS_ORIGIN },
    });
    expect(response.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN);
  });
});
