import { BOSS_COPY, bossIdFromHead } from './boss';
import type { CollectionState } from './collection';
import { ITEMS, type ItemId } from './loot';
import type { BossId } from './types';

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

export function socketedBossId(slots: OfferingSlots): BossId | null {
  for (const id of slots) {
    const boss = bossIdFromHead(id);
    if (boss) return boss;
  }
  return null;
}

export function hasSocketedCampaignKey(slots: OfferingSlots): boolean {
  return slots[0] === 'campaign-key' || slots[1] === 'campaign-key';
}

function ownedCount(meta: CollectionState | undefined, id: ItemId): number {
  if (!meta) return Infinity;
  return Math.max(0, Math.floor(meta.items[id] ?? 0));
}

/**
 * Keep at most two socketable ids. Drop a second boss head. When `meta` is
 * passed, drop ids the pack cannot cover (counting duplicates across slots).
 */
export function normalizeOfferings(
  raw: readonly (ItemId | null | undefined)[] | null | undefined,
  meta?: CollectionState,
): OfferingSlots {
  const out: OfferingSlots = [null, null];
  if (!raw) return out;
  const used: Partial<Record<ItemId, number>> = {};
  let headUsed = false;
  for (let i = 0; i < OFFERING_SLOT_COUNT; i++) {
    const id = raw[i];
    if (!isSocketable(id)) continue;
    if (isBossHead(id) && headUsed) continue;
    const already = used[id] ?? 0;
    if (already >= ownedCount(meta, id)) continue;
    out[i] = id;
    used[id] = already + 1;
    if (isBossHead(id)) headUsed = true;
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

/** Owned socketables for one empty well. Hide at 0 remaining. Grey other heads. */
export function offeringPickerRows(
  meta: CollectionState,
  slots: OfferingSlots,
  fillingSlot: 0 | 1,
): OfferingPickerRow[] {
  const other = slots[fillingSlot === 0 ? 1 : 0];
  const headLocked = isBossHead(other);
  const rows: OfferingPickerRow[] = [];
  for (const id of SOCKETABLE_IDS) {
    const count = remainingOwned(id, meta, slots, fillingSlot);
    if (count < 1) continue;
    rows.push({
      id,
      name: ITEMS[id].name,
      count,
      disabled: headLocked && isBossHead(id),
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
