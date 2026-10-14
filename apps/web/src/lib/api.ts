import { apiErrorSchema } from '@apple/contracts';
import { z } from 'zod';
const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: { client_item_id?: string; field: string; message: string }[],
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
  } catch {
    throw new ApiRequestError('连接暂时中断，输入已保留，请重试', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      error.success ? error.data.message : `请求失败（${response.status}）`,
      response.status,
      error.success ? error.data.code : 'HTTP_ERROR',
      error.success ? error.data.details : undefined,
    );
  }
  const envelope: unknown = await response.json();
  return z.object({ code: z.literal('OK'), data: schema, request_id: z.string() }).parse(envelope)
    .data;
}
export const apiGet = <T>(path: string, schema: z.ZodType<T>) => apiRequest(path, schema);
