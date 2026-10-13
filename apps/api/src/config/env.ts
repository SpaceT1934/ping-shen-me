import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.url().optional(),
  DATA_DRIVER: z.enum(['pglite', 'postgres']).optional(),
  PGLITE_DATA_DIR: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
});

export function readEnv(input: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    // 只输出字段名，避免连接凭证出现在配置错误中。
    throw new Error(
      `环境配置无效：${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  const DATA_DRIVER =
    result.data.DATA_DRIVER ?? (result.data.NODE_ENV === 'production' ? 'postgres' : 'pglite');
  if (DATA_DRIVER === 'postgres' && !result.data.DATABASE_URL)
    throw new Error('PostgreSQL 模式需要 DATABASE_URL');
  return {
    ...result.data,
    DATA_DRIVER,
    COOKIE_SECURE: result.data.COOKIE_SECURE
      ? result.data.COOKIE_SECURE === 'true'
      : result.data.NODE_ENV === 'production',
    PGLITE_DATA_DIR:
      result.data.PGLITE_DATA_DIR ??
      (result.data.NODE_ENV === 'test' ? 'memory://' : './.data/apple'),
  };
}
export type Env = ReturnType<typeof readEnv>;
