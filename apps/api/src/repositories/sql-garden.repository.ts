import { PGlite } from '@electric-sql/pglite';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gardenSchema, type GardenState } from '@apple/contracts';
import { emptyGarden, DomainError } from '@apple/domain';
import type { Env } from '../config/env.js';
import type { GardenRepository } from './garden.repository.js';

type Row = Record<string, unknown>;
type SqlClient = {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};
type Database = {
  client: SqlClient;
  transaction: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};
async function guardIdentities(
  tx: SqlClient,
  userId: string,
  before: GardenState,
  after: GardenState,
) {
  const oldIds = new Set(
    [...before.records, ...before.results, ...before.growthEvents].map((item) => item.id),
  );
  const links = [
    ...after.records
      .filter((item) => item.sourceTaskId && !oldIds.has(item.id))
      .map((item) => ({ kind: 'task_action', source_id: item.sourceTaskId!, target_id: item.id })),
    ...after.results
      .filter((item) => !oldIds.has(item.id))
      .map((item) => ({ kind: 'goal_result', source_id: item.goalId, target_id: item.id })),
    ...after.growthEvents
      .filter((item) => !oldIds.has(item.id))
      .map((item) => ({ kind: 'growth_action', source_id: item.actionId, target_id: item.id })),
  ];
  if (!links.length) return;
  // A source may only ever bind to one entity, including after soft deletion.
  for (const link of links) {
    await tx.query(
      'INSERT INTO garden_entity_links (user_id, kind, source_id, target_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [userId, link.kind, link.source_id, link.target_id],
    );
    const existing = await tx.query<{ target_id: string }>(
      'SELECT target_id FROM garden_entity_links WHERE user_id = $1 AND kind = $2 AND source_id = $3',
      [userId, link.kind, link.source_id],
    );
    if (existing.rows[0]?.target_id !== link.target_id)
      throw new DomainError('ENTITY_CONFLICT', '任务行动或目标成果已存在，不能重复创建', 409);
  }
}
export async function createGardenRepository(env: Env): Promise<GardenRepository> {
  const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
  let database: Database;
  if (env.DATA_DRIVER === 'pglite') {
    const path = env.PGLITE_DATA_DIR === 'memory://' ? undefined : resolve(env.PGLITE_DATA_DIR);
    if (path) await mkdir(dirname(path), { recursive: true });
    const client = new PGlite(path);
    try {
      await pgliteMigrate(pgliteDrizzle(client), { migrationsFolder });
    } catch (error) {
      await client.close();
      throw error;
    }
    database = {
      client,
      transaction: (fn) => client.transaction((tx) => fn(tx)),
      close: () => client.close(),
    };
  } else {
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10,
    });
    try {
      await pgMigrate(pgDrizzle(pool), { migrationsFolder });
    } catch (error) {
      await pool.end();
      throw error;
    }
    database = {
      client: pool,
      close: () => pool.end(),
      transaction: async (fn) => {
        const tx = await pool.connect();
        try {
          await tx.query('BEGIN');
          const value = await fn(tx);
          await tx.query('COMMIT');
          return value;
        } catch (error) {
          await tx.query('ROLLBACK');
          throw error;
        } finally {
          tx.release();
        }
      },
    };
  }
  return {
    driver: env.DATA_DRIVER,
    async read(userId) {
      const result = await database.client.query<{ state: unknown }>(
        'SELECT state FROM garden_snapshots WHERE user_id = $1',
        [userId],
      );
      if (!result.rows[0]) throw new Error('用户花园不存在');
      return gardenSchema.parse(result.rows[0].state);
    },
    async transact(userId, transform) {
      return database.transaction(async (tx) => {
        const rows = await tx.query<{ state: unknown }>(
          'SELECT state FROM garden_snapshots WHERE user_id = $1 FOR UPDATE',
          [userId],
        );
        if (!rows.rows[0]) throw new Error('用户花园不存在');
        const previousState = gardenSchema.parse(rows.rows[0].state);
        const { state, value } = transform(previousState);
        await guardIdentities(tx, userId, previousState, state);
        await tx.query(
          'UPDATE garden_snapshots SET state = $2::jsonb, updated_at = now() WHERE user_id = $1',
          [userId, JSON.stringify(state)],
        );
        await tx.query(
          'UPDATE users SET onboarding_completed = $2, updated_at = now() WHERE id = $1',
          [userId, state.onboardingCompleted],
        );
        return value;
      });
    },
    async transactIdempotent(userId, key, fingerprint, transform) {
      return database.transaction(async (tx) => {
        const rows = await tx.query<{ state: unknown }>(
          'SELECT state FROM garden_snapshots WHERE user_id = $1 FOR UPDATE',
          [userId],
        );
        if (!rows.rows[0]) throw new Error('用户花园不存在');
        const previous = await tx.query<{ fingerprint: string; response: unknown }>(
          'SELECT fingerprint, response FROM api_operations WHERE user_id = $1 AND key = $2',
          [userId, key],
        );
        if (previous.rows[0]) {
          if (previous.rows[0].fingerprint !== fingerprint)
            throw new DomainError('IDEMPOTENCY_CONFLICT', '同一提交编号不能用于不同请求', 409);
          return previous.rows[0].response as ReturnType<typeof transform>['value'];
        }
        const previousState = gardenSchema.parse(rows.rows[0].state);
        const { state, value } = transform(previousState);
        await guardIdentities(tx, userId, previousState, state);
        await tx.query(
          'UPDATE garden_snapshots SET state = $2::jsonb, updated_at = now() WHERE user_id = $1',
          [userId, JSON.stringify(state)],
        );
        await tx.query(
          'UPDATE users SET onboarding_completed = $2, updated_at = now() WHERE id = $1',
          [userId, state.onboardingCompleted],
        );
        await tx.query(
          'INSERT INTO api_operations (user_id, key, fingerprint, response) VALUES ($1, $2, $3, $4::jsonb)',
          [userId, key, fingerprint, JSON.stringify(value)],
        );
        return value;
      });
    },
    async createSession(tokenHash, userId, expiresAt) {
      await database.transaction(async (tx) => {
        await tx.query('INSERT INTO users (id, display_name) VALUES ($1, $2)', [
          userId,
          '慢慢长大的你',
        ]);
        await tx.query('INSERT INTO garden_snapshots (user_id, state) VALUES ($1, $2::jsonb)', [
          userId,
          JSON.stringify(emptyGarden()),
        ]);
        await tx.query(
          'INSERT INTO web_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
          [tokenHash, userId, expiresAt],
        );
      });
    },
    async resolveSession(tokenHash) {
      const rows = await database.client.query<{ user_id: string }>(
        'SELECT user_id FROM web_sessions WHERE token_hash = $1 AND expires_at > now()',
        [tokenHash],
      );
      return rows.rows[0]?.user_id || null;
    },
    async probe() {
      await database.client.query('SELECT 1');
    },
    close: database.close,
  };
}
