import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  DIFFICULTIES,
  ITEMS,
  ITEM_IDS,
  addItem,
  applyRewards,
  collectLoot,
  createGame,
  createGameFromLayout,
  dig,
  emptyCollection,
  emptyInventory,
  goldForLoot,
  inventoryTotal,
  loadCollection,
  mulberry32,
  campaignKeyDropRate,
  rollLoot,
  saveCollection,
  stackedEntries,
  tierForLoot,
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

  it('can roll Hard keys on any difficulty; Campaign keys only on Hard and Campaign', () => {
    const easyRng = mulberry32(7);
    const easySeen = new Set<ItemId>();
    for (let i = 0; i < 2500; i++) easySeen.add(rollLoot(easyRng, 'easy'));
    expect(easySeen.has('hard-key')).toBe(true);
    expect(easySeen.has('campaign-key')).toBe(false);

    const hardRng = mulberry32(7);
    const hardSeen = new Set<ItemId>();
    for (let i = 0; i < 2500; i++) hardSeen.add(rollLoot(hardRng, 'hard'));
    expect(hardSeen.has('hard-key')).toBe(true);
    expect(hardSeen.has('campaign-key')).toBe(true);
  });

  it('never rolls campaign-key on Easy or Medium', () => {
    for (const mode of ['easy', 'medium'] as const) {
      const rng = mulberry32(99);
      for (let i = 0; i < 5000; i++) {
        expect(rollLoot(rng, mode)).not.toBe('campaign-key');
      }
    }
  });

  it('rolls campaign-key at about 1% on Hard and Campaign', () => {
    for (const mode of ['hard', 'campaign'] as const) {
      expect(campaignKeyDropRate(mode)).toBeGreaterThan(0.008);
      expect(campaignKeyDropRate(mode)).toBeLessThan(0.012);
      const rng = mulberry32(mode === 'hard' ? 42 : 43);
      let keys = 0;
      const trials = 20000;
      for (let i = 0; i < trials; i++) {
        if (rollLoot(rng, mode) === 'campaign-key') keys += 1;
      }
      const rate = keys / trials;
      expect(rate).toBeGreaterThan(0.005);
      expect(rate).toBeLessThan(0.02);
    }
  });

  it('only gold pouches convert floor chestValue into gold', () => {
    expect(goldForLoot('gold-pouch', 18)).toBe(18);
    expect(goldForLoot('rusty-key', 18)).toBe(0);
    expect(goldForLoot('torch-charm', 18)).toBe(0);
    expect(goldForLoot('gem', 18)).toBe(0);
    expect(goldForLoot('relic-shard', 18)).toBe(0);
    expect(goldForLoot('hard-key', 18)).toBe(0);
    expect(goldForLoot('campaign-key', 18)).toBe(0);
  });

  it('stacks counts and ignores empty rows', () => {
    let inv = emptyInventory();
    inv = addItem(inv, 'gem', 2);
    inv = addItem(inv, 'gem');
    inv = addItem(inv, 'rusty-key');
    inv = addItem(inv, 'gold-pouch', 4);
    expect(inv.gem).toBe(3);
    expect(inventoryTotal(inv)).toBe(4);
    expect(stackedEntries(inv).map((row) => row.item.id)).toEqual(['rusty-key', 'gem']);
  });
});

describe('chest loot identity', () => {
  it('stamps every generated chest with a hidden item and a visible tier', () => {
    const game = createGame(DIFFICULTIES.easy, mulberry32(9), 'easy');
    const chests = game.cells.filter((c) => c.kind === 'chest');
    expect(chests).toHaveLength(DIFFICULTIES.easy.chests);
    for (const c of chests) {
      expect(c.loot).not.toBeNull();
      expect(ITEM_IDS).toContain(c.loot);
      expect(c.tier).toBe(tierForLoot(c.loot as ItemId));
      expect(c.gold).toBe(goldForLoot(c.loot as ItemId, DIFFICULTIES.easy.chestValue));
    }
  });

  it('finding a chest emits a tier notice and does not record the inner item', () => {
    const game = createGameFromLayout(['.$', '..', '.*'], 12, 'rusty-key');
    const events = dig(game, idx(game, 1, 0), mulberry32(1));
    const chest = events.find((e) => e.type === 'chest');
    expect(chest).toMatchObject({ type: 'chest', tier: 'wooden' });
    expect(chest && 'itemId' in chest).toBe(false);
    expect(game.gold).toBe(0);
    expect(game.chestsOpened).toBe(1);
    expect(game.inventory['rusty-key']).toBe(0);
    expect(game.cells[idx(game, 1, 0)].loot).toBe('rusty-key');
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
    expect(game.status).toBe('playing');
  });

  it('gold pouches pay gold only after a successful clear', () => {
    const game = createGameFromLayout(['.$.', '.*.'], 25, 'gold-pouch');
    const mid = dig(game, 1, mulberry32(1));
    expect(mid.some((e) => e.type === 'chest' && e.tier === 'wooden')).toBe(true);
    expect(game.gold).toBe(0);
    expect(game.inventory['gold-pouch']).toBe(0);
    expect(game.status).toBe('playing');
    const rng = mulberry32(1);
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind !== 'mine' && game.cells[i].state === 'hidden') {
        dig(game, i, rng);
      }
    }
    expect(game.status).toBe('cleared');
    expect(game.gold).toBe(25);
    expect(game.inventory['gold-pouch']).toBe(0);
  });

  it('stacks two of the same item from separate chests on clear', () => {
    const game = createGameFromLayout(['$.$', '.*.'], 10, 'relic-shard');
    dig(game, 0, mulberry32(1));
    expect(game.inventory['relic-shard']).toBe(0);
    dig(game, 2, mulberry32(1));
    expect(game.inventory['relic-shard']).toBe(0);
    expect(game.chestsOpened).toBe(2);
    const rng = mulberry32(1);
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind !== 'mine' && game.cells[i].state === 'hidden') {
        dig(game, i, rng);
      }
    }
    expect(game.status).toBe('cleared');
    expect(game.inventory['relic-shard']).toBe(2);
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
    expect(game.cells[1].tier).toBe('iron');
    expect(game.cells[1].state).toBe('revealed');
    const cleared = events.find((e) => e.type === 'cleared');
    expect(cleared && cleared.type === 'cleared' && cleared.rewards).toEqual([]);
  });

  it('a later blast can still wreck a found chest, and that chest grants nothing', () => {
    const game = createGameFromLayout(['.$', '*.'], 15, 'gem');
    dig(game, idx(game, 1, 0), mulberry32(1));
    expect(game.chestsOpened).toBe(1);
    expect(game.inventory.gem).toBe(0);
    dig(game, idx(game, 0, 1), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(true);
    expect(game.inventory.gem).toBe(0);
    expect(game.chestsDestroyed).toBe(1);
    expect(game.chestsOpened).toBe(0);
  });

  it('flood-fill finding still withholds the rolled item until clear', () => {
    const game = createGameFromLayout(['.$..', '....', '...*'], 10, 'gem');
    const events = dig(game, idx(game, 0, 0), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
    expect(game.cells[idx(game, 1, 0)].state).toBe('revealed');
    if (game.status !== 'cleared') {
      expect(game.inventory.gem).toBe(0);
      expect(events.some((e) => e.type === 'chest' && e.tier === 'iron')).toBe(true);
    }
  });
});

describe('meta collection persistence', () => {
  it('saves stacked salvage and reloads it', () => {
    const store = memoryStore();
    let meta = emptyCollection();
    meta = collectLoot(meta, 'rusty-key', store);
    meta = collectLoot(meta, 'rusty-key', store);
    meta = collectLoot(meta, 'gem', store);
    expect(meta.items['rusty-key']).toBe(2);
    const loaded = loadCollection(store);
    expect(loaded.items['rusty-key']).toBe(2);
    expect(loaded.items.gem).toBe(1);
    expect(loaded.items['gold-pouch']).toBe(0);
    expect(loaded.gold).toBe(0);
    expect(JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}').v).toBe(1);
  });

  it('turns gold pouches into wallet coins and never stacks pouches', () => {
    const store = memoryStore();
    let meta = emptyCollection();
    meta = applyRewards(
      meta,
      [
        { itemId: 'gold-pouch', gold: 10 },
        { itemId: 'gold-pouch', gold: 15 },
        { itemId: 'rusty-key', gold: 0 },
      ],
      store,
    );
    expect(meta.gold).toBe(25);
    expect(meta.items['gold-pouch']).toBe(0);
    expect(meta.items['rusty-key']).toBe(1);
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(25);
    expect(loaded.items['gold-pouch']).toBe(0);
    expect(stackedEntries(loaded.items).map((row) => row.item.id)).toEqual(['rusty-key']);
    const payload = JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}') as {
      gold?: number;
      items?: Record<string, number>;
    };
    expect(payload.gold).toBe(25);
    expect(payload.items?.['gold-pouch']).toBe(0);
  });

  it('ignores corrupt payloads, unknown ids, and leftover pouch stacks', () => {
    const store = memoryStore({ [COLLECTION_KEY]: '{not json' });
    expect(loadCollection(store)).toEqual(emptyCollection());
    saveCollection(
      applyRewards(emptyCollection(), [{ itemId: 'torch-charm', gold: 0 }], store),
      store,
    );
    const poisoned = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 'nope',
        items: { 'torch-charm': 4, 'magic-sword': 99, gem: 'nope', 'gold-pouch': 12 },
      }),
    });
    const loaded = loadCollection(poisoned);
    expect(loaded.items['torch-charm']).toBe(4);
    expect(loaded.items.gem).toBe(0);
    expect(loaded.items['gold-pouch']).toBe(0);
    expect(loaded.gold).toBe(0);
  });

  it('reloads a persisted gold integer; rewards still only add coins', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 40,
        items: { gem: 1 },
      }),
    });
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(40);
    expect(loaded.items.gem).toBe(1);
    const next = applyRewards(loaded, [{ itemId: 'gold-pouch', gold: 18 }], store);
    expect(next.gold).toBe(58);
    expect(loadCollection(store).gold).toBe(58);
  });
});

describe('item catalog', () => {
  it('gives every v1 item a name and one-line flavor', () => {
    for (const id of ITEM_IDS) {
      expect(ITEMS[id].name.length).toBeGreaterThan(2);
      expect(ITEMS[id].flavor.length).toBeGreaterThan(8);
    }
  });

  it('maps inner items to a visible chest tier', () => {
    expect(tierForLoot('gold-pouch')).toBe('wooden');
    expect(tierForLoot('rusty-key')).toBe('wooden');
    expect(tierForLoot('torch-charm')).toBe('iron');
    expect(tierForLoot('gem')).toBe('iron');
    expect(tierForLoot('relic-shard')).toBe('gilded');
    expect(tierForLoot('hard-key')).toBe('rare');
    expect(tierForLoot('campaign-key')).toBe('rare');
  });
});
