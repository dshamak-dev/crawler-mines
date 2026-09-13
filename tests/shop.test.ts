import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  ITEM_IDS,
  SHOP_BUY,
  buyGold,
  buyLoot,
  buyableEntries,
  clampBuyQty,
  clampSellQty,
  emptyCollection,
  isBuyable,
  isCollectible,
  isSellable,
  isShopOnly,
  isTicketKey,
  isUsable,
  canUseFromPreview,
  stackedEntries,
  loadCollection,
  sellGold,
  sellLoot,
  sellableEntries,
  shopSelectionAfterModeChange,
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
    expect(sellGold('bone-dust')).toBe(15);
    expect(sellGold('scroll-of-portal')).toBe(20);
    const sellable = new Set([
      'rusty-key',
      'torch-charm',
      'gem',
      'relic-shard',
      'bronze-medal',
      'silver-medal',
      'gold-medal',
      'bone-dust',
      'scroll-of-portal',
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

  it('does not list pouches, ticket keys, heads, the gold cup, or the witchcraft bag as sellable', () => {
    const hidden: ItemId[] = [
      'gold-pouch',
      'hard-key',
      'campaign-key',
      'gluttony-head',
      'wrath-head',
      'lust-head',
      'gold-cup',
      'witchcraft-bag',
    ];
    for (const id of hidden) {
      expect(isSellable(id)).toBe(false);
      expect(
        isTicketKey(id) ||
          id === 'gold-pouch' ||
          id.endsWith('-head') ||
          id === 'gold-cup' ||
          id === 'witchcraft-bag',
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
      'bone-dust': 2,
      'witchcraft-bag': 3,
      'scroll-of-portal': 2,
    });
    expect(rows.map((row) => row.item.id)).toEqual([
      'rusty-key',
      'torch-charm',
      'gem',
      'relic-shard',
      'bronze-medal',
      'silver-medal',
      'gold-medal',
      'bone-dust',
      'scroll-of-portal',
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
    expect(isCollectible('bone-dust')).toBe(true);
    expect(isCollectible('witchcraft-bag')).toBe(true);
    expect(isCollectible('scroll-of-portal')).toBe(true);
    expect(isUsable('witchcraft-bag')).toBe(true);
    expect(isUsable('scroll-of-portal')).toBe(false);
    expect(canUseFromPreview('witchcraft-bag', 1)).toBe(true);
    expect(canUseFromPreview('witchcraft-bag', 0)).toBe(false);
    expect(canUseFromPreview('bone-dust', 2)).toBe(false);
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
        'witchcraft-bag': 2,
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
    expect(sellLoot(meta, 'witchcraft-bag', 1, store)).toBeNull();
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

describe('buy catalog', () => {
  it('lists locked shop reagents and paid skins at the locked prices', () => {
    expect(buyGold('bone-dust')).toBe(50);
    expect(buyGold('witchcraft-bag')).toBe(150);
    expect(buyGold('scroll-of-portal')).toBe(80);
    expect(SHOP_BUY['bone-dust']).toBe(50);
    expect(SHOP_BUY['witchcraft-bag']).toBe(150);
    expect(SHOP_BUY['scroll-of-portal']).toBe(80);
    expect(buyableEntries().map((row) => [row.item.id, row.gold])).toEqual([
      ['bone-dust', 50],
      ['witchcraft-bag', 150],
      ['scroll-of-portal', 80],
      ['flag-golden', 500],
      ['flag-pirate', 500],
      ['grid-classic', 1000],
      ['grid-vintage', 1000],
    ]);
    for (const id of ITEM_IDS) {
      if (id === 'bone-dust' || id === 'witchcraft-bag' || id === 'scroll-of-portal') {
        expect(isBuyable(id)).toBe(true);
        expect(isShopOnly(id)).toBe(true);
      } else {
        expect(isBuyable(id)).toBe(false);
        expect(buyGold(id)).toBe(0);
        expect(SHOP_BUY[id]).toBeUndefined();
        expect(isShopOnly(id)).toBe(false);
      }
    }
    expect(isSellable('bone-dust')).toBe(true);
    expect(isSellable('scroll-of-portal')).toBe(true);
    expect(isSellable('witchcraft-bag')).toBe(false);
  });

  it('clears the slotted item and qty when Sell↔Buy changes', () => {
    expect(shopSelectionAfterModeChange('sell', 'buy', 'gem', 3)).toEqual({
      mode: 'buy',
      slotted: null,
      qty: 0,
    });
    expect(shopSelectionAfterModeChange('buy', 'sell', 'torch-charm', 2)).toEqual({
      mode: 'sell',
      slotted: null,
      qty: 0,
    });
    expect(shopSelectionAfterModeChange('sell', 'sell', 'gem', 3)).toEqual({
      mode: 'sell',
      slotted: 'gem',
      qty: 3,
    });
  });
});

describe('buyLoot gold math', () => {
  const catalog = { 'torch-charm': 2, gem: 10 } as const;

  it('deducts unit price × qty, adds the stack, and persists', () => {
    const store = memoryStore();
    const bought = buyLoot(packed({ 'rusty-key': 1 }, 25), 'gem', 2, store, catalog);
    expect(bought).not.toBeNull();
    expect(bought!.gold).toBe(5);
    expect(bought!.items.gem).toBe(2);
    expect(bought!.items['rusty-key']).toBe(1);
    expect(loadCollection(store).gold).toBe(5);
    expect(loadCollection(store).items.gem).toBe(2);
  });

  it('returns false and charges nothing when gold is short', () => {
    const store = memoryStore();
    const before = packed({ gem: 1 }, 9);
    expect(buyLoot(before, 'gem', 1, store, catalog)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items.gem).toBe(0);
    expect(buyLoot(packed({}, 19), 'gem', 2, store, catalog)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(buyLoot(packed({}, 49), 'bone-dust', 1, store)).toBeNull();
    expect(buyLoot(packed({}, 149), 'witchcraft-bag', 1, store)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
  });

  it('deducts gold and stacks bone dust or a witchcraft bag from the locked catalog', () => {
    const store = memoryStore();
    const dust = buyLoot(packed({ gem: 1 }, 250), 'bone-dust', 2, store);
    expect(dust).not.toBeNull();
    expect(dust!.gold).toBe(150);
    expect(dust!.items['bone-dust']).toBe(2);
    expect(dust!.items.gem).toBe(1);
    expect(loadCollection(store).gold).toBe(150);
    expect(loadCollection(store).items['bone-dust']).toBe(2);
    const bag = buyLoot(dust!, 'witchcraft-bag', 1, store);
    expect(bag).not.toBeNull();
    expect(bag!.gold).toBe(0);
    expect(bag!.items['witchcraft-bag']).toBe(1);
    expect(bag!.items['bone-dust']).toBe(2);
    expect(loadCollection(store).items['witchcraft-bag']).toBe(1);
    expect(sellLoot(bag!, 'witchcraft-bag', 1, store)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(loadCollection(store).items['witchcraft-bag']).toBe(1);
    const sold = sellLoot(loadCollection(store), 'bone-dust', 1, store);
    expect(sold!.gold).toBe(15);
    expect(sold!.items['bone-dust']).toBe(1);
    const scroll = buyLoot(packed({ gem: 1 }, 80), 'scroll-of-portal', 1, store);
    expect(scroll!.gold).toBe(0);
    expect(scroll!.items['scroll-of-portal']).toBe(1);
    expect(sellGold('scroll-of-portal')).toBe(20);
    expect(
      stackedEntries(sold!.items).map((row) => row.item.id),
    ).toEqual(['gem', 'bone-dust', 'witchcraft-bag']);
  });

  it('rejects a missing catalog price and does not charge partial', () => {
    const store = memoryStore();
    expect(buyLoot(packed({}, 40), 'relic-shard', 1, store, catalog)).toBeNull();
    expect(buyLoot(packed({}, 40), 'gem', 1, store)).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    expect(clampBuyQty(0)).toBe(1);
    expect(clampBuyQty(40)).toBe(40);
    expect(clampBuyQty(200)).toBe(99);
  });

  it('updates the game store meta immediately and fails when gold is short', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 250,
        items: { gem: 1 },
      }),
    });
    const game = createGameStore(store);
    expect(game.getState().buy('bone-dust', 2)).toBe(true);
    expect(game.getState().meta.gold).toBe(150);
    expect(game.getState().meta.items['bone-dust']).toBe(2);
    expect(game.getState().meta.items.gem).toBe(1);
    expect(loadCollection(store).gold).toBe(150);
    expect(game.getState().buy('witchcraft-bag', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(0);
    expect(game.getState().meta.items['witchcraft-bag']).toBe(1);
    expect(game.getState().buy('bone-dust', 1)).toBe(false);
    expect(game.getState().meta.gold).toBe(0);
    expect(game.getState().meta.items['bone-dust']).toBe(2);
    expect(game.getState().buy('gem', 1)).toBe(false);
    expect(game.getState().sell('witchcraft-bag', 1)).toBe(false);
    expect(game.getState().sell('bone-dust', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(15);
    expect(game.getState().meta.items['bone-dust']).toBe(1);
  });
});

describe('title shop wiring', () => {
  const title = readFileSync(resolve(__dirname, '../native/src/ui/TitleMenu.tsx'), 'utf8');
  const shop = readFileSync(resolve(__dirname, '../native/src/ui/ShopScreen.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const layout = readFileSync(resolve(__dirname, '../native/app/_layout.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/shop.tsx'), 'utf8');
  const vitestCfg = readFileSync(resolve(__dirname, '../vitest.config.ts'), 'utf8');

  it('places Shop under Start and before Sound, with no NEW badge', () => {
    const navStart = title.indexOf('style={styles.nav}');
    const nav = title.slice(navStart);
    const start = nav.indexOf('style={styles.cta}');
    const shopBtn = nav.indexOf('<ScalesIcon');
    const sound = nav.indexOf('<MuteButton');
    expect(start).toBeGreaterThan(-1);
    expect(shopBtn).toBeGreaterThan(start);
    expect(sound).toBeGreaterThan(shopBtn);
    expect(title).toContain('ScalesIcon');
    expect(title).not.toMatch(/NEW/);
  });

  it('keeps Shop off the in-run hamburger', () => {
    const menuStart = play.indexOf('<DisplayText>Menu</DisplayText>');
    const menuEnd = play.indexOf('</Overlay>', menuStart);
    const menu = play.slice(menuStart, menuEnd);
    expect(menu).toContain('Continue');
    expect(menu).toContain('Collection');
    expect(menu).not.toContain('Shop');
    expect(layout).toContain("path.includes('shop')");
  });

  it('uses the locked Sell | Buy sheet and keeps sell copy', () => {
    expect(shop).toContain("useState<ShopMode>('sell')");
    expect(shop).toContain('shopSelectionAfterModeChange');
    expect(shop).toContain('Tap an item to sell.');
    expect(shop).toContain('Tap an item to buy.');
    expect(shop).toContain('Sell for —');
    expect(shop).toContain('Buy for —');
    expect(shop).toContain('Sell for ${total}');
    expect(shop).toContain('Buy for ${total}');
    expect(shop).toContain('Your stash');
    expect(shop).toContain('Nothing for sale yet.');
    expect(shop).toContain('onBuy');
    expect(shop).toContain('onDeny');
    expect(shop).not.toContain('Sell only.');
    expect(route).toContain('onBuy');
    expect(route).toContain('buyFromShop');
    expect(vitestCfg).toContain("exclude: ['**/node_modules/**', 'native/**']");
  });

  it('opens the shared item preview from Buy and Sell rows', () => {
    expect(shop).toContain('ItemPreviewSheet');
    expect(shop).toContain('previewForItem');
    expect(shop).toContain('RitualSheet');
    expect(shop).toContain('onStartRite');
    expect(shop).toContain('setRitualOpen(true)');
    expect(route).toContain('startRite');
    expect(route).toContain('onStartRite');
    const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
    expect(preview).toContain('canUseFromPreview');
    expect(preview).toContain('Use');
    expect(preview).toContain('Close');
  });

  it('gives bone dust and the witchcraft bag their own stone-gold glyphs', () => {
    const icons = readFileSync(resolve(__dirname, '../native/src/ui/icons.tsx'), 'utf8');
    expect(icons).toContain("id === 'bone-dust'");
    expect(icons).toContain("id === 'witchcraft-bag'");
    expect(icons).toContain("id === 'scroll-of-portal'");
    expect(icons).toContain('function BoneDustGlyph');
    expect(icons).toContain('function WitchcraftBagGlyph');
    expect(icons).toContain('function ScrollGlyph');
  });
});
