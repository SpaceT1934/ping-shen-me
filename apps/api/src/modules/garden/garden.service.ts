import { createHash, randomUUID } from 'node:crypto';
import { applyCommand, createReport } from '@apple/domain';
import type { CommandEnvelope } from '@apple/contracts';
import type { GardenRepository } from '../../repositories/garden.repository.js';
export function createGardenService(repository: GardenRepository) {
  return {
    read: (userId: string) => repository.read(userId),
    mutate(userId: string, envelope: CommandEnvelope) {
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(envelope.command))
        .digest('hex');
      return repository.transact(userId, (state) => {
        const response = applyCommand(state, envelope, fingerprint, {
          now: new Date().toISOString(),
          id: randomUUID,
        });
        return { state: response.state, value: response };
      });
    },
    async report(userId: string, period: '7天' | '30天' | '本月' | '全部') {
      return createReport(await repository.read(userId), period);
    },
  };
}
