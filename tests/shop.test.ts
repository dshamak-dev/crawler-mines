import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  ITEM_IDS,
  clampSellQty,
  emptyCollection,
  isCollectible,
  isSellable,
  isTicketKey,
  loadCollection,
  sellGold,
  sellLoot,
  sellableEntries,
  type ItemId,
  type KeyStore,
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

describe('sell catalog', () => {
  it('sells only named loot at the locked unit prices', () => {
    expect(sellGold('rusty-key')).toBe(4);
    expect(sellGold('torch-charm')).toBe(2);
    expect(sellGold('gem')).toBe(10);
    expect(sellGold('relic-shard')).toBe(18);
    expect(sellGold('bronze-medal')).toBe(3);
    expect(sellGold('silver-medal')).toBe(14);
    expect(sellGold('gold-medal')).toBe(20);
    const sellable = new Set([
      'rusty-key',
      'torch-charm',
      'gem',
      'relic-shard',
      'bronze-medal',
      'silver-medal',
      'gold-medal',
    ]);
    for (const id of ITEM_IDS) {
      if (sellable.has(id)) {
        expect(isSellable(id)).toBe(true);
      } else {
        expect(isSellable(id)).toBe(false);
        expect(sellGold(id)).toBe(0);
      }
    }
  });

  it('does not list pouches, ticket keys, heads, or the gold cup as sellable', () => {
    const hidden: ItemId[] = [
      'gold-pouch',
      'hard-key',
      'campaign-key',
      'gluttony-head',
      'wrath-head',
      'lust-head',
      'gold-cup',
    ];
    for (const id of hidden) {
      expect(isSellable(id)).toBe(false);
      expect(
        isTicketKey(id) || id === 'gold-pouch' || id.endsWith('-head') || id === 'gold-cup',
      ).toBe(true);
    }
    const rows = sellableEntries({
      ...emptyCollection().items,
      'rusty-key': 1,
      'torch-charm': 2,
      gem: 1,
      'relic-shard': 1,
      'hard-key': 3,
      'campaign-key': 2,
      'gluttony-head': 1,
      'wrath-head': 1,
      'lust-head': 1,
      'gold-cup': 2,
      'gold-pouch': 9,
      'bronze-medal': 1,
      'silver-medal': 2,
      'gold-medal': 1,
    });
    expect(rows.map((row) => row.item.id)).toEqual([
      'rusty-key',
      'torch-charm',
      'gem',
      'relic-shard',
      'bronze-medal',
      'silver-medal',
      'gold-medal',
    ]);
  });

  it('keeps ticket keys and heads collectible so Collection still shows them', () => {
    expect(isCollectible('hard-key')).toBe(true);
    expect(isCollectible('campaign-key')).toBe(true);
    expect(isCollectible('gluttony-head')).toBe(true);
    expect(isCollectible('wrath-head')).toBe(true);
    expect(isCollectible('lust-head')).toBe(true);
    expect(isCollectible('gold-pouch')).toBe(false);
    expect(isCollectible('bronze-medal')).toBe(true);
    expect(isCollectible('silver-medal')).toBe(true);
    expect(isCollectible('gold-medal')).toBe(true);
    expect(isCollectible('gold-cup')).toBe(true);
  });
});

describe('sellLoot gold math', () => {
  it('adds unit price × qty and decrements the stack', () => {
    const store = memoryStore();
    const sold = sellLoot(packed({ gem: 3, 'rusty-key': 1 }, 5), 'gem', 2, store);
    expect(sold).not.toBeNull();
    expect(sold!.gold).toBe(25);
    expect(sold!.items.gem).toBe(1);
    expect(sold!.items['rusty-key']).toBe(1);
    const charm = sellLoot(packed({ 'torch-charm': 3 }, 1), 'torch-charm', 1, store);
    expect(charm!.gold).toBe(3);
    expect(charm!.items['torch-charm']).toBe(2);
  });

  it('cannot sell keys, heads, or the gold cup', () => {
    const store = memoryStore();
    const meta = packed(
      {
        'hard-key': 2,
        'campaign-key': 1,
        'gluttony-head': 1,
        'wrath-head': 1,
        'lust-head': 1,
        'gold-cup': 2,
        'rusty-key': 1,
      },
      10,
    );
    expect(sellLoot(meta, 'hard-key', 1, store)).toBeNull();
    expect(sellLoot(meta, 'campaign-key', 1, store)).toBeNull();
    expect(sellLoot(meta, 'gluttony-head', 1, store)).toBeNull();
    expect(sellLoot(meta, 'wrath-head', 1, store)).toBeNull();
    expect(sellLoot(meta, 'lust-head', 1, store)).toBeNull();
    expect(sellLoot(meta, 'gold-cup', 1, store)).toBeNull();
    expect(sellLoot(meta, 'gold-pouch', 1, store)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items['hard-key']).toBe(0);
  });

  it('clamps qty to 1..owned and rejects an empty stack', () => {
    expect(clampSellQty(5, 1)).toBe(1);
    expect(clampSellQty(5, 99)).toBe(5);
    expect(clampSellQty(5, 0)).toBe(1);
    expect(clampSellQty(0, 3)).toBe(0);
    const store = memoryStore();
    const over = sellLoot(packed({ 'torch-charm': 2 }, 0), 'torch-charm', 40, store);
    expect(over!.items['torch-charm']).toBe(0);
    expect(over!.gold).toBe(4);
    expect(sellLoot(packed({ gem: 0 }, 4), 'gem', 1, store)).toBeNull();
  });

  it('persists the sale so a reload keeps gold and the reduced stack', () => {
    const store = memoryStore();
    sellLoot(packed({ 'relic-shard': 2, gem: 1 }, 7), 'relic-shard', 1, store);
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(25);
    expect(loaded.items['relic-shard']).toBe(1);
    expect(loaded.items.gem).toBe(1);
    expect(JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}').gold).toBe(25);
    const again = loadCollection(store);
    expect(again).toEqual(loaded);
  });

  it('updates the game store meta immediately', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 2,
        items: { 'rusty-key': 3 },
      }),
    });
    const game = createGameStore(store);
    expect(game.getState().sell('rusty-key', 2)).toBe(true);
    expect(game.getState().meta.gold).toBe(10);
    expect(game.getState().meta.items['rusty-key']).toBe(1);
    expect(loadCollection(store).gold).toBe(10);
    expect(game.getState().sell('hard-key', 1)).toBe(false);
  });
});

describe('title shop wiring', () => {
  const title = readFileSync(resolve(__dirname, '../src/ui/TitleMenu.tsx'), 'utf8');
  const shop = readFileSync(resolve(__dirname, '../src/ui/Shop.tsx'), 'utf8');
  const app = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  it('places Shop under Start and before Sound, with no NEW badge', () => {
    const navStart = title.indexOf('className="menu-nav"');
    const nav = title.slice(navStart);
    const start = nav.indexOf('start-cta');
    const shopBtn = nav.indexOf('<ScalesIcon');
    const sound = nav.indexOf('MuteButton variant="row"');
    expect(start).toBeGreaterThan(-1);
    expect(shopBtn).toBeGreaterThan(start);
    expect(sound).toBeGreaterThan(shopBtn);
    expect(title).toContain('ScalesIcon');
    expect(title).not.toMatch(/NEW/);
  });

  it('keeps Shop off the in-run hamburger', () => {
    const menuStart = app.indexOf('id="game-menu-title"');
    const menuEnd = app.indexOf('</nav>', menuStart);
    const menu = app.slice(menuStart, menuEnd);
    expect(menu).toContain('Continue');
    expect(menu).toContain('Collection');
    expect(menu).not.toContain('Shop');
    expect(app).toContain('screen === \'shop\'');
  });

  it('uses the locked shop sheet copy and sell-only confirm', () => {
    expect(shop).toContain('Tap an item to sell.');
    expect(shop).toContain('Sell for —');
    expect(shop).toContain('Sell for {total}');
    expect(shop).toContain('Your stash');
    expect(shop).toContain('Sell only.');
    expect(shop).toContain('onDeny');
    expect(shop).not.toContain('Buy');
  });
});
