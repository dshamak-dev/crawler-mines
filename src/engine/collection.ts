import {
  addItem,
  buyGold,
  clampBuyQty,
  clampSellQty,
  emptyInventory,
  isBuyable,
  isCollectible,
  isItemId,
  isSellable,
  removeItem,
  sellGold,
  type Inventory,
  type ItemId,
  type ShopBuyCatalog,
  type ShopGoodId,
  SHOP_BUY,
} from './loot';
import {
  DEFAULT_FLAG_SKIN,
  DEFAULT_GRID_SKIN,
  defaultOwnedSkins,
  isDefaultSkin,
  isFlagSkinId,
  isGridSkinId,
  isSkinId,
  isSkinOwned,
  normalizeOwnedSkins,
  selectedFlagSkin,
  selectedGridSkin,
  type FlagSkinId,
  type GridSkinId,
  type SkinId,
} from './skins';

export const COLLECTION_KEY = 'crawler-mines-collection';

export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface CollectionState {
  gold: number;
  items: Inventory;
  /** Floor instance whose rewards were already banked. Blocks a second wallet/pack grant. */
  lastGrantKey: string | null;
  ownedSkins: SkinId[];
  selectedFlagSkin: FlagSkinId;
  selectedGridSkin: GridSkinId;
}

export function emptyCollection(): CollectionState {
  return {
    gold: 0,
    items: emptyInventory(),
    lastGrantKey: null,
    ownedSkins: defaultOwnedSkins(),
    selectedFlagSkin: DEFAULT_FLAG_SKIN,
    selectedGridSkin: DEFAULT_GRID_SKIN,
  };
}

function memoryFallback(): KeyStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

export function defaultStore(): KeyStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* private mode / node tests */
  }
  return memoryFallback();
}

function clampGold(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function withSkins(
  state: Omit<CollectionState, 'ownedSkins' | 'selectedFlagSkin' | 'selectedGridSkin'> &
    Partial<Pick<CollectionState, 'ownedSkins' | 'selectedFlagSkin' | 'selectedGridSkin'>>,
): CollectionState {
  const ownedSkins = normalizeOwnedSkins(state.ownedSkins);
  return {
    gold: clampGold(state.gold),
    items: state.items,
    lastGrantKey: state.lastGrantKey,
    ownedSkins,
    selectedFlagSkin: selectedFlagSkin({ ...state, ownedSkins }),
    selectedGridSkin: selectedGridSkin({ ...state, ownedSkins }),
  };
}

export function loadCollection(store: KeyStore = defaultStore()): CollectionState {
  const state = emptyCollection();
  const raw = store.getItem(COLLECTION_KEY);
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      gold?: unknown;
      items?: Record<string, unknown>;
      lastGrantKey?: unknown;
      ownedSkins?: unknown;
      selectedFlagSkin?: unknown;
      selectedGridSkin?: unknown;
    };
    if (!parsed || typeof parsed !== 'object') return state;
    state.gold = clampGold(parsed.gold);
    state.lastGrantKey =
      typeof parsed.lastGrantKey === 'string' && parsed.lastGrantKey.length > 0
        ? parsed.lastGrantKey
        : null;
    const items = parsed.items;
    if (items && typeof items === 'object') {
      for (const [key, value] of Object.entries(items)) {
        if (!isItemId(key) || !isCollectible(key)) continue;
        const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
        if (n > 0) state.items[key] = n;
      }
    }
    return withSkins({
      ...state,
      ownedSkins: normalizeOwnedSkins(parsed.ownedSkins),
      selectedFlagSkin: isFlagSkinId(parsed.selectedFlagSkin)
        ? parsed.selectedFlagSkin
        : DEFAULT_FLAG_SKIN,
      selectedGridSkin: isGridSkinId(parsed.selectedGridSkin)
        ? parsed.selectedGridSkin
        : DEFAULT_GRID_SKIN,
    });
  } catch {
    return emptyCollection();
  }
}

export function saveCollection(
  state: CollectionState,
  store: KeyStore = defaultStore(),
): void {
  const items: Record<ItemId, number> = emptyInventory();
  for (const id of Object.keys(items) as ItemId[]) {
    items[id] = isCollectible(id) ? Math.max(0, Math.floor(state.items[id] ?? 0)) : 0;
  }
  const next = withSkins({ ...state, items });
  store.setItem(
    COLLECTION_KEY,
    JSON.stringify({
      v: 1,
      gold: next.gold,
      items,
      lastGrantKey: next.lastGrantKey,
      ownedSkins: next.ownedSkins,
      selectedFlagSkin: next.selectedFlagSkin,
      selectedGridSkin: next.selectedGridSkin,
    }),
  );
}

export function applyRewards(
  state: CollectionState,
  rewards: ReadonlyArray<{ itemId: ItemId; gold: number }>,
  store: KeyStore = defaultStore(),
  grantKey: string | null = null,
): CollectionState {
  if (grantKey && state.lastGrantKey === grantKey) return state;
  let gold = clampGold(state.gold);
  let items = { ...state.items, 'gold-pouch': 0 };
  for (const r of rewards) {
    if (r.itemId === 'gold-pouch') {
      gold += clampGold(r.gold);
    } else {
      items = addItem(items, r.itemId);
    }
  }
  const next = withSkins({
    ...state,
    gold,
    items,
    lastGrantKey: grantKey ?? state.lastGrantKey,
  });
  saveCollection(next, store);
  return next;
}

export function collectLoot(
  state: CollectionState,
  itemId: ItemId,
  store: KeyStore = defaultStore(),
  gold = 0,
): CollectionState {
  return applyRewards(state, [{ itemId, gold }], store);
}

/**
 * Sell `qty` of a named loot stack into the wallet. Persists immediately.
 * Qty clamps to 1..owned. Unsellable items and empty stacks return null.
 */
export function sellLoot(
  state: CollectionState,
  itemId: ItemId,
  qty: number,
  store: KeyStore = defaultStore(),
): CollectionState | null {
  if (!isSellable(itemId)) return null;
  const owned = Math.max(0, Math.floor(state.items[itemId] ?? 0));
  const n = clampSellQty(owned, qty);
  if (n < 1) return null;
  const next = withSkins({
    ...state,
    gold: clampGold(state.gold) + sellGold(itemId) * n,
    items: removeItem(state.items, itemId, n),
  });
  saveCollection(next, store);
  return next;
}

/**
 * Buy `qty` of a catalog item for gold. Persists immediately.
 * Short gold, missing catalog price, or a non-collectible id returns null
 * and charges nothing.
 */
export function buyLoot(
  state: CollectionState,
  itemId: ItemId,
  qty: number,
  store: KeyStore = defaultStore(),
  catalog: ShopBuyCatalog = SHOP_BUY,
): CollectionState | null {
  if (!isBuyable(itemId, catalog) || !isCollectible(itemId)) return null;
  const n = clampBuyQty(qty);
  if (n < 1) return null;
  const cost = buyGold(itemId, catalog) * n;
  const gold = clampGold(state.gold);
  if (gold < cost) return null;
  const next = withSkins({
    ...state,
    gold: gold - cost,
    items: addItem(state.items, itemId, n),
  });
  saveCollection(next, store);
  return next;
}

/**
 * Buy one paid skin. Already-owned, default, missing price, or short gold
 * returns null and charges nothing.
 */
export function buySkin(
  state: CollectionState,
  skinId: SkinId,
  store: KeyStore = defaultStore(),
  catalog: ShopBuyCatalog = SHOP_BUY,
): CollectionState | null {
  if (!isSkinId(skinId) || isDefaultSkin(skinId) || isSkinOwned(state, skinId)) return null;
  if (!isBuyable(skinId, catalog)) return null;
  const cost = buyGold(skinId, catalog);
  const gold = clampGold(state.gold);
  if (gold < cost) return null;
  const next = withSkins({
    ...state,
    gold: gold - cost,
    ownedSkins: normalizeOwnedSkins([...(state.ownedSkins ?? []), skinId]),
  });
  saveCollection(next, store);
  return next;
}

/** Item or paid skin. Skins ignore qty and buy at most one copy. */
export function buyGoods(
  state: CollectionState,
  id: ShopGoodId,
  qty: number,
  store: KeyStore = defaultStore(),
  catalog: ShopBuyCatalog = SHOP_BUY,
): CollectionState | null {
  if (isSkinId(id)) return buySkin(state, id, store, catalog);
  if (isItemId(id)) return buyLoot(state, id, qty, store, catalog);
  return null;
}

export function selectFlagSkin(
  state: CollectionState,
  skinId: FlagSkinId,
  store: KeyStore = defaultStore(),
): CollectionState | null {
  if (!isFlagSkinId(skinId) || !isSkinOwned(state, skinId)) return null;
  const next = withSkins({ ...state, selectedFlagSkin: skinId });
  saveCollection(next, store);
  return next;
}

export function selectGridSkin(
  state: CollectionState,
  skinId: GridSkinId,
  store: KeyStore = defaultStore(),
): CollectionState | null {
  if (!isGridSkinId(skinId) || !isSkinOwned(state, skinId)) return null;
  const next = withSkins({ ...state, selectedGridSkin: skinId });
  saveCollection(next, store);
  return next;
}
