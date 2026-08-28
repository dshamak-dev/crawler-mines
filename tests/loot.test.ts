import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  DIFFICULTIES,
  ITEMS,
  ITEM_IDS,
  addItem,
  collectLoot,
  createGame,
  createGameFromLayout,
  dig,
  emptyInventory,
  goldForLoot,
  inventoryTotal,
  loadCollection,
  mulberry32,
  rollLoot,
  saveCollection,
  stackedEntries,
  type Inventory,
  type ItemId,
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

describe('loot table', () => {
  it('rolls only known item ids', () => {
    const rng = mulberry32(123);
    const seen = new Set<ItemId>();
    for (let i = 0; i < 200; i++) seen.add(rollLoot(rng));
    for (const id of seen) expect(ITEM_IDS).toContain(id);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('only gold pouches convert floor chestValue into gold', () => {
    expect(goldForLoot('gold-pouch', 18)).toBe(18);
    expect(goldForLoot('rusty-key', 18)).toBe(0);
    expect(goldForLoot('torch-charm', 18)).toBe(0);
    expect(goldForLoot('gem', 18)).toBe(0);
    expect(goldForLoot('relic-shard', 18)).toBe(0);
  });

  it('stacks counts and ignores empty rows', () => {
    let inv = emptyInventory();
    inv = addItem(inv, 'gem', 2);
    inv = addItem(inv, 'gem');
    inv = addItem(inv, 'rusty-key');
    expect(inv.gem).toBe(3);
    expect(inventoryTotal(inv)).toBe(4);
    expect(stackedEntries(inv).map((row) => row.item.id)).toEqual(['rusty-key', 'gem']);
  });
});

describe('chest loot identity', () => {
  it('stamps every generated chest with a concrete item', () => {
    const game = createGame(DIFFICULTIES.easy, mulberry32(9));
    const chests = game.cells.filter((c) => c.kind === 'chest');
    expect(chests).toHaveLength(DIFFICULTIES.easy.chests);
    for (const c of chests) {
      expect(c.loot).not.toBeNull();
      expect(ITEM_IDS).toContain(c.loot);
      expect(c.gold).toBe(goldForLoot(c.loot as ItemId, DIFFICULTIES.easy.chestValue));
    }
  });

  it('opens a named item and records it on the floor inventory', () => {
    const game = createGameFromLayout(['.$', '..'], 12, 'rusty-key');
    const events = dig(game, idx(game, 1, 0), mulberry32(1));
    const chest = events.find((e) => e.type === 'chest');
    expect(chest).toMatchObject({ type: 'chest', itemId: 'rusty-key', gold: 0 });
    expect(game.gold).toBe(0);
    expect(game.chestsOpened).toBe(1);
    expect(game.inventory['rusty-key']).toBe(1);
    expect(game.cells[idx(game, 1, 0)].loot).toBe('rusty-key');
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
  });

  it('gold pouches still pay gold on a successful open', () => {
    const game = createGameFromLayout(['$..', '...'], 25, 'gold-pouch');
    const events = dig(game, 0, mulberry32(1));
    expect(events.some((e) => e.type === 'chest' && e.itemId === 'gold-pouch' && e.gold === 25)).toBe(
      true,
    );
    expect(game.gold).toBe(25);
    expect(game.inventory['gold-pouch']).toBe(1);
  });

  it('stacks two of the same item from separate chests', () => {
    const game = createGameFromLayout(['$', '*', '$'], 10, 'relic-shard');
    dig(game, 0, mulberry32(1));
    expect(game.inventory['relic-shard']).toBe(1);
    dig(game, 2, mulberry32(1));
    expect(game.inventory['relic-shard']).toBe(2);
    expect(game.chestsOpened).toBe(2);
    expect(game.gold).toBe(0);
  });
});

describe('open vs wreck', () => {
  it('does not grant loot or a chest event when a blast wrecks the chest', () => {
    const game = createGameFromLayout(['*$'], 10, 'torch-charm');
    const events = dig(game, 0, mulberry32(1));
    expect(events.some((e) => e.type === 'chest')).toBe(false);
    expect(game.gold).toBe(0);
    expect(game.inventory['torch-charm']).toBe(0);
    expect(inventoryTotal(game.inventory)).toBe(0);
    expect(game.chestsDestroyed).toBe(1);
    expect(game.cells[1].wrecked).toBe(true);
    expect(game.cells[1].loot).toBe('torch-charm');
    expect(game.cells[1].state).toBe('revealed');
  });

  it('keeps already-looted items when a later blast hits that chest', () => {
    const game = createGameFromLayout(['.$', '*.'], 15, 'gem');
    dig(game, idx(game, 1, 0), mulberry32(1));
    expect(game.inventory.gem).toBe(1);
    dig(game, idx(game, 0, 1), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
    expect(game.inventory.gem).toBe(1);
    expect(game.chestsDestroyed).toBe(0);
  });

  it('flood-fill opening still grants the rolled item', () => {
    const game = createGameFromLayout(['.$...', '.....', '....*'], 10, 'gem');
    dig(game, idx(game, 0, 0), mulberry32(1));
    expect(game.inventory.gem).toBe(1);
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
  });
});

describe('meta collection persistence', () => {
  it('saves stacked salvage and reloads it', () => {
    const store = memoryStore();
    let inv: Inventory = emptyInventory();
    inv = collectLoot(inv, 'rusty-key', store);
    inv = collectLoot(inv, 'rusty-key', store);
    inv = collectLoot(inv, 'gem', store);
    expect(inv['rusty-key']).toBe(2);
    const loaded = loadCollection(store);
    expect(loaded['rusty-key']).toBe(2);
    expect(loaded.gem).toBe(1);
    expect(loaded['gold-pouch']).toBe(0);
    expect(JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}').v).toBe(1);
  });

  it('ignores corrupt payloads and unknown ids', () => {
    const store = memoryStore({ [COLLECTION_KEY]: '{not json' });
    expect(loadCollection(store)).toEqual(emptyInventory());
    saveCollection(addItem(emptyInventory(), 'torch-charm', 4), store);
    const poisoned = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        items: { 'torch-charm': 4, 'magic-sword': 99, gem: 'nope' },
      }),
    });
    const loaded = loadCollection(poisoned);
    expect(loaded['torch-charm']).toBe(4);
    expect(loaded.gem).toBe(0);
  });
});

describe('item catalog', () => {
  it('gives every v1 item a name and one-line flavor', () => {
    for (const id of ITEM_IDS) {
      expect(ITEMS[id].name.length).toBeGreaterThan(2);
      expect(ITEMS[id].flavor.length).toBeGreaterThan(8);
    }
  });
});
