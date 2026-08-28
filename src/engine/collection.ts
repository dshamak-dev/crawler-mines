import {
  addItem,
  emptyInventory,
  isItemId,
  type Inventory,
  type ItemId,
} from './loot';

export const COLLECTION_KEY = 'crawler-mines-collection';

export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

export function loadCollection(store: KeyStore = defaultStore()): Inventory {
  const inv = emptyInventory();
  const raw = store.getItem(COLLECTION_KEY);
  if (!raw) return inv;
  try {
    const parsed = JSON.parse(raw) as { v?: number; items?: Record<string, unknown> };
    const items = parsed && typeof parsed === 'object' ? parsed.items : undefined;
    if (!items || typeof items !== 'object') return inv;
    for (const [key, value] of Object.entries(items)) {
      if (!isItemId(key)) continue;
      const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
      if (n > 0) inv[key] = n;
    }
    return inv;
  } catch {
    return inv;
  }
}

export function saveCollection(inv: Inventory, store: KeyStore = defaultStore()): void {
  const items: Record<ItemId, number> = emptyInventory();
  for (const id of Object.keys(items) as ItemId[]) {
    items[id] = Math.max(0, Math.floor(inv[id] ?? 0));
  }
  store.setItem(COLLECTION_KEY, JSON.stringify({ v: 1, items }));
}

export function collectLoot(
  inv: Inventory,
  itemId: ItemId,
  store: KeyStore = defaultStore(),
): Inventory {
  const next = addItem(inv, itemId);
  saveCollection(next, store);
  return next;
}
