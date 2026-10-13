import { PGlite } from '@electric-sql/pglite';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gardenSchema } from '@apple/contracts';
import { emptyGarden } from '@apple/domain';
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
        const { state, value } = transform(gardenSchema.parse(rows.rows[0].state));
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
