import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest } from '../src/lib/api';

afterEach(() => vi.unstubAllGlobals());

it('sends requests when AbortSignal.timeout is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined });
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: 'OK', data: { saved: true }, request_id: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetch);

  try {
    await expect(apiRequest('/test', z.object({ saved: z.boolean() }))).resolves.toEqual({
      saved: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  } finally {
    if (original) Object.defineProperty(AbortSignal, 'timeout', original);
  }
});
