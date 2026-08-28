import type { Difficulty, Rng } from './types';

export const ITEM_IDS = [
  'gold-pouch',
  'rusty-key',
  'torch-charm',
  'gem',
  'relic-shard',
  'hard-key',
  'campaign-key',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export const CHEST_TIERS = ['wooden', 'iron', 'gilded', 'rare'] as const;
export type ChestTier = (typeof CHEST_TIERS)[number];

export const TIER_COPY: Record<
  ChestTier,
  { name: string; found: string; broken: string }
> = {
  wooden: {
    name: 'Wooden chest',
    found: 'Found · still sealed',
    broken: 'Smashed · loot lost',
  },
  iron: {
    name: 'Iron chest',
    found: 'Found · still sealed',
    broken: 'Smashed · loot lost',
  },
  gilded: {
    name: 'Gilded chest',
    found: 'Found · still sealed',
    broken: 'Smashed · loot lost',
  },
  rare: {
    name: 'Rare chest',
    found: 'Found · still sealed',
    broken: 'Smashed · loot lost',
  },
};

export function isChestTier(value: unknown): value is ChestTier {
  return (CHEST_TIERS as readonly string[]).includes(value as string);
}

/** Visible chest shell. Inner loot stays hidden until the floor is cleared. */
export function tierForLoot(itemId: ItemId): ChestTier {
  if (itemId === 'hard-key' || itemId === 'campaign-key') return 'rare';
  if (itemId === 'relic-shard') return 'gilded';
  if (itemId === 'gem' || itemId === 'torch-charm') return 'iron';
  return 'wooden';
}

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
  'hard-key': {
    id: 'hard-key',
    name: 'Hard key',
    flavor: 'Burns on a Hard enter. No refund.',
    grantsGold: false,
  },
  'campaign-key': {
    id: 'campaign-key',
    name: 'Campaign key',
    flavor: 'One free five-floor descent. No refund.',
    grantsGold: false,
  },
};

const BASE_LOOT_TABLE: ReadonlyArray<{ itemId: ItemId; weight: number }> = [
  { itemId: 'gold-pouch', weight: 34 },
  { itemId: 'rusty-key', weight: 22 },
  { itemId: 'torch-charm', weight: 18 },
  { itemId: 'gem', weight: 16 },
  { itemId: 'relic-shard', weight: 10 },
  { itemId: 'hard-key', weight: 3 },
];

/** Hard and Campaign only — about 1% of chests. Easy/Medium never roll this. */
const CAMPAIGN_KEY_WEIGHT = 1;

export function lootTableFor(mode: Difficulty): ReadonlyArray<{ itemId: ItemId; weight: number }> {
  if (mode === 'easy' || mode === 'medium') return BASE_LOOT_TABLE;
  return [...BASE_LOOT_TABLE, { itemId: 'campaign-key', weight: CAMPAIGN_KEY_WEIGHT }];
}

export function campaignKeyDropRate(mode: Difficulty): number {
  const table = lootTableFor(mode);
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  const row = table.find((r) => r.itemId === 'campaign-key');
  return row ? row.weight / total : 0;
}

export type Inventory = Record<ItemId, number>;

export function emptyInventory(): Inventory {
  return {
    'gold-pouch': 0,
    'rusty-key': 0,
    'torch-charm': 0,
    gem: 0,
    'relic-shard': 0,
    'hard-key': 0,
    'campaign-key': 0,
  };
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);
}

export function rollLoot(rng: Rng, mode: Difficulty = 'easy'): ItemId {
  const table = lootTableFor(mode);
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let ticket = rng() * total;
  for (const row of table) {
    ticket -= row.weight;
    if (ticket < 0) return row.itemId;
  }
  return table[table.length - 1].itemId;
}

export function goldForLoot(itemId: ItemId, chestValue: number): number {
  return ITEMS[itemId].grantsGold ? chestValue : 0;
}

export function addItem(inv: Inventory, itemId: ItemId, n = 1): Inventory {
  return { ...inv, [itemId]: (inv[itemId] ?? 0) + n };
}

export function removeItem(inv: Inventory, itemId: ItemId, n = 1): Inventory {
  return { ...inv, [itemId]: Math.max(0, (inv[itemId] ?? 0) - n) };
}

/** Pouches convert to wallet coins; they are not pack salvage. */
export function isCollectible(itemId: ItemId): boolean {
  return itemId !== 'gold-pouch';
}

export function isTicketKey(itemId: ItemId): boolean {
  return itemId === 'hard-key' || itemId === 'campaign-key';
}

export function inventoryTotal(inv: Inventory): number {
  return ITEM_IDS.reduce(
    (sum, id) => sum + (isCollectible(id) ? (inv[id] ?? 0) : 0),
    0,
  );
}

export function stackedEntries(
  inv: Inventory,
): Array<{ item: ItemDef; count: number }> {
  return ITEM_IDS.filter(isCollectible)
    .map((id) => ({ item: ITEMS[id], count: inv[id] ?? 0 }))
    .filter((row) => row.count > 0);
}
