import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createGardenRepository } from '../src/repositories/sql-garden.repository.js';
import { readEnv } from '../src/config/env.js';
import { applyCommand } from '@apple/domain';
it('本地数据库关闭并重新打开后，数据和会话仍在', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'apple-persistence-test-'));
  const env = readEnv({
    NODE_ENV: 'test',
    DATA_DRIVER: 'pglite',
    PGLITE_DATA_DIR: join(temporary, 'database'),
  });
  const userId = randomUUID();
  let repository = await createGardenRepository(env);
  try {
    await repository.createSession(
      'a'.repeat(64),
      userId,
      new Date(Date.now() + 86400000).toISOString(),
    );
    await repository.transact(userId, (state) => {
      const result = applyCommand(
        state,
        { operationId: randomUUID(), expectedVersion: 0, command: { type: 'onboard' } },
        'onboard',
        { now: new Date().toISOString(), id: randomUUID },
      );
      return { state: result.state, value: null };
    });
    await repository.transactIdempotent(userId, 'saved-key', 'fingerprint', (state) => ({
      state,
      value: { batch_id: 'original-result', saved_items: ['record-1'] },
    }));
    await repository.close();
    repository = await createGardenRepository(env);
    expect((await repository.read(userId)).onboardingCompleted).toBe(true);
    expect(await repository.resolveSession('a'.repeat(64))).toBe(userId);
    const replay = await repository.transactIdempotent(userId, 'saved-key', 'fingerprint', () => {
      throw new Error('持久化重试不应重新执行业务');
    });
    expect(replay).toEqual({ batch_id: 'original-result', saved_items: ['record-1'] });
    await expect(
      repository.transactIdempotent(userId, 'saved-key', 'different', (state) => ({
        state,
        value: null,
      })),
    ).rejects.toThrow('同一提交编号');
  } finally {
    await repository.close();
    await rm(temporary, { recursive: true, force: true });
  }
}, 30000);
