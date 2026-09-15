import {
  SKIN_IDS,
  SKINS,
  isSkinOwned,
  type SkinDef,
  type SkinId,
} from './skins';
import type { Difficulty, Rng } from './types';

export const ITEM_IDS = [
  'gold-pouch',
  'rusty-key',
  'secret-chest',
  'torch-charm',
  'gem',
  'relic-shard',
  'hard-key',
  'campaign-key',
  'gluttony-head',
  'wrath-head',
  'lust-head',
  'bronze-medal',
  'silver-medal',
  'gold-medal',
  'gold-cup',
  'bone-dust',
  'witchcraft-bag',
  'scroll-of-portal',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export const CHEST_TIERS = ['wooden', 'iron', 'gilded', 'rare', 'secret'] as const;
export type ChestTier = (typeof CHEST_TIERS)[number];

export const SECRET_CHEST_ID = 'secret-chest' as const;
export type SecretChestId = typeof SECRET_CHEST_ID;

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
  secret: {
    name: 'Secret chest',
    found: 'Found · sealed for collection',
    broken: 'Smashed · loot lost',
  },
};

export function isSecretChestId(value: unknown): value is SecretChestId {
  return value === SECRET_CHEST_ID;
}

export function isChestTier(value: unknown): value is ChestTier {
  return (CHEST_TIERS as readonly string[]).includes(value as string);
}

/** Visible chest shell. Inner loot stays hidden until the floor is cleared. */
export function tierForLoot(itemId: ItemId): ChestTier {
  if (itemId === SECRET_CHEST_ID) return 'secret';
  if (itemId === 'hard-key' || itemId === 'campaign-key' || isMedal(itemId) || itemId === 'gold-cup') {
    return 'rare';
  }
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
    flavor: 'Fits a secret chest. One latch, then gone.',
    grantsGold: false,
  },
  'secret-chest': {
    id: 'secret-chest',
    name: 'Secret chest',
    flavor: 'A locked latch. One rusty key, then whatever was hiding inside.',
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
  'gluttony-head': {
    id: 'gluttony-head',
    name: 'Gluttony head',
    flavor: 'A trophy from the flag-eater. Stacks.',
    grantsGold: false,
  },
  'wrath-head': {
    id: 'wrath-head',
    name: 'Wrath head',
    flavor: 'A trophy from the slam-hunter. Stacks.',
    grantsGold: false,
  },
  'lust-head': {
    id: 'lust-head',
    name: 'Lust head',
    flavor: 'A trophy from the heart-walker. Stacks.',
    grantsGold: false,
  },
  'bronze-medal': {
    id: 'bronze-medal',
    name: 'Bronze medal',
    flavor: 'A perfect Easy clear. Every mine marked.',
    grantsGold: false,
  },
  'silver-medal': {
    id: 'silver-medal',
    name: 'Silver medal',
    flavor: 'A perfect Medium clear. Every mine marked.',
    grantsGold: false,
  },
  'gold-medal': {
    id: 'gold-medal',
    name: 'Gold medal',
    flavor: 'A perfect Hard clear. Every mine marked.',
    grantsGold: false,
  },
  'gold-cup': {
    id: 'gold-cup',
    name: 'Gold cup',
    flavor: 'A trophy from a campaign whose every descent floor was perfect.',
    grantsGold: false,
  },
  'bone-dust': {
    id: 'bone-dust',
    name: 'Bone dust',
    flavor: 'Pale grit scraped from something that used to walk.',
    grantsGold: false,
  },
  /** Shop-only. Use / 3-slot ritual is #46 — do not consume or open a modal here. */
  'witchcraft-bag': {
    id: 'witchcraft-bag',
    name: 'Witchcraft bag',
    flavor: 'A stitched pouch that wants three offerings.',
    grantsGold: false,
  },
  /** Shop-only reagent. Not usable alone — #46 ritual only. */
  'scroll-of-portal': {
    id: 'scroll-of-portal',
    name: 'Scroll of portal',
    flavor: 'Cave-ink directions. Useless until a bag opens them.',
    grantsGold: false,
  },
};

/** Collection stack alias. Same row as ITEMS['secret-chest']. */
export const SECRET_CHEST = ITEMS[SECRET_CHEST_ID];

export const SECRET_CHEST_COPY =
  'Socket a rusty key. Close cancels. The chest and key burn on open.';

const BASE_LOOT_TABLE: ReadonlyArray<{ itemId: ItemId; weight: number }> = [
  { itemId: 'gold-pouch', weight: 34 },
  { itemId: 'rusty-key', weight: 22 },
  { itemId: 'torch-charm', weight: 18 },
  { itemId: 'gem', weight: 16 },
  { itemId: 'relic-shard', weight: 10 },
  { itemId: 'hard-key', weight: 3 },
];

/** Pouch / rusty key / torch / gem / shard — ticket keys stay off the secret table. */
export const SECRET_NORMAL_TABLE: ReadonlyArray<{ itemId: ItemId; weight: number }> =
  BASE_LOOT_TABLE.filter((row) => row.itemId !== 'hard-key');

export const SCROLL_IDS = ['scroll-of-portal'] as const;
export type ScrollId = (typeof SCROLL_IDS)[number];

/** Sequential exclusive rare checks, then two weighted normals. */
export const SECRET_SCROLL_RATE = 0.02;
export const SECRET_BAG_RATE = 0.03;
export const SECRET_DUST_RATE = 0.05;
/** Per generated chest. Arena floors still place zero chests. */
export const SECRET_CHEST_SPAWN_RATE = 0.08;

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
  return Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Inventory;
}

export function isMedal(itemId: ItemId): boolean {
  return itemId === 'bronze-medal' || itemId === 'silver-medal' || itemId === 'gold-medal';
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);
}

function pickWeighted(
  table: ReadonlyArray<{ itemId: ItemId; weight: number }>,
  rng: Rng,
): ItemId {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let ticket = rng() * total;
  for (const row of table) {
    ticket -= row.weight;
    if (ticket < 0) return row.itemId;
  }
  return table[table.length - 1].itemId;
}

export function rollLoot(rng: Rng, mode: Difficulty = 'easy'): ItemId {
  return pickWeighted(lootTableFor(mode), rng);
}

export function rollSecretNormal(rng: Rng): ItemId {
  return pickWeighted(SECRET_NORMAL_TABLE, rng);
}

export function rollRandomScroll(rng: Rng): ScrollId {
  return SCROLL_IDS[Math.floor(rng() * SCROLL_IDS.length)];
}

/**
 * One rare path per open: 2% scroll, else 3% bag, else 5% bone dust,
 * else two independent chest-table normals. Rares do not also grant the pair.
 */
export function rollSecretChestLoot(rng: Rng): ItemId[] {
  const roll = rng();
  if (roll < SECRET_SCROLL_RATE) return [rollRandomScroll(rng)];
  if (roll < SECRET_SCROLL_RATE + SECRET_BAG_RATE) return ['witchcraft-bag'];
  if (roll < SECRET_SCROLL_RATE + SECRET_BAG_RATE + SECRET_DUST_RATE) return ['bone-dust'];
  return [rollSecretNormal(rng), rollSecretNormal(rng)];
}

/** Each gold pouch grants a random integer 1–4 coins. */
export function rollPouchGold(rng: Rng): number {
  return Math.floor(rng() * 4) + 1;
}

/**
 * Gold pouches roll 1–4 via rng. Pass a fixed number in tests/layout helpers.
 */
export function goldForLoot(itemId: ItemId, rngOrFixed: Rng | number): number {
  if (!ITEMS[itemId].grantsGold) return 0;
  if (typeof rngOrFixed === 'number') return Math.max(0, Math.floor(rngOrFixed));
  return rollPouchGold(rngOrFixed);
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

/** Shop-only reagents. Never on chest tables. Bag Use is #46. */
export function isShopOnly(itemId: ItemId): boolean {
  return itemId === 'bone-dust' || itemId === 'witchcraft-bag' || itemId === 'scroll-of-portal';
}

/** Collection Use. Bag opens the #46 ritual; secret chest opens with a rusty key; torch is in-run mine hint (#62). Gem is sell-only. */
export function isUsable(itemId: ItemId): boolean {
  return itemId === 'witchcraft-bag' || itemId === 'secret-chest' || itemId === 'torch-charm';
}

/**
 * Items that can sit on the this-run kit after a Hard/Campaign offering.
 * Unoffered bank stacks never count. Sealed chest loot is not kit.
 */
export function isRunKit(itemId: ItemId): boolean {
  return itemId === 'torch-charm';
}

export function runKitEntries(
  inv: Inventory,
): Array<{ item: ItemDef; count: number }> {
  return stackedEntries(inv).filter((row) => isRunKit(row.item.id));
}

/**
 * Preview Use. Bag and secret chest from title Collection; torch from this-run kit.
 * Gems stay sell-only. Owned count must be at least one.
 */
export function canUseFromPreview(itemId: ItemId, owned: number, inRun = false): boolean {
  if (Math.max(0, Math.floor(owned)) < 1) return false;
  if (itemId === 'witchcraft-bag' || itemId === 'secret-chest') return !inRun;
  if (itemId === 'torch-charm') return inRun;
  return false;
}

/** Title-shop unit prices. Pouches, ticket keys, heads, and the gold cup do not sell. */
const SELL_GOLD: Partial<Record<ItemId, number>> = {
  'rusty-key': 4,
  'secret-chest': 25,
  'torch-charm': 2,
  gem: 10,
  'relic-shard': 18,
  'bronze-medal': 3,
  'silver-medal': 14,
  'gold-medal': 20,
  'bone-dust': 15,
  'scroll-of-portal': 20,
};

export function sellGold(itemId: ItemId): number {
  return SELL_GOLD[itemId] ?? 0;
}

export function isSellable(itemId: ItemId): boolean {
  return sellGold(itemId) > 0;
}

/** Empty slot → 0. Otherwise clamp to 1..owned. */
export function clampSellQty(owned: number, qty: number): number {
  const have = Math.max(0, Math.floor(owned));
  if (have < 1) return 0;
  const n = Math.floor(qty);
  if (!Number.isFinite(n)) return 1;
  return Math.min(have, Math.max(1, n));
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

export function sellableEntries(
  inv: Inventory,
): Array<{ item: ItemDef; count: number; gold: number }> {
  return ITEM_IDS.filter(isSellable)
    .map((id) => ({ item: ITEMS[id], count: inv[id] ?? 0, gold: sellGold(id) }))
    .filter((row) => row.count > 0);
}

export type ShopGoodId = ItemId | SkinId;

/**
 * Title-shop buy prices. Secret chest, torch charm, and cave gem sit with the
 * reagents and paid skins. Buy banks a Collection stack; it does not open the
 * chest. Defaults stay free / always owned and are not catalog rows.
 * `buyableEntries(catalog, owned)` also drops already-owned paid skins.
 * Stackable loot stays listed after purchase (no hide-owned filter).
 */
export const SHOP_BUY: Partial<Record<ShopGoodId, number>> = {
  'secret-chest': 40,
  'torch-charm': 8,
  gem: 30,
  'bone-dust': 50,
  'witchcraft-bag': 150,
  'scroll-of-portal': 80,
  'flag-golden': 500,
  'flag-pirate': 500,
  'grid-classic': 1000,
  'grid-vintage': 1000,
};

export type ShopBuyCatalog = Partial<Record<ShopGoodId, number>>;
export type ShopMode = 'sell' | 'buy';

export interface ShopBuyRow {
  kind: 'item' | 'skin';
  item: ItemDef | SkinDef;
  gold: number;
}

export function buyGold(id: ShopGoodId, catalog: ShopBuyCatalog = SHOP_BUY): number {
  const n = catalog[id];
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function isBuyable(id: ShopGoodId, catalog: ShopBuyCatalog = SHOP_BUY): boolean {
  return buyGold(id, catalog) > 0;
}

/** Empty slot → 0. Otherwise clamp to 1..max (default 99). Skins cap at 1. */
export function clampBuyQty(qty: number, max = 99): number {
  const cap = Math.max(1, Math.floor(max));
  const n = Math.floor(qty);
  if (!Number.isFinite(n)) return 1;
  return Math.min(cap, Math.max(1, n));
}

export function buyableEntries(
  catalog: ShopBuyCatalog = SHOP_BUY,
  owned?: { ownedSkins?: readonly string[] } | null,
): ShopBuyRow[] {
  const loot = ITEM_IDS.filter((id) => isBuyable(id, catalog) && !isShopOnly(id)).map((id) => ({
    kind: 'item' as const,
    item: ITEMS[id],
    gold: buyGold(id, catalog),
  }));
  const reagents = ITEM_IDS.filter((id) => isBuyable(id, catalog) && isShopOnly(id)).map((id) => ({
    kind: 'item' as const,
    item: ITEMS[id],
    gold: buyGold(id, catalog),
  }));
  const skins = SKIN_IDS.filter(
    (id) => isBuyable(id, catalog) && !isSkinOwned(owned, id),
  ).map((id) => ({
    kind: 'skin' as const,
    item: SKINS[id],
    gold: buyGold(id, catalog),
  }));
  return [...loot, ...reagents, ...skins];
}

/** Switching Sell↔Buy drops the slotted good and qty; same-mode is a no-op. */
export function shopSelectionAfterModeChange(
  current: ShopMode,
  next: ShopMode,
  slotted: ShopGoodId | null,
  qty: number,
): { mode: ShopMode; slotted: ShopGoodId | null; qty: number } {
  if (current === next) return { mode: current, slotted, qty };
  return { mode: next, slotted: null, qty: 0 };
}
