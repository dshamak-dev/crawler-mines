import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  DEFAULT_THEME,
  FLAG_SKIN_REFUND,
  SHOP_BUY,
  THEME_IDS,
  THEME_PRICE,
  THEME_TOKENS,
  THEMES,
  buyGold,
  buyGoods,
  buyTheme,
  buyableEntries,
  emptyCollection,
  gridNumberColor,
  isBuyable,
  isDefaultTheme,
  isThemeOwned,
  loadCollection,
  paidThemeIds,
  selectTheme,
  selectedTheme,
  themeTokens,
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

const PAID = [
  'theme-vintage-stone',
  'theme-neon-cyber',
  'theme-woodland',
  'theme-ocean-breeze',
  'theme-forest-trail',
] as const;

describe('#78 theme catalog', () => {
  it('owns Classic Dark for free and lists the locked paid ids', () => {
    const meta = emptyCollection();
    expect(meta.selectedTheme).toBe('theme-classic-dark');
    expect(DEFAULT_THEME).toBe('theme-classic-dark');
    expect(THEME_IDS).toEqual([
      'theme-classic-dark',
      'theme-vintage-stone',
      'theme-neon-cyber',
      'theme-woodland',
      'theme-ocean-breeze',
      'theme-forest-trail',
    ]);
    expect(paidThemeIds()).toEqual([...PAID]);
    for (const id of THEME_IDS) {
      expect(THEMES[id].name.length).toBeGreaterThan(2);
      expect(THEMES[id].flavor.length).toBeGreaterThan(8);
      if (isDefaultTheme(id)) {
        expect(isThemeOwned(meta, id)).toBe(true);
        expect(isBuyable(id)).toBe(false);
        expect(buyGold(id)).toBe(0);
      } else {
        expect(isBuyable(id)).toBe(true);
        expect(buyGold(id)).toBe(THEME_PRICE);
        expect(SHOP_BUY[id]).toBe(1000);
      }
    }
  });

  it('lists paid themes in SHOP_BUY at 1000 and hides the free default', () => {
    const paid = buyableEntries()
      .filter((row) => row.kind === 'theme')
      .map((row) => [row.item.id, row.gold]);
    expect(paid).toEqual(PAID.map((id) => [id, 1000]));
    const fresh = emptyCollection();
    expect(buyableEntries(SHOP_BUY, fresh).some((row) => row.item.id === 'theme-classic-dark')).toBe(
      false,
    );
    expect(buyableEntries().map((row) => row.item.id)).not.toContain('flag-golden');
    expect(buyableEntries().map((row) => row.item.id)).not.toContain('flag-pirate');
    expect(buyableEntries().map((row) => row.item.id)).not.toContain('grid-classic');
    expect(buyableEntries().map((row) => row.item.id)).not.toContain('grid-vintage');
  });

  it('ships distinct tokens, 1–8 numbers, and leaf Dig on woodland/forest', () => {
    expect(THEME_TOKENS['theme-neon-cyber'].cellFace).toBe('neon');
    expect(THEME_TOKENS['theme-woodland'].cellFace).toBe('wood');
    expect(THEME_TOKENS['theme-vintage-stone'].hidden).not.toBe(THEME_TOKENS['theme-classic-dark'].hidden);
    expect(THEME_TOKENS['theme-ocean-breeze'].hidden).not.toBe(THEME_TOKENS['theme-classic-dark'].hidden);
    expect(THEME_TOKENS['theme-woodland'].digGlyph).toBe('leaf');
    expect(THEME_TOKENS['theme-forest-trail'].digGlyph).toBe('leaf');
    expect(THEME_TOKENS['theme-classic-dark'].digGlyph).toBe('shovel');
    expect(THEME_TOKENS['theme-neon-cyber'].digGlyph).toBe('shovel');
    for (const id of THEME_IDS) {
      const paint = themeTokens(id);
      expect(paint.numbers).toHaveLength(9);
      for (let n = 1; n <= 8; n += 1) {
        expect(paint.numbers[n]).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(paint.numbers[n].toLowerCase()).not.toBe(paint.revealed.toLowerCase());
        expect(gridNumberColor(id, n)).toBe(paint.numbers[n]);
      }
    }
    expect(gridNumberColor('theme-classic-dark', 1)).toBe('#e0b44a');
    expect(gridNumberColor(THEME_TOKENS['theme-classic-dark'], 99)).toBe(
      THEME_TOKENS['theme-classic-dark'].numbers[1],
    );
    expect(gridNumberColor('theme-neon-cyber', 1)).not.toBe(gridNumberColor('theme-classic-dark', 1));
  });
});

describe('#78 buy and select themes', () => {
  it('buys a paid theme, persists ownership, and refuses a second copy', () => {
    const store = memoryStore();
    const broke = buyTheme({ ...emptyCollection(), gold: 999 }, 'theme-neon-cyber', store);
    expect(broke).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    const bought = buyTheme({ ...emptyCollection(), gold: 1500 }, 'theme-neon-cyber', store);
    expect(bought).not.toBeNull();
    expect(bought!.gold).toBe(500);
    expect(isThemeOwned(bought, 'theme-neon-cyber')).toBe(true);
    expect(bought!.selectedTheme).toBe('theme-classic-dark');
    const loaded = loadCollection(store);
    expect(isThemeOwned(loaded, 'theme-neon-cyber')).toBe(true);
    expect(loaded.gold).toBe(500);
    expect(buyTheme(loaded, 'theme-neon-cyber', store)).toBeNull();
    expect(loadCollection(store).gold).toBe(500);
    expect(buyTheme(loaded, 'theme-classic-dark', store)).toBeNull();
    expect(buyableEntries(SHOP_BUY, bought).map((row) => row.item.id)).not.toContain('theme-neon-cyber');
    expect(buyableEntries(SHOP_BUY, bought).map((row) => row.item.id)).toContain('theme-woodland');
    expect(buyableEntries(SHOP_BUY, bought).map((row) => row.item.id)).not.toContain('theme-classic-dark');
  });

  it('selects an owned theme and persists it', () => {
    const store = memoryStore();
    let meta = buyGoods({ ...emptyCollection(), gold: 2000 }, 'theme-woodland', 1, store);
    expect(meta!.gold).toBe(1000);
    expect(selectTheme(meta!, 'theme-woodland', store)).not.toBeNull();
    const loaded = loadCollection(store);
    expect(selectedTheme(loaded)).toBe('theme-woodland');
    expect(isThemeOwned(loaded, 'theme-classic-dark')).toBe(true);
    expect(selectTheme(loaded, 'theme-ocean-breeze', store)).toBeNull();
    expect(loadCollection(store).selectedTheme).toBe('theme-woodland');
  });

  it('reloads defaults when a save omits themes or points at an unowned pick', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 2,
        gold: 40,
        items: { gem: 1 },
        selectedTheme: 'theme-neon-cyber',
      }),
    });
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(40);
    expect(loaded.items.gem).toBe(1);
    expect(isThemeOwned(loaded, 'theme-classic-dark')).toBe(true);
    expect(isThemeOwned(loaded, 'theme-neon-cyber')).toBe(false);
    expect(loaded.selectedTheme).toBe('theme-classic-dark');
  });

  it('updates the game store buy and select helpers', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 2,
        gold: 2500,
        items: {},
      }),
    });
    const game = createGameStore(store);
    expect(isThemeOwned(game.getState().meta, 'theme-classic-dark')).toBe(true);
    expect(game.getState().buy('theme-vintage-stone', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(1500);
    expect(isThemeOwned(game.getState().meta, 'theme-vintage-stone')).toBe(true);
    expect(game.getState().buy('theme-vintage-stone', 1)).toBe(false);
    expect(game.getState().buy('theme-ocean-breeze', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(500);
    expect(game.getState().selectTheme('theme-ocean-breeze')).toBe(true);
    expect(game.getState().selectTheme('theme-neon-cyber')).toBe(false);
    expect(game.getState().meta.selectedTheme).toBe('theme-ocean-breeze');
    const again = createGameStore(store);
    expect(again.getState().meta.selectedTheme).toBe('theme-ocean-breeze');
    expect(isThemeOwned(again.getState().meta, 'theme-vintage-stone')).toBe(true);
    expect(isThemeOwned(again.getState().meta, 'theme-ocean-breeze')).toBe(true);
  });
});

describe('#78 flag/grid save migration', () => {
  it('refunds 500g per paid flag skin and grants Vintage Stone for grid-vintage', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 100,
        items: { gem: 2 },
        ownedSkins: ['flag-red', 'flag-golden', 'flag-pirate', 'grid-gray', 'grid-vintage'],
        selectedFlagSkin: 'flag-golden',
        selectedGridSkin: 'grid-vintage',
      }),
    });
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(100 + FLAG_SKIN_REFUND * 2);
    expect(isThemeOwned(loaded, 'theme-vintage-stone')).toBe(true);
    expect(loaded.selectedTheme).toBe('theme-vintage-stone');
    const blob = JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}') as Record<string, unknown>;
    expect(blob.ownedSkins).toBeUndefined();
    expect(blob.selectedFlagSkin).toBeUndefined();
    expect(blob.selectedGridSkin).toBeUndefined();
    expect(blob.ownedThemes).toEqual(['theme-classic-dark', 'theme-vintage-stone']);
    expect(blob.selectedTheme).toBe('theme-vintage-stone');
    const again = loadCollection(store);
    expect(again.gold).toBe(loaded.gold);
  });

  it('treats grid-classic as a no-op on the free Classic Dark default', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 40,
        items: {},
        ownedSkins: ['flag-red', 'grid-gray', 'grid-classic'],
        selectedFlagSkin: 'flag-red',
        selectedGridSkin: 'grid-classic',
      }),
    });
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(40);
    expect(loaded.ownedThemes).toEqual(['theme-classic-dark']);
    expect(loaded.selectedTheme).toBe('theme-classic-dark');
    expect(isThemeOwned(loaded, 'theme-vintage-stone')).toBe(false);
  });
});

describe('#78 collection and shop wiring', () => {
  const collection = readFileSync(resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'), 'utf8');
  const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
  const shop = readFileSync(resolve(__dirname, '../native/src/ui/ShopScreen.tsx'), 'utf8');
  const board = readFileSync(resolve(__dirname, '../native/src/ui/Board.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');
  const icons = readFileSync(resolve(__dirname, '../native/src/ui/icons.tsx'), 'utf8');
  const layout = readFileSync(resolve(__dirname, '../native/app/_layout.tsx'), 'utf8');
  const theme = readFileSync(resolve(__dirname, '../native/src/theme.tsx'), 'utf8');

  it('replaces Items | Skins with Items | Themes on the title collection', () => {
    expect(collection).toContain("useState<'items' | 'themes'>('items')");
    expect(collection).toContain('Items');
    expect(collection).toContain('Themes');
    expect(collection).not.toContain('>Flag<');
    expect(collection).not.toContain('>Grid<');
    expect(collection).not.toContain('>Skins<');
    expect(collection).toContain('previewForTheme');
    expect(collection).toContain('onSelectTheme');
    expect(route).toContain('onSelectTheme');
    expect(route).toContain('selectTheme');
  });

  it('keeps in-run collection sealed and without a themes tab', () => {
    expect(collection).toContain('function SealedCollection');
    expect(route).toContain('sealed={fromPlay}');
    const sealedStart = collection.indexOf('function SealedCollection');
    const sealed = collection.slice(sealedStart);
    expect(sealed).not.toContain('Themes');
    expect(sealed).not.toContain('previewForTheme');
  });

  it('shows Select on owned themes and Selected when already active', () => {
    expect(preview).toContain('previewForTheme');
    expect(preview).toContain('canSelect');
    expect(preview).toContain('Select');
    expect(preview).toContain('Selected');
    expect(preview).toContain('Use');
    expect(shop).toContain('previewForTheme');
    expect(shop).toContain('false, false');
    expect(shop).toContain('ThemeIcon');
    expect(shop).toContain('Owned');
    expect(shop).toContain('buyableEntries(SHOP_BUY, meta)');
    expect(shop).toContain('onLongPress');
    expect(shop).toContain('openPreview');
  });

  it('paints the board and Dig/Flag chrome from the selected theme', () => {
    expect(layout).toContain('ThemeProvider');
    expect(theme).toContain('function ThemeProvider');
    expect(play).toContain('useTheme');
    expect(play).toContain('digGlyph');
    expect(play).toContain('LeafIcon');
    expect(play).toContain('paint={t.flag}');
    expect(play).not.toContain('selectedFlagSkin');
    expect(play).not.toContain('selectedGridSkin');
    expect(board).toContain('useTheme');
    expect(board).toContain('gridNumberColor');
    expect(board).toContain('CellFace');
    expect(icons).toContain('function ThemeIcon');
    expect(icons).toContain('function LeafIcon');
    expect(icons).not.toContain("mark === 'skull'");
  });
});
