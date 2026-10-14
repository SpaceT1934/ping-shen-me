import { expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { applyCommand, emptyGarden } from '@apple/domain';
import type { Command } from '@apple/contracts';
import { readEnv } from '../src/config/env.js';
import { createGardenRepository } from '../src/repositories/sql-garden.repository.js';
it('旧数据库原地升级保留用户、任务行动和成果，并回填唯一约束', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'apple-upgrade-'));
  const oldMigrations = join(temporary, 'old-migrations');
  await mkdir(join(oldMigrations, 'meta'), { recursive: true });
  const journal = JSON.parse(
    await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'),
  );
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 2);
  await writeFile(join(oldMigrations, 'meta/_journal.json'), JSON.stringify(journal));
  for (const entry of journal.entries)
    await copyFile(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      join(oldMigrations, `${entry.tag}.sql`),
    );
  const path = join(temporary, 'database');
  const oldDb = new PGlite(path);
  const userId = randomUUID();
  let state = emptyGarden();
  const run = (command: Command) => {
    state = applyCommand(
      state,
      { command, expectedVersion: state.version, operationId: randomUUID() },
      JSON.stringify(command),
      { now: '2026-10-13T05:00:00.000Z', id: randomUUID },
    ).state;
  };
  try {
    await migrate(drizzle(oldDb), { migrationsFolder: oldMigrations });
    run({
      type: 'project.create',
      name: '原有方向',
      icon: 'book',
      color: 'blue',
      goal: { title: '原有目标', type: 'manual', target: 1, unit: '' },
    });
    run({
      type: 'task.create',
      projectId: state.projects[0]!.id,
      title: '原有计划',
      dueDate: null,
    });
    run({ type: 'task.complete', id: state.tasks[0]!.id, completed: true });
    run({ type: 'goal.progress', id: state.goals[0]!.id, value: 1 });
    await oldDb.query('INSERT INTO users (id, display_name) VALUES ($1, $2)', [userId, '旧用户']);
    await oldDb.query('INSERT INTO garden_snapshots (user_id, state) VALUES ($1, $2::jsonb)', [
      userId,
      JSON.stringify(state),
    ]);
  } finally {
    await oldDb.close();
  }
  const repository = await createGardenRepository(
    readEnv({ NODE_ENV: 'test', DATA_DRIVER: 'pglite', PGLITE_DATA_DIR: path }),
  );
  try {
    const restored = await repository.read(userId);
    expect(restored.projects[0]!.name).toBe('原有方向');
    expect(restored.records).toHaveLength(1);
    expect(restored.results).toHaveLength(1);
    await expect(
      repository.transact(userId, (previous) => {
        const next = structuredClone(previous);
        next.results.push({ ...next.results[0]!, id: randomUUID() });
        return { state: next, value: null };
      }),
    ).rejects.toThrow('不能重复创建');
    await expect(
      repository.transact(userId, (previous) => {
        const next = structuredClone(previous);
        next.records.push({ ...next.records[0]!, id: randomUUID() });
        return { state: next, value: null };
      }),
    ).rejects.toThrow('不能重复创建');
    expect((await repository.read(userId)).results).toHaveLength(1);
    expect((await repository.read(userId)).records).toHaveLength(1);
  } finally {
    await repository.close();
    await rm(temporary, { recursive: true, force: true });
  }
}, 30000);
