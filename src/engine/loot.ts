import type { Rng } from './types';

export const ITEM_IDS = [
  'gold-pouch',
  'rusty-key',
  'torch-charm',
  'gem',
  'relic-shard',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  flavor: string;
  /** When true, opening this chest adds the floor's chestValue to gold. */
  grantsGold: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  'gold-pouch': {
    id: 'gold-pouch',
    name: 'Gold pouch',
    flavor: 'A fat little sack that still clinks.',
    grantsGold: true,
  },
  'rusty-key': {
    id: 'rusty-key',
    name: 'Rusty key',
    flavor: 'Whatever it opens is still down here.',
    grantsGold: false,
  },
  'torch-charm': {
    id: 'torch-charm',
    name: 'Torch charm',
    flavor: 'A stubborn spark that hates the dark.',
    grantsGold: false,
  },
  gem: {
    id: 'gem',
    name: 'Cave gem',
    flavor: 'Cut badly. Still worth a boast.',
    grantsGold: false,
  },
  'relic-shard': {
    id: 'relic-shard',
    name: 'Relic shard',
    flavor: 'A sliver of something that used to matter.',
    grantsGold: false,
  },
};

const LOOT_TABLE: ReadonlyArray<{ itemId: ItemId; weight: number }> = [
  { itemId: 'gold-pouch', weight: 34 },
  { itemId: 'rusty-key', weight: 22 },
  { itemId: 'torch-charm', weight: 18 },
  { itemId: 'gem', weight: 16 },
  { itemId: 'relic-shard', weight: 10 },
];

export type Inventory = Record<ItemId, number>;

export function emptyInventory(): Inventory {
  return {
    'gold-pouch': 0,
    'rusty-key': 0,
    'torch-charm': 0,
    gem: 0,
    'relic-shard': 0,
  };
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);
}

export function rollLoot(rng: Rng): ItemId {
  const total = LOOT_TABLE.reduce((sum, row) => sum + row.weight, 0);
  let ticket = rng() * total;
  for (const row of LOOT_TABLE) {
    ticket -= row.weight;
    if (ticket < 0) return row.itemId;
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1].itemId;
}

export function goldForLoot(itemId: ItemId, chestValue: number): number {
  return ITEMS[itemId].grantsGold ? chestValue : 0;
}

export function addItem(inv: Inventory, itemId: ItemId, n = 1): Inventory {
  return { ...inv, [itemId]: (inv[itemId] ?? 0) + n };
}

export function inventoryTotal(inv: Inventory): number {
  return ITEM_IDS.reduce((sum, id) => sum + (inv[id] ?? 0), 0);
}

export function stackedEntries(
  inv: Inventory,
): Array<{ item: ItemDef; count: number }> {
  return ITEM_IDS.map((id) => ({ item: ITEMS[id], count: inv[id] ?? 0 })).filter(
    (row) => row.count > 0,
  );
}
