import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  DEFAULT_FLAG_SKIN,
  DEFAULT_GRID_SKIN,
  FLAG_SKIN_IDS,
  FLAG_SKIN_PAINT,
  GRID_SKIN_IDS,
  GRID_SKIN_PAINT,
  SHOP_BUY,
  SKIN_IDS,
  SKINS,
  buyGold,
  buyGoods,
  buySkin,
  buyableEntries,
  emptyCollection,
  isBuyable,
  isDefaultSkin,
  isSkinOwned,
  loadCollection,
  selectFlagSkin,
  selectGridSkin,
  selectedFlagSkin,
  selectedGridSkin,
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

describe('#49 skin catalog', () => {
  it('owns the default flag and grid for free', () => {
    const meta = emptyCollection();
    expect(meta.selectedFlagSkin).toBe('flag-red');
    expect(meta.selectedGridSkin).toBe('grid-gray');
    expect(DEFAULT_FLAG_SKIN).toBe('flag-red');
    expect(DEFAULT_GRID_SKIN).toBe('grid-gray');
    for (const id of SKIN_IDS) {
      expect(SKINS[id].name.length).toBeGreaterThan(2);
      expect(SKINS[id].flavor.length).toBeGreaterThan(8);
      if (isDefaultSkin(id)) {
        expect(isSkinOwned(meta, id)).toBe(true);
        expect(isBuyable(id)).toBe(false);
        expect(buyGold(id)).toBe(0);
      }
    }
    expect(FLAG_SKIN_IDS).toEqual(['flag-red', 'flag-golden', 'flag-pirate']);
    expect(GRID_SKIN_IDS).toEqual(['grid-gray', 'grid-classic', 'grid-vintage']);
  });

  it('lists paid skins in SHOP_BUY at the locked prices', () => {
    expect(SHOP_BUY['flag-golden']).toBe(500);
    expect(SHOP_BUY['flag-pirate']).toBe(500);
    expect(SHOP_BUY['grid-classic']).toBe(1000);
    expect(SHOP_BUY['grid-vintage']).toBe(1000);
    expect(buyGold('flag-golden')).toBe(500);
    expect(buyGold('grid-classic')).toBe(1000);
    const paid = buyableEntries()
      .filter((row) => row.kind === 'skin')
      .map((row) => [row.item.id, row.gold]);
    expect(paid).toEqual([
      ['flag-golden', 500],
      ['flag-pirate', 500],
      ['grid-classic', 1000],
      ['grid-vintage', 1000],
    ]);
  });

  it('keeps independent flag and grid paint tokens', () => {
    expect(FLAG_SKIN_PAINT['flag-golden'].cloth).not.toBe(FLAG_SKIN_PAINT['flag-red'].cloth);
    expect(FLAG_SKIN_PAINT['flag-golden'].pole).not.toBe(FLAG_SKIN_PAINT['flag-red'].pole);
    expect(FLAG_SKIN_PAINT['flag-pirate'].mark).toBe('skull');
    expect(GRID_SKIN_PAINT['grid-classic'].hidden).not.toBe(GRID_SKIN_PAINT['grid-gray'].hidden);
    expect(GRID_SKIN_PAINT['grid-vintage'].hidden).not.toBe(GRID_SKIN_PAINT['grid-gray'].hidden);
  });
});

describe('#49 buy and select skins', () => {
  it('buys a paid skin, persists ownership, and refuses a second copy', () => {
    const store = memoryStore();
    const broke = buySkin({ ...emptyCollection(), gold: 499 }, 'flag-golden', store);
    expect(broke).toBeNull();
    expect(loadCollection(store).gold).toBe(0);
    const bought = buySkin({ ...emptyCollection(), gold: 1500 }, 'flag-golden', store);
    expect(bought).not.toBeNull();
    expect(bought!.gold).toBe(1000);
    expect(isSkinOwned(bought, 'flag-golden')).toBe(true);
    expect(bought!.selectedFlagSkin).toBe('flag-red');
    const loaded = loadCollection(store);
    expect(isSkinOwned(loaded, 'flag-golden')).toBe(true);
    expect(loaded.gold).toBe(1000);
    expect(buySkin(loaded, 'flag-golden', store)).toBeNull();
    expect(loadCollection(store).gold).toBe(1000);
    expect(buySkin(loaded, 'flag-red', store)).toBeNull();
  });

  it('selects owned skins independently and persists both slots', () => {
    const store = memoryStore();
    let meta = buyGoods({ ...emptyCollection(), gold: 2000 }, 'flag-pirate', 1, store);
    meta = buyGoods(meta!, 'grid-vintage', 1, store);
    expect(meta!.gold).toBe(500);
    expect(selectFlagSkin(meta!, 'flag-pirate', store)).not.toBeNull();
    expect(selectGridSkin(loadCollection(store), 'grid-vintage', store)).not.toBeNull();
    const loaded = loadCollection(store);
    expect(selectedFlagSkin(loaded)).toBe('flag-pirate');
    expect(selectedGridSkin(loaded)).toBe('grid-vintage');
    expect(isSkinOwned(loaded, 'flag-red')).toBe(true);
    expect(isSkinOwned(loaded, 'grid-gray')).toBe(true);
    expect(selectFlagSkin(loaded, 'flag-golden', store)).toBeNull();
    expect(loadCollection(store).selectedGridSkin).toBe('grid-vintage');
    expect(selectGridSkin(loaded, 'grid-classic', store)).toBeNull();
    expect(loadCollection(store).selectedFlagSkin).toBe('flag-pirate');
  });

  it('reloads defaults when a save omits skins or points at an unowned pick', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 40,
        items: { gem: 1 },
        selectedFlagSkin: 'flag-golden',
        selectedGridSkin: 'grid-classic',
      }),
    });
    const loaded = loadCollection(store);
    expect(loaded.gold).toBe(40);
    expect(loaded.items.gem).toBe(1);
    expect(isSkinOwned(loaded, 'flag-red')).toBe(true);
    expect(isSkinOwned(loaded, 'flag-golden')).toBe(false);
    expect(loaded.selectedFlagSkin).toBe('flag-red');
    expect(loaded.selectedGridSkin).toBe('grid-gray');
  });

  it('updates the game store buy and select helpers', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 1600,
        items: {},
      }),
    });
    const game = createGameStore(store);
    expect(isSkinOwned(game.getState().meta, 'flag-red')).toBe(true);
    expect(game.getState().buy('flag-golden', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(1100);
    expect(isSkinOwned(game.getState().meta, 'flag-golden')).toBe(true);
    expect(game.getState().buy('flag-golden', 1)).toBe(false);
    expect(game.getState().buy('grid-classic', 1)).toBe(true);
    expect(game.getState().meta.gold).toBe(100);
    expect(game.getState().selectFlagSkin('flag-golden')).toBe(true);
    expect(game.getState().selectGridSkin('grid-classic')).toBe(true);
    expect(game.getState().selectFlagSkin('flag-pirate')).toBe(false);
    expect(game.getState().meta.selectedFlagSkin).toBe('flag-golden');
    expect(game.getState().meta.selectedGridSkin).toBe('grid-classic');
    const again = createGameStore(store);
    expect(again.getState().meta.selectedFlagSkin).toBe('flag-golden');
    expect(again.getState().meta.selectedGridSkin).toBe('grid-classic');
    expect(isSkinOwned(again.getState().meta, 'flag-golden')).toBe(true);
    expect(isSkinOwned(again.getState().meta, 'grid-classic')).toBe(true);
  });
});

describe('#49 collection and shop wiring', () => {
  const collection = readFileSync(resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'), 'utf8');
  const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
  const shop = readFileSync(resolve(__dirname, '../native/src/ui/ShopScreen.tsx'), 'utf8');
  const board = readFileSync(resolve(__dirname, '../native/src/ui/Board.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');
  const icons = readFileSync(resolve(__dirname, '../native/src/ui/icons.tsx'), 'utf8');

  it('replaces All salvage / This run with Items | Skins on the title collection', () => {
    expect(collection).toContain("useState<'items' | 'skins'>('items')");
    expect(collection).toContain('Items');
    expect(collection).toContain('Skins');
    expect(collection).toContain('>Flag<');
    expect(collection).toContain('>Grid<');
    expect(collection).not.toContain('All salvage');
    expect(collection).not.toContain('This run');
    expect(collection).toContain('previewForSkin');
    expect(collection).toContain('onSelectFlag');
    expect(collection).toContain('onSelectGrid');
    expect(route).toContain('onSelectFlag');
    expect(route).toContain('selectFlagSkin');
  });

  it('keeps in-run collection sealed and without a skins tab', () => {
    expect(collection).toContain('function SealedCollection');
    expect(route).toContain('sealed={fromPlay}');
    const sealedStart = collection.indexOf('function SealedCollection');
    const sealed = collection.slice(sealedStart);
    expect(sealed).not.toContain('Skins');
    expect(sealed).not.toContain('previewForSkin');
  });

  it('shows Select on owned skins and Selected when already active', () => {
    expect(preview).toContain('previewForSkin');
    expect(preview).toContain('canSelect');
    expect(preview).toContain('Select');
    expect(preview).toContain('Selected');
    expect(preview).toContain('Use');
    expect(shop).toContain('previewForSkin');
    expect(shop).toContain('false, false');
    expect(shop).toContain('SkinIcon');
    expect(shop).toContain('Owned');
  });

  it('paints the board from the selected flag and grid skins', () => {
    expect(play).toContain('selectedFlagSkin');
    expect(play).toContain('selectedGridSkin');
    expect(play).toContain('flagSkin={flagSkin}');
    expect(play).toContain('gridSkin={gridSkin}');
    expect(board).toContain('flagSkin');
    expect(board).toContain('gridSkinPaint');
    expect(board).toContain('skin={flagSkin}');
    expect(icons).toContain('flagSkinPaint');
    expect(icons).toContain("mark === 'skull'");
    expect(icons).toContain('function GridSkinIcon');
  });
});
