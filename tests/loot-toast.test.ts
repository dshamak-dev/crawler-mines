import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('loot toast polish', () => {
  const toast = readFileSync(resolve(__dirname, '../native/src/ui/LootToast.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');

  it('anchors toasts at the top, just below the HUD', () => {
    expect(toast).not.toMatch(/bottom:\s*\d+/);
    expect(toast).toContain('top = 8');
    expect(play).toContain('top={hudH + 8}');
    expect(play).toContain('setHudH');
  });

  it('dismisses after 2s, with a shorter reduce-motion timeout', () => {
    expect(toast).toContain('export const LOOT_TOAST_MS = 2000');
    expect(toast).toContain('export const LOOT_TOAST_REDUCE_MOTION_MS = 900');
    expect(toast).toContain('reduceMotion ? LOOT_TOAST_REDUCE_MOTION_MS : LOOT_TOAST_MS');
    expect(toast).not.toMatch(/last \? 2400 : 1400/);
  });
});
