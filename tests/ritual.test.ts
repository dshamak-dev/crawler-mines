import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_FLOORS,
  COLLECTION_KEY,
  consumeRitual,
  createGameFromLayout,
  dig,
  emptyCollection,
  emptyRitual,
  extract,
  isArenaFloor,
  isUsable,
  loadCollection,
  loadRun,
  mulberry32,
  normalizeRitual,
  resumeLabel,
  riteFloorConfig,
  ritualCombo,
  ritualLockedBossId,
  type ItemId,
  type KeyStore,
  type RitualSlots,
} from '../src/engine';
import { createGameStore } from '../src/store/gameStore';

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

function packed(
  items: Partial<Record<ItemId, number>>,
  gold = 0,
): ReturnType<typeof emptyCollection> {
  const meta = emptyCollection();
  meta.gold = gold;
  for (const [id, n] of Object.entries(items) as Array<[ItemId, number]>) {
    meta.items[id] = n;
  }
  return meta;
}

const RITE_PACK: Partial<Record<ItemId, number>> = {
  'witchcraft-bag': 1,
  'scroll-of-portal': 1,
  'bone-dust': 1,
  'wrath-head': 1,
  gem: 2,
};

describe('ritual combo', () => {
  it('accepts scroll + dust + one head in any order and locks that boss', () => {
    const orders: RitualSlots[] = [
      ['scroll-of-portal', 'bone-dust', 'wrath-head'],
      ['wrath-head', 'scroll-of-portal', 'bone-dust'],
      ['bone-dust', 'wrath-head', 'scroll-of-portal'],
    ];
    for (const slots of orders) {
      const combo = ritualCombo(slots);
      expect(combo.ok).toBe(true);
      expect(combo.bossId).toBe('wrath');
      expect(ritualLockedBossId(slots)).toBe('wrath');
    }
    expect(ritualCombo(['scroll-of-portal', 'bone-dust', 'gluttony-head']).bossId).toBe('gluttony');
    expect(ritualCombo(['lust-head', 'bone-dust', 'scroll-of-portal']).bossId).toBe('lust');
  });

  it('rejects missing pieces, two heads, or an empty well', () => {
    expect(ritualCombo(emptyRitual()).ok).toBe(false);
    expect(ritualCombo(['scroll-of-portal', 'bone-dust', null]).ok).toBe(false);
    expect(ritualCombo(['scroll-of-portal', 'bone-dust', 'gem']).ok).toBe(false);
    expect(ritualCombo(['scroll-of-portal', 'wrath-head', 'gluttony-head']).ok).toBe(false);
    expect(ritualCombo(['bone-dust', 'bone-dust', 'wrath-head']).ok).toBe(false);
  });

  it('marks only the witchcraft bag as usable from Collection', () => {
    expect(isUsable('witchcraft-bag')).toBe(true);
    expect(isUsable('scroll-of-portal')).toBe(false);
    expect(isUsable('bone-dust')).toBe(false);
    expect(isUsable('gluttony-head')).toBe(false);
  });
});

describe('consumeRitual', () => {
  it('burns the bag and the three socketed reagents and writes the pack', () => {
    const store = memoryStore();
    const next = consumeRitual(
      packed(RITE_PACK, 40),
      ['bone-dust', 'wrath-head', 'scroll-of-portal'],
      store,
    );
    expect(next).not.toBeNull();
    expect(next!.gold).toBe(40);
    expect(next!.items['witchcraft-bag']).toBe(0);
    expect(next!.items['scroll-of-portal']).toBe(0);
    expect(next!.items['bone-dust']).toBe(0);
    expect(next!.items['wrath-head']).toBe(0);
    expect(next!.items.gem).toBe(2);
    expect(loadCollection(store).items['witchcraft-bag']).toBe(0);
    expect(loadCollection(store).gold).toBe(40);
  });

  it('does not consume on an invalid combo or a missing bag', () => {
    const store = memoryStore();
    expect(
      consumeRitual(packed(RITE_PACK, 9), ['scroll-of-portal', 'bone-dust', null], store),
    ).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items['witchcraft-bag']).toBe(0);
    expect(
      consumeRitual(
        packed({ 'scroll-of-portal': 1, 'bone-dust': 1, 'wrath-head': 1 }, 0),
        ['scroll-of-portal', 'bone-dust', 'wrath-head'],
        store,
      ),
    ).toBeNull();
    expect(loadCollection(store).items['scroll-of-portal']).toBe(0);
  });
});

describe('startRite', () => {
  it('starts a free one-floor arena rite locked to the socketed head', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({ v: 1, gold: 99, items: RITE_PACK }),
    });
    const game = createGameStore(store);
    const slots: RitualSlots = ['scroll-of-portal', 'wrath-head', 'bone-dust'];
    expect(game.getState().startRite(slots, mulberry32(3))).toBe(true);
    const run = game.getState().run;
    expect(run?.rite).toBe(true);
    expect(run?.mode).toBe('campaign');
    expect(run?.floor).toBe(CAMPAIGN_FLOORS.length - 1);
    expect(run?.lockedBossId).toBe('wrath');
    expect(run?.game.boss?.id).toBe('wrath');
    expect(run?.game.chests).toBe(0);
    expect(run?.game.cells.some((c) => c.kind === 'chest')).toBe(false);
    expect(isArenaFloor(run!.game)).toBe(true);
    expect(run?.game.width).toBe(riteFloorConfig().width);
    expect(run?.game.height).toBe(riteFloorConfig().height);
    expect(run?.game.mines).toBe(riteFloorConfig().mines);
    expect(game.getState().meta.gold).toBe(99);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(0);
    expect(game.getState().meta.items['wrath-head']).toBe(0);
    expect(resumeLabel(run!)).toBe('Boss rite');
    expect(loadRun(store).run?.rite).toBe(true);
    expect(loadRun(store).run?.lockedBossId).toBe('wrath');
  });

  it('returns false and leaves the pack on an invalid Use', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({ v: 1, gold: 10, items: RITE_PACK }),
    });
    const game = createGameStore(store);
    expect(game.getState().startRite(['scroll-of-portal', 'bone-dust', null])).toBe(false);
    expect(game.getState().run).toBeNull();
    expect(game.getState().meta.items['witchcraft-bag']).toBe(1);
    expect(game.getState().meta.gold).toBe(10);
    expect(loadCollection(store).items['witchcraft-bag']).toBe(1);
  });
});

describe('arena door wreck', () => {
  it('loses immediately when a neighboring blast wrecks the rite door', () => {
    const game = createGameFromLayout(['B.*', '...', '...']);
    expect(game.chests).toBe(0);
    expect(isArenaFloor(game)).toBe(true);
    game.doorIndex = 1;
    const events = dig(game, 2, mulberry32(1));
    expect(game.cells[1].wrecked).toBe(true);
    expect(game.status).toBe('lost');
    expect(events.some((e) => e.type === 'lost')).toBe(true);
    expect(extract(game, 'campaign')).toEqual([]);
  });

  it('does not wreck a campaign-finale door while that floor still has chests', () => {
    const game = createGameFromLayout(['B$*', '...', '...']);
    expect(game.chests).toBeGreaterThan(0);
    expect(isArenaFloor(game)).toBe(false);
    game.doorIndex = 5;
    dig(game, 2, mulberry32(1));
    expect(game.cells[5].wrecked).toBe(false);
    expect(game.status).toBe('playing');
  });
});

describe('ritual UI wiring', () => {
  const collection = readFileSync(resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'), 'utf8');
  const sheet = readFileSync(resolve(__dirname, '../native/src/ui/RitualSheet.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');

  it('opens a 3-slot Use / Close sheet from Collection bag tap', () => {
    expect(collection).toContain('RitualSheet');
    expect(collection).toContain('isUsable');
    expect(collection).toContain('Use');
    expect(sheet).toContain('RITUAL_COPY');
    expect(sheet).toContain('Use');
    expect(sheet).toContain('Close');
    expect(sheet).toContain('Empty ritual slot');
    expect(route).toContain('startRite');
    expect(route).toContain('onStartRite');
    expect(route).toContain('playDeny');
  });
});

describe('normalizeRitual owned caps', () => {
  it('drops a reagent the pack cannot cover', () => {
    const meta = packed({ 'scroll-of-portal': 1, 'bone-dust': 0, 'wrath-head': 1 });
    expect(normalizeRitual(['scroll-of-portal', 'bone-dust', 'wrath-head'], meta)).toEqual([
      'scroll-of-portal',
      null,
      'wrath-head',
    ]);
  });
});
