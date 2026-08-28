import {
  addItem,
  emptyInventory,
  isCollectible,
  isItemId,
  type Inventory,
  type ItemId,
} from './loot';

export const COLLECTION_KEY = 'crawler-mines-collection';

export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CollectionState {
  gold: number;
  items: Inventory;
}

export function emptyCollection(): CollectionState {
  return { gold: 0, items: emptyInventory() };
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

export function loadCollection(store: KeyStore = defaultStore()): CollectionState {
  const state = emptyCollection();
  const raw = store.getItem(COLLECTION_KEY);
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      gold?: unknown;
      items?: Record<string, unknown>;
    };
    if (!parsed || typeof parsed !== 'object') return state;
    state.gold = clampGold(parsed.gold);
    const items = parsed.items;
    if (!items || typeof items !== 'object') return state;
    for (const [key, value] of Object.entries(items)) {
      if (!isItemId(key) || !isCollectible(key)) continue;
      const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
      if (n > 0) state.items[key] = n;
    }
    return state;
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
  store.setItem(
    COLLECTION_KEY,
    JSON.stringify({ v: 1, gold: clampGold(state.gold), items }),
  );
}

export function applyRewards(
  state: CollectionState,
  rewards: ReadonlyArray<{ itemId: ItemId; gold: number }>,
  store: KeyStore = defaultStore(),
): CollectionState {
  let gold = clampGold(state.gold);
  let items = { ...state.items, 'gold-pouch': 0 };
  for (const r of rewards) {
    if (r.itemId === 'gold-pouch') {
      gold += clampGold(r.gold);
    } else {
      items = addItem(items, r.itemId);
    }
  }
  const next = { gold, items };
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
