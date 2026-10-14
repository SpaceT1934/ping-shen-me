import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from '../src/lib/uuid';

afterEach(() => vi.unstubAllGlobals());

describe('createUuid', () => {
  it('works when an HTTP browser omits crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0),
    });

    expect(createUuid()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('still creates a valid ID in older browsers without Web Crypto', () => {
    vi.stubGlobal('crypto', undefined);

    expect(createUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
