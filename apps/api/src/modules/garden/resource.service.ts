import { createHash, randomUUID } from 'node:crypto';
import type { Command, GardenState } from '@apple/contracts';
import { applyCommand } from '@apple/domain';
import type { GardenRepository } from '../../repositories/garden.repository.js';
export function createResourceService(repository: GardenRepository) {
  return {
    read: (userId: string) => repository.read(userId),
    write<T>(
      userId: string,
      key: string,
      scope: string,
      body: unknown,
      operation: (state: GardenState, run: (command: Command) => GardenState, now: string) => T,
    ) {
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ scope, body }))
        .digest('hex');
      return repository.transactIdempotent(userId, key, fingerprint, (initial) => {
        let state = initial;
        const now = new Date().toISOString();
        const run = (command: Command) => {
          state = applyCommand(
            state,
            { command, expectedVersion: state.version, operationId: randomUUID() },
            JSON.stringify(command),
            { now, id: randomUUID },
          ).state;
          return state;
        };
        const value = operation(initial, run, now);
        return { state, value };
      });
    },
  };
}
