import type { z } from 'zod';
import { DomainError } from '@apple/domain';
import type { Env } from '../../config/env.js';

export function createAiClient(env: Env, timeoutMs = 35_000) {
  const base = new URL(env.AI_SERVICE_URL);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)))
  ) {
    throw new Error('AI_SERVICE_URL 需要 HTTPS 或本机地址');
  }
  return async <T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> => {
    if (!env.AI_SERVICE_TOKEN)
      throw new DomainError('AI_UNAVAILABLE', 'AI 暂未连接，可以先手动记录', 503);
    let response: Response;
    try {
      response = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, '')}/internal/v1${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${env.AI_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new DomainError('AI_UNAVAILABLE', 'AI 暂时无法连接，输入已保留，可以手动记录', 503);
    }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      // 只转发已知错误，不回传供应商响应、密钥或音频。
      const code =
        typeof result === 'object' &&
        result !== null &&
        'error' in result &&
        typeof result.error === 'object' &&
        result.error !== null &&
        'code' in result.error
          ? result.error.code
          : null;
      if (code === 'ASR_NOT_CONFIGURED')
        throw new DomainError(code, '语音暂未启用，请先输入文字', 503);
      if (code === 'INVALID_AUDIO') throw new DomainError(code, '音频格式无效或超过 5 MB', 400);
      if (code === 'AI_PARSE_FAILED' || code === 'ASR_PARSE_FAILED')
        throw new DomainError(code, 'AI 结果校验失败，请重试或手动记录', 503);
      throw new DomainError('AI_UNAVAILABLE', '模型暂不可用，输入已保留，可以手动记录', 503);
    }
    const parsed = schema.safeParse(result);
    if (!parsed.success)
      throw new DomainError('AI_PARSE_FAILED', 'AI 结果校验失败，请手动记录', 503);
    return parsed.data;
  };
}
