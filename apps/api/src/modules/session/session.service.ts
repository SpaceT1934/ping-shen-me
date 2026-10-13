import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DomainError } from '@apple/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { GardenRepository } from '../../repositories/garden.repository.js';
import type { Env } from '../../config/env.js';
const cookieName = 'apple_session';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function createSessionService(repository: GardenRepository, env: Env) {
  const resolve = async (request: FastifyRequest) => {
    const token = request.cookies[cookieName];
    return token && /^[\w-]{43}$/.test(token) ? repository.resolveSession(hash(token)) : null;
  };
  return {
    async require(request: FastifyRequest) {
      const userId = await resolve(request);
      if (!userId) throw new DomainError('UNAUTHORIZED', '会话已失效，请重新打开页面', 401);
      return userId;
    },
    async start(request: FastifyRequest, reply: FastifyReply) {
      const existing = await resolve(request);
      if (existing) return existing;
      const token = randomBytes(32).toString('base64url');
      const userId = randomUUID();
      const expires = new Date(Date.now() + 180 * 86400000);
      await repository.createSession(hash(token), userId, expires.toISOString());
      reply.setCookie(cookieName, token, {
        path: '/api',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.COOKIE_SECURE,
        expires,
      });
      return userId;
    },
  };
}
