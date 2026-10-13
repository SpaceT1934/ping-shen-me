import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@apple/contracts';
import type { GardenRepository } from '../../repositories/garden.repository.js';
export const registerHealthRoutes: FastifyPluginAsync<{ repository: GardenRepository }> = async (
  app,
  { repository },
) => {
  app.get('/health', async (): Promise<HealthResponse> => ({ status: 'ok', service: 'apple-api' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await repository.probe();
      return { status: 'ok', database: 'connected', driver: repository.driver };
    } catch {
      return reply.status(503).send({ status: 'unavailable', database: 'disconnected' });
    }
  });
};
