import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('journal font assets', () => {
  it('covers dynamic Chinese copy without overlapping ranges or stale asset names', () => {
    const css = readFileSync(new URL('../src/styles/journal-fonts.css', import.meta.url), 'utf8');
    const covered = new Set<number>();
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const coreFile = faces[0]?.[1].match(/fonts\/([^']+\.woff2)/)?.[1];
    expect(html).toContain(`/assets/journal/fonts/${coreFile}`);
    expect(faces.length).toBeGreaterThan(1);
    for (const [, face] of faces) {
      const filename = face.match(/fonts\/([^']+\.woff2)/)?.[1];
      expect(filename).toBeTruthy();
      const bytes = readFileSync(
        new URL(`../public/assets/journal/fonts/${filename}`, import.meta.url),
      );
      expect(bytes.subarray(0, 4).toString()).toBe('wOF2');
      const fingerprint = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      expect(filename).toContain(fingerprint);
      expect(face).toContain('font-weight: 400;');
      for (const [, first, last] of face.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/g)) {
        for (let point = parseInt(first, 16); point <= parseInt(last || first, 16); point++) {
          expect(covered.has(point), `overlapping U+${point.toString(16)}`).toBe(false);
          covered.add(point);
        }
      }
    }
    // These user/AI phrases were absent from the old frontend-only subset.
    for (const char of '今天跑步游泳阅读财务健身练琴复盘小树苗幼树茂盛树成熟树ABCxyz0123456789，。！？') {
      expect(covered.has(char.codePointAt(0)!), `missing ${char}`).toBe(true);
    }
    expect(covered.size).toBeGreaterThan(7000);
  });
});
