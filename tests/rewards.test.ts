import { describe, expect, it } from 'vitest';
import {
  CHEST_TIERS,
  ITEM_IDS,
  chestNotices,
  collectLoot,
  createGameFromLayout,
  dig,
  emptyInventory,
  inventoryTotal,
  loadCollection,
  mulberry32,
  stackedEntries,
  type GameEvent,
  type KeyStore,
} from '../src/engine';

function idx(game: { width: number }, x: number, y: number): number {
  return y * game.width + x;
}

function memoryStore(seed: Record<string, string> = {}): KeyStore {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function revealAllSafe(game: ReturnType<typeof createGameFromLayout>): GameEvent[] {
  const rng = mulberry32(1);
  let last: GameEvent[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const c = game.cells[i];
    if (c.kind !== 'mine' && c.state === 'hidden') last = dig(game, i, rng);
  }
  return last;
}

function playEventsLeakItem(events: GameEvent[]): boolean {
  return events.some((e) => {
    if (e.type === 'cleared') return false;
    if (e.type === 'chest') return 'itemId' in e || 'gold' in e;
    return 'itemId' in e;
  });
}

describe('no item reveal mid-run', () => {
  it('play events and floor inventory never expose inner loot before clear', () => {
    const game = createGameFromLayout(['.$.', '.*.'], 12, 'rusty-key');
    const found = dig(game, 1, mulberry32(1));
    expect(playEventsLeakItem(found)).toBe(false);
    expect(found.some((e) => e.type === 'chest' && e.tier === 'wooden')).toBe(true);
    expect(inventoryTotal(game.inventory)).toBe(0);
    expect(game.gold).toBe(0);
    expect(game.status).toBe('playing');
    for (const c of game.cells) {
      if (c.kind === 'chest' && c.state === 'revealed' && !c.wrecked) {
        expect(c.tier).toBe('wooden');
        expect(c.loot).toBe('rusty-key');
      }
    }
  });
});

describe('find/break toasts are tier', () => {
  it('find and smash notices carry only the chest tier', () => {
    const game = createGameFromLayout(['.$', '*.'], 10, 'gem');
    const found = dig(game, idx(game, 1, 0), mulberry32(1));
    const foundNotes = chestNotices(found, game.cells);
    expect(foundNotes).toEqual([{ kind: 'found', tier: 'iron', index: idx(game, 1, 0) }]);
    expect(foundNotes.every((n) => CHEST_TIERS.includes(n.tier))).toBe(true);

    const smashed = dig(game, idx(game, 0, 1), mulberry32(1));
    const brokenNotes = chestNotices(smashed, game.cells);
    expect(brokenNotes).toEqual([{ kind: 'broken', tier: 'iron', index: idx(game, 1, 0) }]);
    expect(JSON.stringify(brokenNotes)).not.toMatch(new RegExp(ITEM_IDS.join('|')));
  });
});

describe('rewards and collection add only on successful clear', () => {
  it('grants inner items and persists them only after the floor is cleared', () => {
    const store = memoryStore();
    let meta = emptyInventory();
    const game = createGameFromLayout(['.$.', '.*.'], 18, 'rusty-key');

    dig(game, 1, mulberry32(1));
    expect(inventoryTotal(game.inventory)).toBe(0);
    expect(loadCollection(store)).toEqual(emptyInventory());

    const last = revealAllSafe(game);
    const cleared = last.find((e) => e.type === 'cleared');
    expect(game.status).toBe('cleared');
    expect(cleared && cleared.type === 'cleared').toBe(true);
    if (!cleared || cleared.type !== 'cleared') throw new Error('expected clear');
    expect(cleared.rewards).toEqual([{ index: 1, itemId: 'rusty-key', gold: 0 }]);
    expect(game.inventory['rusty-key']).toBe(1);

    for (const reward of cleared.rewards) {
      meta = collectLoot(meta, reward.itemId, store);
    }
    expect(loadCollection(store)['rusty-key']).toBe(1);
    expect(stackedEntries(loadCollection(store)).map((row) => row.item.id)).toEqual(['rusty-key']);
  });
});

describe('wrecks grant nothing', () => {
  it('a wrecked chest, found or not, never pays loot or collection', () => {
    const store = memoryStore();
    let meta = emptyInventory();
    const game = createGameFromLayout(['*$'], 10, 'torch-charm');
    const events = dig(game, 0, mulberry32(1));
    expect(game.cells[1].wrecked).toBe(true);
    expect(game.inventory['torch-charm']).toBe(0);
    expect(inventoryTotal(game.inventory)).toBe(0);
    const cleared = events.find((e) => e.type === 'cleared');
    expect(cleared && cleared.type === 'cleared' && cleared.rewards).toEqual([]);
    if (cleared && cleared.type === 'cleared') {
      for (const reward of cleared.rewards) {
        meta = collectLoot(meta, reward.itemId, store);
      }
    }
    expect(loadCollection(store)).toEqual(emptyInventory());

    const foundThenWrecked = createGameFromLayout(['.$', '*.'], 10, 'gem');
    dig(foundThenWrecked, idx(foundThenWrecked, 1, 0), mulberry32(1));
    const boom = dig(foundThenWrecked, idx(foundThenWrecked, 0, 1), mulberry32(1));
    expect(foundThenWrecked.cells[idx(foundThenWrecked, 1, 0)].wrecked).toBe(true);
    const boomClear = boom.find((e) => e.type === 'cleared');
    if (boomClear && boomClear.type === 'cleared') {
      expect(boomClear.rewards).toEqual([]);
    }
    expect(inventoryTotal(foundThenWrecked.inventory)).toBe(0);
  });
});
