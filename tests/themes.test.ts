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
  boardFrameInset,
  buyableEntries,
  emptyCollection,
  numberCellFill,
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
    expect(gridNumberColor(THEME_TOKENS['theme-classic-dark'], 99)).toBe(
      THEME_TOKENS['theme-classic-dark'].numbers[1],
    );
    expect(gridNumberColor('theme-neon-cyber', 1)).not.toBe(gridNumberColor('theme-classic-dark', 1));
  });
});

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function luma(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const BOARD_A = ['theme-vintage-stone', 'theme-neon-cyber', 'theme-woodland'] as const;
const BOARD_B = ['theme-classic-dark', 'theme-ocean-breeze', 'theme-forest-trail'] as const;

describe('theme board A matches docs/theme-refs/theme-board-a-vintage-neon-woodland.jpg', () => {
  it('paints 1 and 2 in the sampled reference colors', () => {
    const sampled: Record<(typeof BOARD_A)[number], [string, string]> = {
      'theme-vintage-stone': ['#efd9b8', '#9fd884'],
      'theme-neon-cyber': ['#4fd8ff', '#4dfcc0'],
      'theme-woodland': ['#f6e0b4', '#b6d466'],
    };
    for (const id of BOARD_A) {
      const [one, two] = sampled[id];
      expect(distance(gridNumberColor(id, 1), one)).toBeLessThan(30);
      expect(distance(gridNumberColor(id, 2), two)).toBeLessThan(30);
    }
  });

  it('raises lighter hidden tiles over dark sunken revealed and flagged tiles', () => {
    for (const id of ['theme-vintage-stone', 'theme-woodland'] as const) {
      const paint = THEME_TOKENS[id];
      expect(luma(paint.hidden) - luma(paint.revealed)).toBeGreaterThan(20);
      expect(paint.flaggedSunken).toBe(true);
    }
    expect(distance(THEME_TOKENS['theme-vintage-stone'].hidden, '#433a30')).toBeLessThan(20);
    expect(distance(THEME_TOKENS['theme-vintage-stone'].revealed, '#211d17')).toBeLessThan(20);
    expect(distance(THEME_TOKENS['theme-woodland'].hidden, '#76502d')).toBeLessThan(20);
    expect(THEME_TOKENS['theme-neon-cyber'].flaggedSunken).toBe(true);
  });

  it('glows neon numbers and edges, dims revealed edges, and splits found/broken accents', () => {
    const neon = THEME_TOKENS['theme-neon-cyber'];
    expect(neon.numberGlow).toBeGreaterThan(0);
    expect(neon.cellGlow).not.toBeNull();
    expect(luma(neon.revealedBorder)).toBeLessThan(luma(neon.cellBorder));
    expect(neon.foundBorder).not.toBe(neon.brokenBorder);
    expect(neon.chamfer).toBe(true);
    expect(THEME_TOKENS['theme-vintage-stone'].chamfer).toBe(false);
    expect(THEME_TOKENS['theme-woodland'].chamfer).toBe(false);
  });

  it('keeps vintage and neon number cells plain, with only a faint woodland cast', () => {
    for (const id of ['theme-vintage-stone', 'theme-neon-cyber'] as const) {
      const paint = THEME_TOKENS[id];
      expect(numberCellFill(paint, 2)).toBe(paint.revealed);
    }
    const wood = THEME_TOKENS['theme-woodland'];
    const two = numberCellFill(wood, 2);
    expect(two).not.toBe(wood.revealed);
    expect(distance(two, wood.revealed)).toBeLessThan(15);
    expect(numberCellFill(wood, 1)).toBe(wood.revealed);
    expect(numberCellFill(THEME_TOKENS['theme-classic-dark'], 2)).toBe(
      THEME_TOKENS['theme-classic-dark'].revealed,
    );
  });

  it('frames the board on board A themes and leaves the others unframed', () => {
    for (const id of BOARD_A) expect(boardFrameInset(THEME_TOKENS[id])).toBeGreaterThan(0);
    for (const id of BOARD_B) {
      const paint = THEME_TOKENS[id];
      expect(boardFrameInset(paint)).toBe(0);
      expect(paint.numberTint).toBe(0);
      expect(paint.backdrop).toBe('none');
    }
    expect(THEME_TOKENS['theme-woodland'].backdrop).toBe('woodland');
    expect(THEME_TOKENS['theme-neon-cyber'].backdrop).toBe('neon');
  });

  it('keeps the Dig/Flag labels in their accent when idle on board A', () => {
    for (const id of BOARD_A) expect(THEME_TOKENS[id].dimIdleLabel).toBe(false);
    expect(THEME_TOKENS['theme-classic-dark'].dimIdleLabel).toBe(true);
    expect(THEME_TOKENS['theme-woodland'].digText).not.toBe(THEME_TOKENS['theme-woodland'].flagText);
  });
});

describe('theme board B matches docs/theme-refs/theme-board-b-classic-ocean-forest.jpg', () => {
  it('paints 1 and 2 in the sampled reference colors', () => {
    const sampled: Record<(typeof BOARD_B)[number], [string, string]> = {
      'theme-classic-dark': ['#88d6fc', '#8bf2bb'],
      'theme-ocean-breeze': ['#b0eefd', '#88f3b5'],
      'theme-forest-trail': ['#f8c963', '#b2cc6e'],
    };
    for (const id of BOARD_B) {
      const [one, two] = sampled[id];
      expect(distance(gridNumberColor(id, 1), one)).toBeLessThan(30);
      expect(distance(gridNumberColor(id, 2), two)).toBeLessThan(30);
    }
  });

  it('uses the sampled hidden, revealed, and exploded tile fills', () => {
    const sampled: Record<(typeof BOARD_B)[number], [string, string, string]> = {
      'theme-classic-dark': ['#2b2622', '#191410', '#2d130c'],
      'theme-ocean-breeze': ['#6f889c', '#17324e', '#2f252e'],
      'theme-forest-trail': ['#2c3928', '#182318', '#2c1f17'],
    };
    for (const id of BOARD_B) {
      const [hidden, revealed, exploded] = sampled[id];
      const paint = THEME_TOKENS[id];
      expect(distance(paint.hidden, hidden)).toBeLessThan(20);
      expect(distance(paint.revealed, revealed)).toBeLessThan(20);
      expect(distance(paint.exploded, exploded)).toBeLessThan(20);
    }
  });

  it('sinks flags on classic and ocean but keeps them raised on forest', () => {
    expect(THEME_TOKENS['theme-classic-dark'].flaggedSunken).toBe(true);
    expect(THEME_TOKENS['theme-ocean-breeze'].flaggedSunken).toBe(true);
    expect(THEME_TOKENS['theme-forest-trail'].flaggedSunken).toBe(false);
  });

  it('labels Found in gold and keeps the idle Flag label readable', () => {
    for (const id of BOARD_B) {
      expect(distance(THEME_TOKENS[id].foundAccent, '#eec466')).toBeLessThan(30);
    }
    const ocean = THEME_TOKENS['theme-ocean-breeze'];
    expect(ocean.dimIdleLabel).toBe(false);
    expect(distance(ocean.flagText, '#c2d8e8')).toBeLessThan(30);
    expect(distance(ocean.digText, '#76d2f6')).toBeLessThan(30);
    expect(ocean.digIcon).not.toBeNull();
    const forest = THEME_TOKENS['theme-forest-trail'];
    expect(forest.dimIdleLabel).toBe(false);
    expect(distance(forest.digText, '#c2ca77')).toBeLessThan(30);
  });

  it('bevels raised ocean and forest tiles', () => {
    for (const id of ['theme-ocean-breeze', 'theme-forest-trail'] as const) {
      expect(THEME_TOKENS[id].bevelHi).not.toBe('transparent');
    }
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

  it('wires the board A chrome tokens into the board, HUD, dock, and shell', () => {
    const shell = readFileSync(resolve(__dirname, '../native/src/ui/Shell.tsx'), 'utf8');
    expect(board).toContain('numberCellFill');
    expect(board).toContain('revealedBorder');
    expect(board).toContain('explodedBorder');
    expect(board).toContain('boardFrameInset');
    expect(play).toContain('boardFrameInset');
    expect(play).toContain('t.foundBorder');
    expect(play).toContain('t.brokenBorder');
    expect(play).toContain('t.digText');
    expect(play).toContain('t.flagText');
    expect(shell).toContain('Backdrop');
  });
});
