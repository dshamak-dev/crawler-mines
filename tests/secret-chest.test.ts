import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHEST_TIERS,
  COLLECTION_KEY,
  DIFFICULTIES,
  configFor,
  SECRET_BAG_RATE,
  SECRET_CHEST,
  SECRET_CHEST_BUY,
  SECRET_CHEST_ID,
  SECRET_CHEST_SPAWN_RATE,
  SECRET_DUST_RATE,
  SECRET_NORMAL_TABLE,
  SECRET_SCROLL_RATE,
  SHOP_BUY,
  buySecretChest,
  buyableEntries,
  createGame,
  createGameFromLayout,
  emptyCollection,
  emptyInventory,
  isBuyable,
  isItemId,
  isLockedSecretChest,
  isSecretChestId,
  loadCollection,
  mulberry32,
  rollSecretChestLoot,
  sfxFromEvents,
  stackedEntries,
  type ItemId,
  type KeyStore,
  type Rng,
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

function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
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

function banked(items: Partial<Record<ItemId, number>>, gold = 0): string {
  return JSON.stringify({
    v: 1,
    gold,
    items,
  });
}

function layoutStore(items: Partial<Record<ItemId, number>>, gold = 0) {
  const store = memoryStore({ [COLLECTION_KEY]: banked(items, gold) });
  const game = createGameStore(store);
  const board = createGameFromLayout(['.S.', '.*.', '...'], 10, 'gem');
  game.setState({
    run: {
      mode: 'easy',
      floor: 0,
      game: board,
      grantKey: 'secret-test',
      kit: emptyInventory(),
    },
    meta: loadCollection(store),
    runLoot: emptyInventory(),
  });
  return { game, store };
}

function revealAllSafe(gameStore: ReturnType<typeof createGameStore>, rng: Rng = mulberry32(1)) {
  let last: ReturnType<typeof gameStore.getState>['applyDig'] extends (
    index: number,
    rng?: Rng,
  ) => infer E
    ? E
    : never = [];
  for (;;) {
    const board = gameStore.getState().run?.game;
    if (!board || board.status !== 'playing') return last;
    const i = board.cells.findIndex((c) => c.kind !== 'mine' && c.state === 'hidden');
    if (i < 0) return last;
    last = gameStore.getState().applyDig(i, rng);
  }
}

const NORMAL_IDS = new Set(SECRET_NORMAL_TABLE.map((row) => row.itemId));

describe('secret chest loot table', () => {
  it('uses sequential exclusive rares then two chest-table normals', () => {
    expect(rollSecretChestLoot(seqRng([0]))).toEqual(['scroll-of-portal']);
    expect(rollSecretChestLoot(seqRng([0.019]))).toEqual(['scroll-of-portal']);
    expect(rollSecretChestLoot(seqRng([0.02]))).toEqual(['witchcraft-bag']);
    expect(rollSecretChestLoot(seqRng([0.049]))).toEqual(['witchcraft-bag']);
    expect(rollSecretChestLoot(seqRng([0.05]))).toEqual(['bone-dust']);
    expect(rollSecretChestLoot(seqRng([0.099]))).toEqual(['bone-dust']);
    const fallback = rollSecretChestLoot(seqRng([0.1, 0, 0]));
    expect(fallback).toHaveLength(2);
    expect(fallback[0]).toBe('gold-pouch');
    expect(fallback[1]).toBe('gold-pouch');
  });

  it('does not also grant two normals when a rare hits', () => {
    expect(rollSecretChestLoot(seqRng([0]))).toHaveLength(1);
    expect(rollSecretChestLoot(seqRng([0.02]))).toHaveLength(1);
    expect(rollSecretChestLoot(seqRng([0.05]))).toHaveLength(1);
  });

  it('draws fallback items from pouch / key / torch / gem / shard weights', () => {
    expect(SECRET_NORMAL_TABLE.map((row) => row.itemId)).toEqual([
      'gold-pouch',
      'rusty-key',
      'torch-charm',
      'gem',
      'relic-shard',
    ]);
    const rng = mulberry32(44);
    for (let i = 0; i < 400; i++) {
      const drops = rollSecretChestLoot(seqRng([0.5, rng(), rng()]));
      expect(drops).toHaveLength(2);
      for (const id of drops) {
        expect(NORMAL_IDS.has(id)).toBe(true);
        expect(id === 'hard-key' || id === 'campaign-key').toBe(false);
        expect(id === 'witchcraft-bag' || id === 'bone-dust' || id === 'scroll-of-portal').toBe(
          false,
        );
      }
    }
  });

  it('hits rare rates near 2% / 3% / 5% over many trials', () => {
    const rng = mulberry32(66);
    const trials = 20000;
    let scrolls = 0;
    let bags = 0;
    let dust = 0;
    let fallbacks = 0;
    for (let i = 0; i < trials; i++) {
      const drops = rollSecretChestLoot(rng);
      if (drops.length === 1 && drops[0] === 'scroll-of-portal') scrolls += 1;
      else if (drops.length === 1 && drops[0] === 'witchcraft-bag') bags += 1;
      else if (drops.length === 1 && drops[0] === 'bone-dust') dust += 1;
      else {
        expect(drops).toHaveLength(2);
        fallbacks += 1;
      }
    }
    expect(scrolls / trials).toBeGreaterThan(SECRET_SCROLL_RATE - 0.008);
    expect(scrolls / trials).toBeLessThan(SECRET_SCROLL_RATE + 0.008);
    expect(bags / trials).toBeGreaterThan(SECRET_BAG_RATE - 0.008);
    expect(bags / trials).toBeLessThan(SECRET_BAG_RATE + 0.008);
    expect(dust / trials).toBeGreaterThan(SECRET_DUST_RATE - 0.01);
    expect(dust / trials).toBeLessThan(SECRET_DUST_RATE + 0.01);
    expect(fallbacks / trials).toBeGreaterThan(0.85);
  });
});

describe('secret chest is not a collection item', () => {
  it('is a shop good and chest tier, never an ItemId stack', () => {
    expect(isSecretChestId(SECRET_CHEST_ID)).toBe(true);
    expect(isItemId(SECRET_CHEST_ID)).toBe(false);
    expect(CHEST_TIERS).toContain('secret');
    expect(SECRET_CHEST.name).toBe('Secret chest');
    expect(isBuyable(SECRET_CHEST_ID)).toBe(true);
    expect(SHOP_BUY[SECRET_CHEST_ID]).toBe(SECRET_CHEST_BUY);
    expect(SECRET_CHEST_BUY).toBe(20);
    expect(buyableEntries().some((row) => row.kind === 'chest' && row.item.id === SECRET_CHEST_ID)).toBe(
      true,
    );
    const rows = stackedEntries({
      ...emptyCollection().items,
      'rusty-key': 2,
      gem: 1,
    });
    expect(rows.map((r) => r.item.id)).not.toContain(SECRET_CHEST_ID);
  });
});

describe('shop open consumes a rusty key', () => {
  it('denies without a rusty key and charges nothing', () => {
    const store = memoryStore();
    expect(buySecretChest(packed({ gem: 1 }, 80), 1, store, SHOP_BUY, seqRng([0.1]))).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items.gem).toBe(0);
    expect(loadCollection(store).items['rusty-key']).toBe(0);
  });

  it('denies when gold is short and keeps the key', () => {
    const store = memoryStore();
    const before = packed({ 'rusty-key': 1 }, 19);
    expect(buySecretChest(before, 1, store, SHOP_BUY, seqRng([0.1]))).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items['rusty-key']).toBe(0);
    expect(buySecretChest(packed({ 'rusty-key': 1 }, 19), 1, store)).toBeNull();
  });

  it('spends gold plus one key, grants two normals, and never banks a secret-chest stack', () => {
    const store = memoryStore();
    const opened = buySecretChest(
      packed({ 'rusty-key': 2, gem: 1 }, 40),
      1,
      store,
      SHOP_BUY,
      seqRng([0.1, 0, 0, 0, 0]),
    );
    expect(opened).not.toBeNull();
    expect(opened!.gold).toBe(22);
    expect(opened!.items['rusty-key']).toBe(1);
    expect(opened!.items.gem).toBe(1);
    expect(opened!.items['gold-pouch']).toBe(0);
    expect((opened!.items as Record<string, number>)[SECRET_CHEST_ID]).toBeUndefined();
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(22);
    expect(loaded.items['rusty-key']).toBe(1);
    expect(JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}').items[SECRET_CHEST_ID]).toBeUndefined();
    expect(stackedEntries(loaded.items).map((row) => row.item.id)).not.toContain(SECRET_CHEST_ID);
  });

  it('grants a rare bag without two normals and updates the game store', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: banked({ 'rusty-key': 1 }, 20),
    });
    const game = createGameStore(store);
    expect(game.getState().buy(SECRET_CHEST_ID, 1, seqRng([0.02]))).toBe(true);
    expect(game.getState().meta.gold).toBe(0);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(1);
    expect(game.getState().meta.items['bone-dust']).toBe(0);
    expect(game.getState().buy(SECRET_CHEST_ID, 1, seqRng([0.1]))).toBe(false);
    expect(game.getState().meta.gold).toBe(0);
  });
});

describe('in-run secret chest', () => {
  it('spawns as a distinct secret tier on generated floors', () => {
    let secrets = 0;
    let total = 0;
    for (let seed = 0; seed < 80; seed++) {
      const board = createGame(DIFFICULTIES.easy, mulberry32(seed), 'easy');
      const chests = board.cells.filter((c) => c.kind === 'chest');
      expect(chests).toHaveLength(DIFFICULTIES.easy.chests);
      for (const c of chests) {
        total += 1;
        if (c.tier === 'secret') {
          secrets += 1;
          expect(c.loot).toBeNull();
        }
      }
    }
    expect(secrets / total).toBeGreaterThan(SECRET_CHEST_SPAWN_RATE - 0.05);
    expect(secrets / total).toBeLessThan(SECRET_CHEST_SPAWN_RATE + 0.05);
    expect(secrets).toBeGreaterThan(0);
    const finale = createGame(configFor('campaign', 4), mulberry32(1), 'campaign');
    expect(finale.chests).toBe(0);
    expect(finale.cells.some((c) => c.tier === 'secret')).toBe(false);
  });

  it('denies a tap-open when the bank has no rusty key', () => {
    const { game } = layoutStore({});
    const secret = game.getState().run!.game.cells.findIndex((c) => c.tier === 'secret');
    game.getState().applyDig(secret, mulberry32(1));
    expect(game.getState().run!.game.cells[secret].state).toBe('revealed');
    expect(isLockedSecretChest(game.getState().run!.game.cells[secret])).toBe(true);
    const denied = game.getState().applyDig(secret, mulberry32(2));
    expect(denied).toEqual([{ type: 'deny' }]);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().run!.game.cells[secret].loot).toBeNull();
  });

  it('consumes a rusty key on tap-open and still withholds loot until clear', () => {
    const { game } = layoutStore({ 'rusty-key': 1 });
    const secret = game.getState().run!.game.cells.findIndex((c) => c.tier === 'secret');
    game.getState().applyDig(secret, mulberry32(1));
    const opened = game.getState().applyDig(secret, seqRng([0.02]));
    expect(opened).toEqual([{ type: 'secret-open', index: secret }]);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().run!.game.cells[secret].loot).toBe('witchcraft-bag');
    expect(game.getState().run!.game.inventory['witchcraft-bag']).toBe(0);
    expect(game.getState().run!.game.status).toBe('playing');
  });

  it('grants stamped secret loot on clear and skips a locked chest with no key', () => {
    const withKey = layoutStore({ 'rusty-key': 1 });
    revealAllSafe(withKey.game, seqRng([0.02, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(withKey.game.getState().run!.game.status).toBe('cleared');
    expect(withKey.game.getState().meta.items['rusty-key']).toBe(0);
    expect(withKey.game.getState().meta.items['witchcraft-bag']).toBe(1);
    expect(withKey.game.getState().run!.game.inventory['witchcraft-bag']).toBe(1);

    const noKey = layoutStore({});
    revealAllSafe(noKey.game, mulberry32(3));
    expect(noKey.game.getState().run!.game.status).toBe('cleared');
    expect(noKey.game.getState().meta.items['witchcraft-bag']).toBe(0);
    expect(noKey.game.getState().run!.game.inventory['witchcraft-bag']).toBe(0);
    const secret = noKey.game.getState().run!.game.cells.find((c) => c.tier === 'secret');
    expect(secret?.loot).toBeNull();
  });

  it('does not grant a wrecked secret chest even if a key is in the bank', () => {
    const { game } = layoutStore({ 'rusty-key': 1 });
    game.getState().applyDig(4, mulberry32(1));
    expect(game.getState().run!.game.cells.find((c) => c.tier === 'secret')?.wrecked).toBe(true);
    revealAllSafe(game, seqRng([0.02]));
    expect(game.getState().meta.items['rusty-key']).toBe(1);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(0);
  });
});

describe('secret chest wiring', () => {
  it('plays the chest cue when a secret latch turns', () => {
    expect(sfxFromEvents([{ type: 'secret-open', index: 3 }])).toEqual(['chest']);
  });

  it('paints a secret tier glyph and shop open copy', () => {
    const icons = readFileSync(resolve(__dirname, '../native/src/ui/icons.tsx'), 'utf8');
    const shop = readFileSync(resolve(__dirname, '../native/src/ui/ShopScreen.tsx'), 'utf8');
    const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
    expect(icons).toContain('secret:');
    expect(shop).toContain("tier=\"secret\"");
    expect(shop).toContain('Open for ${total}');
    expect(shop).toContain('Need a rusty key');
    expect(preview).toContain('previewForSecretChest');
  });
});
