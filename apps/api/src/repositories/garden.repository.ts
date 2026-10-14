import type { GardenState } from '@apple/contracts';
export interface GardenRepository {
  read(userId: string): Promise<GardenState>;
  transact<T>(
    userId: string,
    transform: (state: GardenState) => { state: GardenState; value: T },
  ): Promise<T>;
  transactIdempotent<T>(
    userId: string,
    key: string,
    fingerprint: string,
    transform: (state: GardenState) => { state: GardenState; value: T },
  ): Promise<T>;
  createSession(tokenHash: string, userId: string, expiresAt: string): Promise<void>;
  resolveSession(tokenHash: string): Promise<string | null>;
  probe(): Promise<void>;
  close(): Promise<void>;
  readonly driver: 'pglite' | 'postgres';
}
