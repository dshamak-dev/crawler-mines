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
  SECRET_CHEST_COPY,
  SECRET_CHEST_ID,
  SECRET_CHEST_SPAWN_RATE,
  SECRET_DUST_RATE,
  SECRET_NORMAL_TABLE,
  SECRET_SCROLL_RATE,
  SHOP_BUY,
  TIER_COPY,
  buyGold,
  buyableEntries,
  canOpenSecretChest,
  canUseFromPreview,
  createGame,
  createGameFromLayout,
  emptyCollection,
  isBuyable,
  isCollectible,
  isIntactSecretChest,
  isItemId,
  isSecretChestId,
  isSellable,
  isUsable,
  loadCollection,
  mulberry32,
  openSecretChest,
  rollSecretChestLoot,
  sellGold,
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
      kit: emptyCollection().items,
    },
    meta: loadCollection(store),
    runLoot: emptyCollection().items,
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

describe('secret chest is a collection item', () => {
  it('stacks in Collection, is usable out of run, and is a shop good at 40 / 25', () => {
    expect(isSecretChestId(SECRET_CHEST_ID)).toBe(true);
    expect(isItemId(SECRET_CHEST_ID)).toBe(true);
    expect(isCollectible(SECRET_CHEST_ID)).toBe(true);
    expect(isSellable(SECRET_CHEST_ID)).toBe(true);
    expect(isUsable(SECRET_CHEST_ID)).toBe(true);
    expect(canUseFromPreview(SECRET_CHEST_ID, 1)).toBe(true);
    expect(canUseFromPreview(SECRET_CHEST_ID, 0)).toBe(false);
    expect(canUseFromPreview(SECRET_CHEST_ID, 1, true)).toBe(false);
    expect(CHEST_TIERS).toContain('secret');
    expect(SECRET_CHEST.name).toBe('Secret chest');
    expect(isBuyable(SECRET_CHEST_ID)).toBe(true);
    expect(SHOP_BUY[SECRET_CHEST_ID]).toBe(40);
    expect(buyGold(SECRET_CHEST_ID)).toBe(40);
    expect(sellGold(SECRET_CHEST_ID)).toBe(25);
    expect(buyableEntries().some((row) => row.item.id === SECRET_CHEST_ID)).toBe(true);
    const rows = stackedEntries({
      ...emptyCollection().items,
      'rusty-key': 2,
      [SECRET_CHEST_ID]: 3,
      gem: 1,
    });
    expect(rows.map((r) => r.item.id)).toEqual(['rusty-key', SECRET_CHEST_ID, 'gem']);
    expect(rows.find((r) => r.item.id === SECRET_CHEST_ID)?.count).toBe(3);
  });
});

describe('collection open consumes a rusty key', () => {
  it('denies without a socketed rusty key and writes nothing', () => {
    const store = memoryStore();
    const before = packed({ [SECRET_CHEST_ID]: 1, gem: 1 }, 40);
    expect(openSecretChest(before, null, store, seqRng([0.1]))).toBeNull();
    expect(openSecretChest(before, 'gem', store, seqRng([0.1]))).toBeNull();
    expect(canOpenSecretChest(before, null)).toBe(false);
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items[SECRET_CHEST_ID]).toBe(0);
    expect(loadCollection(store).items.gem).toBe(0);
  });

  it('denies without a banked chest or key and keeps the pack', () => {
    const store = memoryStore();
    expect(openSecretChest(packed({ 'rusty-key': 1 }, 10), 'rusty-key', store)).toBeNull();
    expect(openSecretChest(packed({ [SECRET_CHEST_ID]: 1 }, 10), 'rusty-key', store)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items['rusty-key']).toBe(0);
    expect(loadCollection(store).items[SECRET_CHEST_ID]).toBe(0);
  });

  it('consumes one chest plus one key, grants two normals, and persists', () => {
    const store = memoryStore();
    const opened = openSecretChest(
      packed({ [SECRET_CHEST_ID]: 2, 'rusty-key': 2, gem: 1 }, 40),
      'rusty-key',
      store,
      seqRng([0.1, 0, 0, 0, 0]),
    );
    expect(opened).not.toBeNull();
    expect(opened!.state.gold).toBe(42);
    expect(opened!.state.items['rusty-key']).toBe(1);
    expect(opened!.state.items[SECRET_CHEST_ID]).toBe(1);
    expect(opened!.state.items.gem).toBe(1);
    expect(opened!.state.items['gold-pouch']).toBe(0);
    expect(opened!.rewards.map((r) => r.itemId)).toEqual(['gold-pouch', 'gold-pouch']);
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(42);
    expect(loaded.items['rusty-key']).toBe(1);
    expect(loaded.items[SECRET_CHEST_ID]).toBe(1);
    expect(stackedEntries(loaded.items).map((row) => row.item.id)).toContain(SECRET_CHEST_ID);
  });

  it('grants a rare bag without two normals and updates the game store', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: banked({ [SECRET_CHEST_ID]: 1, 'rusty-key': 1 }, 20),
    });
    const game = createGameStore(store);
    const rewards = game.getState().openSecretChest('rusty-key', seqRng([0.02]));
    expect(rewards).toEqual([{ itemId: 'witchcraft-bag', gold: 0 }]);
    expect(game.getState().meta.gold).toBe(20);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().meta.items[SECRET_CHEST_ID]).toBe(0);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(1);
    expect(game.getState().meta.items['bone-dust']).toBe(0);
    expect(game.getState().openSecretChest('rusty-key', seqRng([0.1]))).toBeNull();
    expect(game.getState().meta.gold).toBe(20);
    expect(game.getState().buy(SECRET_CHEST_ID, 1)).toBe(false);
  });

  it('Shop Buy banks a chest at 40 without a rusty key and does not open it', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: banked({ gem: 1 }, 80),
    });
    const game = createGameStore(store);
    expect(game.getState().buy(SECRET_CHEST_ID, 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(40);
    expect(game.getState().meta.items[SECRET_CHEST_ID]).toBe(1);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(0);
    expect(game.getState().meta.items['bone-dust']).toBe(0);
    expect(game.getState().meta.items['scroll-of-portal']).toBe(0);
    expect(game.getState().meta.items.gem).toBe(1);
    expect(game.getState().sell(SECRET_CHEST_ID, 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(65);
    expect(game.getState().meta.items[SECRET_CHEST_ID]).toBe(0);
    expect(loadCollection(store).gold).toBe(65);
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
          expect(c.loot).toBe(SECRET_CHEST_ID);
          expect(c.lootExtra).toBeNull();
          expect(c.gold).toBe(0);
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

  it('reveals without a rusty key and does not roll loot mid-run', () => {
    const { game } = layoutStore({});
    const secret = game.getState().run!.game.cells.findIndex((c) => c.tier === 'secret');
    const found = game.getState().applyDig(secret, mulberry32(1));
    expect(found.some((e) => e.type === 'chest' && e.tier === 'secret')).toBe(true);
    expect(game.getState().run!.game.cells[secret].state).toBe('revealed');
    expect(isIntactSecretChest(game.getState().run!.game.cells[secret])).toBe(true);
    expect(game.getState().run!.game.cells[secret].loot).toBe(SECRET_CHEST_ID);
    expect(game.getState().meta.items['rusty-key']).toBe(0);
    expect(game.getState().run!.game.inventory[SECRET_CHEST_ID]).toBe(0);
    const again = game.getState().applyDig(secret, mulberry32(2));
    expect(again).toEqual([]);
    expect(game.getState().run!.game.status).toBe('playing');
  });

  it('banks intact secret chests into Collection on clear, without spending a key', () => {
    const { game, store } = layoutStore({ 'rusty-key': 1 });
    revealAllSafe(game, mulberry32(3));
    expect(game.getState().run!.game.status).toBe('cleared');
    expect(game.getState().meta.items['rusty-key']).toBe(1);
    expect(game.getState().meta.items[SECRET_CHEST_ID]).toBe(1);
    expect(game.getState().run!.game.inventory[SECRET_CHEST_ID]).toBe(1);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(0);
    expect(loadCollection(store).items[SECRET_CHEST_ID]).toBe(1);
    expect(loadCollection(store).items['rusty-key']).toBe(1);
  });

  it('does not grant a wrecked secret chest', () => {
    const { game } = layoutStore({ 'rusty-key': 1 });
    game.getState().applyDig(4, mulberry32(1));
    expect(game.getState().run!.game.cells.find((c) => c.tier === 'secret')?.wrecked).toBe(true);
    revealAllSafe(game, mulberry32(3));
    expect(game.getState().meta.items['rusty-key']).toBe(1);
    expect(game.getState().meta.items[SECRET_CHEST_ID]).toBe(0);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(0);
  });
});

describe('secret chest wiring', () => {
  it('toasts sealed-for-collection copy, not a board rusty-key prompt', () => {
    expect(TIER_COPY.secret.found).toBe('Found · sealed for collection');
    expect(TIER_COPY.secret.found).not.toMatch(/rusty key/i);
    expect(SECRET_CHEST_COPY).toContain('Socket a rusty key');
  });

  it('paints a secret tier glyph and Collection Use → one-slot key sheet', () => {
    const icons = readFileSync(resolve(__dirname, '../native/src/ui/icons.tsx'), 'utf8');
    const shop = readFileSync(resolve(__dirname, '../native/src/ui/ShopScreen.tsx'), 'utf8');
    const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
    const collection = readFileSync(resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'), 'utf8');
    const sheet = readFileSync(resolve(__dirname, '../native/src/ui/SecretChestSheet.tsx'), 'utf8');
    const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');
    expect(icons).toContain('secret:');
    expect(icons).toContain("id === 'secret-chest'");
    expect(shop).not.toContain('Open for ${total}');
    expect(shop).not.toContain('Need a rusty key');
    expect(shop).not.toContain('previewForSecretChest');
    expect(shop).not.toContain('isSecretChestId');
    expect(preview).not.toContain('previewForSecretChest');
    expect(preview).toContain("itemId === 'secret-chest'");
    expect(collection).toContain('SecretChestSheet');
    expect(collection).toContain("id === 'secret-chest'");
    expect(collection).toContain('setSecretOpen(true)');
    expect(sheet).toContain('SECRET_CHEST_COPY');
    expect(sheet).toContain('Empty ritual slot');
    expect(sheet).toContain('LootGrantCards');
    expect(sheet).toContain('Open');
    expect(sheet).toContain('Close');
    expect(route).toContain('openSecretChest');
    expect(route).toContain('onOpenSecret');
  });
});
