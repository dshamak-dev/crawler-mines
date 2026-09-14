import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_COST,
  HARD_COST,
  LEGACY_TUTORIAL_KEY,
  OFFERING_TIP_WORLD,
  START_TIP_WORLD,
  TIPS,
  TIPS_KEY,
  TIP_CATALOG,
  TIP_IDS,
  TORCH_HINT_COUNT,
  TORCH_HINT_MS,
  isTipId,
  loadSeenTips,
  markTipSeen,
  orderedSeen,
  pickTip,
  playTipWorld,
  saveSeenTips,
  type KeyStore,
} from '../src/engine';

function memoryStore(seed: Record<string, string> = {}): KeyStore {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('#63 tip catalog', () => {
  it('covers every required crawler-twist topic with distinct ids', () => {
    expect([...TIP_IDS]).toEqual([
      'bombs-wreck-loot',
      'chain-blasts',
      'win-clear-safes',
      'dig-vs-flag',
      'chests-sealed',
      'paid-entry',
      'offerings',
      'arena-door',
      'torch-use',
    ]);
    expect(TIP_CATALOG).toHaveLength(TIP_IDS.length);
    for (const id of TIP_IDS) {
      expect(TIPS[id].id).toBe(id);
      expect(TIPS[id].title.length).toBeGreaterThan(0);
      expect(TIPS[id].body.length).toBeGreaterThan(0);
      expect(TIPS[id].body).not.toMatch(/\n/);
    }

    expect(TIPS['bombs-wreck-loot'].body).toMatch(/don't kill you/i);
    expect(TIPS['bombs-wreck-loot'].body).toMatch(/wreck/i);
    expect(TIPS['chain-blasts'].body).toMatch(/neighbor/i);
    expect(TIPS['win-clear-safes'].body).toMatch(/every safe/i);
    expect(TIPS['win-clear-safes'].body).toMatch(/may stay covered/i);
    expect(TIPS['dig-vs-flag'].body).toMatch(/long-press/i);
    expect(TIPS['dig-vs-flag'].body).toMatch(/toggle/i);
    expect(TIPS['chests-sealed'].body).toMatch(/sealed until you clear/i);
    expect(TIPS['paid-entry'].body).toContain(String(HARD_COST));
    expect(TIPS['paid-entry'].body).toContain(String(CAMPAIGN_COST));
    expect(TIPS['paid-entry'].body).toMatch(/Hard key/);
    expect(TIPS['paid-entry'].body).toMatch(/Campaign key/);
    expect(TIPS['offerings'].body).toMatch(/two wells/i);
    expect(TIPS['arena-door'].body).toMatch(/8-ring/);
    expect(TIPS['arena-door'].body).toMatch(/instant lose/i);
    expect(TIPS['torch-use'].body).toContain(String(TORCH_HINT_COUNT));
    expect(TIPS['torch-use'].body).toContain(String(TORCH_HINT_MS / 1000));
    expect(TIPS['torch-use'].title).toMatch(/Torch Use/);
  });

  it('paces play tips one at a time across early beats', () => {
    const seen = new Set<string>();
    const easy = playTipWorld({ holdPlay: false, arena: false, chests: 6, torchCount: 0 });
    expect(pickTip(seen, easy)?.id).toBe('bombs-wreck-loot');

    seen.add('bombs-wreck-loot');
    expect(pickTip(seen, playTipWorld({ holdPlay: true, arena: false, chests: 6, torchCount: 0 }))).toBeNull();
    expect(pickTip(seen, easy)?.id).toBe('chain-blasts');

    seen.add('chain-blasts');
    expect(pickTip(seen, easy)?.id).toBe('win-clear-safes');
    seen.add('win-clear-safes');
    expect(pickTip(seen, easy)?.id).toBe('dig-vs-flag');
    seen.add('dig-vs-flag');
    expect(pickTip(seen, easy)?.id).toBe('chests-sealed');

    const noChests = playTipWorld({ holdPlay: false, arena: false, chests: 0, torchCount: 0 });
    expect(pickTip(seen, noChests)).toBeNull();

    const arena = playTipWorld({ holdPlay: false, arena: true, chests: 0, torchCount: 0 });
    expect(pickTip(seen, arena)?.id).toBe('arena-door');

    seen.add('chests-sealed');
    seen.add('arena-door');
    const torch = playTipWorld({ holdPlay: false, arena: false, chests: 4, torchCount: 1 });
    expect(pickTip(seen, torch)?.id).toBe('torch-use');
    expect(pickTip(seen, easy)).toBeNull();
  });

  it('keeps Start and offering tips off the play queue', () => {
    expect(pickTip([], START_TIP_WORLD)?.id).toBe('paid-entry');
    expect(pickTip(['paid-entry'], START_TIP_WORLD)).toBeNull();
    expect(pickTip([], OFFERING_TIP_WORLD)?.id).toBe('offerings');
    expect(
      pickTip([], playTipWorld({ holdPlay: false, arena: true, chests: 8, torchCount: 2 }))?.id,
    ).toBe('bombs-wreck-loot');
    expect(TIPS['paid-entry'].surface).toBe('start');
    expect(TIPS.offerings.surface).toBe('offerings');
  });

  it('persists seen ids and migrates the old single tutorial flag', () => {
    const store = memoryStore();
    expect([...loadSeenTips(store)]).toEqual([]);
    const after = markTipSeen(store, 'dig-vs-flag');
    expect([...after]).toEqual(['dig-vs-flag']);
    expect(store.getItem(TIPS_KEY)).toBe(JSON.stringify(['dig-vs-flag']));
    expect(isTipId('nope')).toBe(false);
    markTipSeen(store, 'nope');
    expect(JSON.parse(store.getItem(TIPS_KEY)!)).toEqual(['dig-vs-flag']);

    const legacy = memoryStore({ [LEGACY_TUTORIAL_KEY]: '1' });
    expect(orderedSeen(loadSeenTips(legacy))).toEqual([
      'bombs-wreck-loot',
      'chain-blasts',
      'win-clear-safes',
    ]);
    const still = pickTip(
      loadSeenTips(legacy),
      playTipWorld({ holdPlay: false, arena: false, chests: 3, torchCount: 0 }),
    );
    expect(still?.id).toBe('dig-vs-flag');

    saveSeenTips(legacy, loadSeenTips(legacy));
    expect(JSON.parse(legacy.getItem(TIPS_KEY)!)).toEqual([
      'bombs-wreck-loot',
      'chain-blasts',
      'win-clear-safes',
    ]);
  });

  it('ignores junk persisted ids', () => {
    const store = memoryStore({
      [TIPS_KEY]: JSON.stringify({ seen: ['bombs-wreck-loot', '??', 12, 'torch-use', 'bombs-wreck-loot'] }),
    });
    expect(orderedSeen(loadSeenTips(store))).toEqual(['bombs-wreck-loot', 'torch-use']);
  });
});

describe('#63 UI wiring', () => {
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const title = readFileSync(resolve(__dirname, '../native/src/ui/TitleMenu.tsx'), 'utf8');
  const sheet = readFileSync(resolve(__dirname, '../native/src/ui/TipSheet.tsx'), 'utf8');

  it('reuses the PlayScreen tablet queue instead of a second tutorial', () => {
    expect(play).toContain('pickTip');
    expect(play).toContain('playTipWorld');
    expect(play).toContain('holdPlayTip');
    expect(play).toContain('setHoldPlayTip(true)');
    expect(play).toContain('setHoldPlayTip(false)');
    expect(play).toContain('markTipSeen');
    expect(play).toContain('<TipSheet');
    expect(play).not.toContain("crawler-mines-tutorial");
    expect(play).not.toContain('They kill the loot next to them');
    expect(sheet).toContain('Overlay');
    expect(sheet).toContain('Tablet');
    expect(sheet).toContain('I understand');
  });

  it('shows paid-entry and offerings tips on the existing Start tablets', () => {
    expect(title).toContain('START_TIP_WORLD');
    expect(title).toContain('OFFERING_TIP_WORLD');
    expect(title).toContain('<TipSheet');
    expect(title).toContain('markTipSeen');
  });
});
