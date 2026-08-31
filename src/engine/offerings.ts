import { BOSS_COPY, bossIdFromHead } from './boss';
import type { CollectionState } from './collection';
import { ITEMS, type ItemId } from './loot';
import { BOSS_IDS, type BossId, type Rng } from './types';

export type OfferingQuote = { kind: string; cost: number };

export const SOCKETABLE_IDS = [
  'torch-charm',
  'gem',
  'relic-shard',
  'gluttony-head',
  'wrath-head',
  'lust-head',
  'campaign-key',
] as const;

export type SocketableId = (typeof SOCKETABLE_IDS)[number];

export const OFFERING_SLOT_COUNT = 2;

export type OfferingSlots = [ItemId | null, ItemId | null];

export const CAMPAIGN_OFFERING_COPY =
  'Socket up to two offerings. A key here is a free dive. A boss head locks the finale.';

const HEAD_IDS = ['gluttony-head', 'wrath-head', 'lust-head'] as const;

export function emptyOfferings(): OfferingSlots {
  return [null, null];
}

export function isSocketable(id: unknown): id is SocketableId {
  return typeof id === 'string' && (SOCKETABLE_IDS as readonly string[]).includes(id);
}

export function isBossHead(id: ItemId | null | undefined): id is (typeof HEAD_IDS)[number] {
  return id === 'gluttony-head' || id === 'wrath-head' || id === 'lust-head';
}

/** Boss ids implied by socketed heads, in slot order (duplicates kept). */
export function socketedHeadBosses(slots: OfferingSlots): BossId[] {
  const out: BossId[] = [];
  for (const id of slots) {
    const boss = bossIdFromHead(id);
    if (boss) out.push(boss);
  }
  return out;
}

/**
 * Floor-5 pool implied by socketed heads.
 * 0 heads → full roster (equal roll later).
 * 1 head → that sin only (lock).
 * 2 heads → roster minus every unique socketed sin (two Lust → Gluttony/Wrath).
 */
export function remainingFinaleBosses(slots: OfferingSlots): BossId[] {
  const heads = socketedHeadBosses(slots);
  if (heads.length === 0) return [...BOSS_IDS];
  if (heads.length === 1) return [heads[0]];
  const excluded = new Set(heads);
  return BOSS_IDS.filter((id) => !excluded.has(id));
}

/** Uniquely determined remaining boss for captions; null if the pool is not size 1. */
export function socketedBossId(slots: OfferingSlots): BossId | null {
  const pool = remainingFinaleBosses(slots);
  return pool.length === 1 ? pool[0] : null;
}

/**
 * Resolve floor-5 id at campaign enter so resume/retry/finale stay consistent.
 * Zero heads → null (roll when floor 5 starts). One head or two different
 * heads → deterministic. Two of the same head → uniform among the other two.
 */
export function resolveLockedBossId(slots: OfferingSlots, rng: Rng): BossId | null {
  const heads = socketedHeadBosses(slots);
  if (heads.length === 0) return null;
  const pool = remainingFinaleBosses(slots);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const i = Math.floor(rng() * pool.length);
  return pool[Math.min(Math.max(i, 0), pool.length - 1)];
}

export function hasSocketedCampaignKey(slots: OfferingSlots): boolean {
  return slots[0] === 'campaign-key' || slots[1] === 'campaign-key';
}

function ownedCount(meta: CollectionState | undefined, id: ItemId): number {
  if (!meta) return Infinity;
  return Math.max(0, Math.floor(meta.items[id] ?? 0));
}

/**
 * Keep at most two socketable ids. Two heads (same or different) are allowed.
 * When `meta` is passed, drop ids the pack cannot cover (counting duplicates
 * across slots).
 */
export function normalizeOfferings(
  raw: readonly (ItemId | null | undefined)[] | null | undefined,
  meta?: CollectionState,
): OfferingSlots {
  const out: OfferingSlots = [null, null];
  if (!raw) return out;
  const used: Partial<Record<ItemId, number>> = {};
  for (let i = 0; i < OFFERING_SLOT_COUNT; i++) {
    const id = raw[i];
    if (!isSocketable(id)) continue;
    const already = used[id] ?? 0;
    if (already >= ownedCount(meta, id)) continue;
    out[i] = id;
    used[id] = already + 1;
  }
  return out;
}

export function socketedList(slots: OfferingSlots): ItemId[] {
  return slots.filter((id): id is ItemId => id != null);
}

export function remainingOwned(
  id: ItemId,
  meta: CollectionState,
  slots: OfferingSlots,
  fillingSlot?: 0 | 1,
): number {
  const used = slots.filter((s, i) => s === id && i !== fillingSlot).length;
  return Math.max(0, ownedCount(meta, id) - used);
}

export interface OfferingPickerRow {
  id: SocketableId;
  name: string;
  count: number;
  disabled: boolean;
}

/** Owned socketables for one empty well. Hide at 0 remaining. Heads stay enabled. */
export function offeringPickerRows(
  meta: CollectionState,
  slots: OfferingSlots,
  fillingSlot: 0 | 1,
): OfferingPickerRow[] {
  const rows: OfferingPickerRow[] = [];
  for (const id of SOCKETABLE_IDS) {
    const count = remainingOwned(id, meta, slots, fillingSlot);
    if (count < 1) continue;
    rows.push({
      id,
      name: ITEMS[id].name,
      count,
      disabled: false,
    });
  }
  return rows;
}

export function canSocket(
  id: ItemId,
  meta: CollectionState,
  slots: OfferingSlots,
  fillingSlot: 0 | 1,
): boolean {
  if (!isSocketable(id)) return false;
  const row = offeringPickerRows(meta, slots, fillingSlot).find((r) => r.id === id);
  return Boolean(row && !row.disabled);
}

export function offeringCaption(slots: OfferingSlots, quote: OfferingQuote): string {
  return offeringCaptionParts(slots, quote)
    .map((p) => p.text)
    .join(' · ');
}

export function offeringCaptionParts(
  slots: OfferingSlots,
  quote: OfferingQuote,
): Array<{ text: string; gold: boolean }> {
  const parts: Array<{ text: string; gold: boolean }> = [{ text: 'Floor 5', gold: false }];
  const boss = socketedBossId(slots);
  if (boss) parts.push({ text: BOSS_COPY[boss].name, gold: true });
  if (quote.kind === 'key') {
    parts.push({ text: 'Dive free', gold: true });
  } else {
    parts.push({ text: `${quote.cost} gold`, gold: quote.kind !== 'blocked' });
  }
  return parts;
}
