import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('root vitest scope', () => {
  it('does not import native TypeScript modules', () => {
    for (const file of readdirSync('tests')) {
      if (!file.endsWith('.test.ts')) continue;
      const src = readFileSync(`tests/${file}`, 'utf8');
      expect(src, file).not.toMatch(/from ['"][^'"]*native\//);
    }
  });
});
