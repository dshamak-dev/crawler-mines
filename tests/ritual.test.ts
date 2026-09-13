import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_FLOORS,
  COLLECTION_KEY,
  consumeRitual,
  createGame,
  createGameFromLayout,
  dig,
  emptyCollection,
  emptyRitual,
  extract,
  isArenaFloor,
  canUseFromPreview,
  isUsable,
  loadCollection,
  loadRun,
  mulberry32,
  neighbors,
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
    expect(canUseFromPreview('witchcraft-bag', 1)).toBe(true);
    expect(canUseFromPreview('witchcraft-bag', 2)).toBe(true);
    expect(canUseFromPreview('witchcraft-bag', 0)).toBe(false);
    expect(canUseFromPreview('witchcraft-bag', -1)).toBe(false);
    expect(canUseFromPreview('bone-dust', 4)).toBe(false);
    expect(canUseFromPreview('scroll-of-portal', 1)).toBe(false);
    expect(canUseFromPreview('gluttony-head', 1)).toBe(false);
    expect(canUseFromPreview('gem', 9)).toBe(false);
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
    expect(game.cells[1].state).toBe('revealed');
    expect(game.status).toBe('lost');
    expect(events.some((e) => e.type === 'lost')).toBe(true);
    const blast = events.find((e) => e.type === 'explode');
    expect(blast && blast.type === 'explode' && blast.wrecked).toContain(1);
    expect(extract(game, 'campaign')).toEqual([]);
  });

  it('spawns Campaign floor 5 with 0 chests and a fragile generated door', () => {
    const game = createGame(CAMPAIGN_FLOORS[4], mulberry32(4), 'campaign');
    expect(CAMPAIGN_FLOORS[4].chests).toBe(0);
    expect(game.chests).toBe(0);
    expect(game.cells.some((c) => c.kind === 'chest')).toBe(false);
    expect(isArenaFloor(game)).toBe(true);
    expect(game.boss).not.toBeNull();
    expect(game.doorIndex).not.toBeNull();
    expect(game.cells[game.doorIndex!].kind).toBe('empty');
    expect(game.cells[game.doorIndex!].adjacentMines).toBeGreaterThan(0);
    expect(riteFloorConfig().chests).toBe(0);
    expect(riteFloorConfig()).toEqual(CAMPAIGN_FLOORS[4]);
  });

  it('loses a Campaign floor-5 arena when a door-ring mine blasts', () => {
    const game = createGame(CAMPAIGN_FLOORS[4], mulberry32(4), 'campaign');
    game.firstClickDone = true;
    const door = game.doorIndex;
    expect(door).not.toBeNull();
    const ring = neighbors(game.width, game.height, door!);
    const mine = ring.find((i) => game.cells[i].kind === 'mine' && !game.cells[i].exploded);
    expect(mine).toBeDefined();
    const events = dig(game, mine!, mulberry32(4), 'campaign');
    expect(game.cells[door!].wrecked).toBe(true);
    expect(game.status).toBe('lost');
    expect(events.some((e) => e.type === 'lost')).toBe(true);
    expect(extract(game, 'campaign')).toEqual([]);
  });

  it('extracts only when the arena door is still intact', () => {
    const intact = createGameFromLayout(['*B.', '...', '...'], 10, 'gold-pouch', undefined, 'lust');
    expect(isArenaFloor(intact)).toBe(true);
    intact.boss!.lives = 0;
    const door = intact.doorIndex!;
    intact.cells[door].state = 'revealed';
    const cleared = extract(intact, 'campaign');
    expect(cleared.some((e) => e.type === 'cleared')).toBe(true);
    expect(intact.status).toBe('cleared');

    const wrecked = createGameFromLayout(['B.*', '...', '...'], 10, 'gold-pouch', undefined, 'lust');
    wrecked.boss!.lives = 0;
    wrecked.doorIndex = 1;
    wrecked.cells[1].state = 'revealed';
    wrecked.cells[1].wrecked = true;
    expect(extract(wrecked, 'campaign')).toEqual([]);
    expect(wrecked.status).toBe('playing');
    expect(dig(wrecked, 1, mulberry32(1), 'campaign')).toEqual([{ type: 'deny' }]);
  });

  it('does not auto-extract after a killing blast that also wrecks the door', () => {
    const game = createGameFromLayout(['B*.', '...', '...'], 10, 'gold-pouch', undefined, 'lust');
    game.boss!.lives = 1;
    game.doorIndex = 0;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind === 'empty') game.cells[i].state = 'revealed';
    }
    const mine = game.cells.findIndex((c) => c.kind === 'mine');
    const events = dig(game, mine, mulberry32(1), 'campaign');
    expect(game.cells[0].wrecked).toBe(true);
    expect(game.status).toBe('lost');
    expect(events.some((e) => e.type === 'lost')).toBe(true);
    expect(events.some((e) => e.type === 'cleared')).toBe(false);
    expect(extract(game, 'campaign')).toEqual([]);
  });

  it('does not wreck a door on a boss floor that still has chests', () => {
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
  const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
  const sheet = readFileSync(resolve(__dirname, '../native/src/ui/RitualSheet.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const board = readFileSync(resolve(__dirname, '../native/src/ui/Board.tsx'), 'utf8');

  it('opens a preview sheet on item tap, then ritual from preview Use', () => {
    expect(collection).toContain('ItemPreviewSheet');
    expect(collection).toContain('previewForItem');
    expect(collection).toContain("tab === 'items' && Boolean(onStartRite)");
    expect(collection).toContain('setRitualOpen(true)');
    expect(collection).not.toContain('isUsable');
    expect(preview).toContain('canUseFromPreview');
    expect(preview).toContain('Use');
    expect(preview).toContain('Close');
    expect(preview).toContain('preview.qty');
    expect(sheet).toContain('RITUAL_COPY');
    expect(sheet).toContain('Use');
    expect(sheet).toContain('Close');
    expect(sheet).toContain('Empty ritual slot');
    expect(route).toContain('startRite');
    expect(route).toContain('onStartRite');
    expect(route).toContain('playDeny');
    expect(board).toContain('Gesture.LongPress()');
  });

  it('hides Found/Broken on arena floors and tags Fight/Exit', () => {
    expect(play).toContain('isArenaFloor');
    expect(play).toContain("? 'Exit' : 'Fight'");
    expect(play).toContain('showChestHud');
    expect(play).toContain('The exit is wrecked');
    expect(board).toContain('Wrecked exit door');
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
