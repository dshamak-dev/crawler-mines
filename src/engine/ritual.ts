import { BOSS_COPY, bossIdFromHead } from './boss';
import type { CollectionState, KeyStore } from './collection';
import { saveCollection } from './collection';
import { ITEMS, removeItem, type ItemId } from './loot';
import { isBossHead } from './offerings';
import { CAMPAIGN_FLOORS, type BossId, type FloorConfig } from './types';

export const RITUAL_SLOT_COUNT = 3;

export type RitualSlots = [ItemId | null, ItemId | null, ItemId | null];

export const RITUAL_REAGENT_IDS = [
  'scroll-of-portal',
  'bone-dust',
  'gluttony-head',
  'wrath-head',
  'lust-head',
] as const;

export type RitualReagentId = (typeof RITUAL_REAGENT_IDS)[number];

export const RITUAL_COPY =
  'Socket a portal scroll, bone dust, and one boss head. The bag burns on Use. No refund.';

export function emptyRitual(): RitualSlots {
  return [null, null, null];
}

export function isRitualReagent(id: unknown): id is RitualReagentId {
  return typeof id === 'string' && (RITUAL_REAGENT_IDS as readonly string[]).includes(id);
}

function ownedCount(meta: CollectionState | undefined, id: ItemId): number {
  if (!meta) return Infinity;
  return Math.max(0, Math.floor(meta.items[id] ?? 0));
}

export function normalizeRitual(
  raw: readonly (ItemId | null | undefined)[] | null | undefined,
  meta?: CollectionState,
): RitualSlots {
  const out: RitualSlots = [null, null, null];
  if (!raw) return out;
  const used: Partial<Record<ItemId, number>> = {};
  for (let i = 0; i < RITUAL_SLOT_COUNT; i++) {
    const id = raw[i];
    if (!isRitualReagent(id)) continue;
    const already = used[id] ?? 0;
    if (already >= ownedCount(meta, id)) continue;
    out[i] = id;
    used[id] = already + 1;
  }
  return out;
}

/** Valid in any order: scroll + bone dust + exactly one boss head. */
export function ritualCombo(slots: RitualSlots): { ok: boolean; bossId: BossId | null } {
  const filled = slots.filter((id): id is ItemId => id != null);
  if (filled.length !== 3) return { ok: false, bossId: null };
  const scrolls = filled.filter((id) => id === 'scroll-of-portal').length;
  const dust = filled.filter((id) => id === 'bone-dust').length;
  const heads = filled.filter(isBossHead);
  if (scrolls !== 1 || dust !== 1 || heads.length !== 1) return { ok: false, bossId: null };
  return { ok: true, bossId: bossIdFromHead(heads[0]) };
}

export function ritualLockedBossId(slots: RitualSlots): BossId | null {
  return ritualCombo(slots).bossId;
}

export function remainingRitualOwned(
  id: ItemId,
  meta: CollectionState,
  slots: RitualSlots,
  fillingSlot?: 0 | 1 | 2,
): number {
  const used = slots.filter((s, i) => s === id && i !== fillingSlot).length;
  return Math.max(0, ownedCount(meta, id) - used);
}

export interface RitualPickerRow {
  id: RitualReagentId;
  name: string;
  count: number;
  disabled: boolean;
}

export function ritualPickerRows(
  meta: CollectionState,
  slots: RitualSlots,
  fillingSlot: 0 | 1 | 2,
): RitualPickerRow[] {
  const rows: RitualPickerRow[] = [];
  for (const id of RITUAL_REAGENT_IDS) {
    const count = remainingRitualOwned(id, meta, slots, fillingSlot);
    if (count < 1) continue;
    rows.push({ id, name: ITEMS[id].name, count, disabled: false });
  }
  return rows;
}

export function canSocketRitual(
  id: ItemId,
  meta: CollectionState,
  slots: RitualSlots,
  fillingSlot: 0 | 1 | 2,
): boolean {
  if (!isRitualReagent(id)) return false;
  return ritualPickerRows(meta, slots, fillingSlot).some((row) => row.id === id && !row.disabled);
}

export function ritualCaption(slots: RitualSlots): string {
  const combo = ritualCombo(slots);
  if (combo.ok && combo.bossId) {
    return `Boss rite · ${BOSS_COPY[combo.bossId].name}`;
  }
  return 'Need scroll, dust, and one head';
}

/**
 * Consume the bag plus the three socketed reagents. Invalid combo, missing bag,
 * or short stacks return null and write nothing.
 */
export function consumeRitual(
  state: CollectionState,
  slots: RitualSlots,
  store: KeyStore,
): CollectionState | null {
  const normalized = normalizeRitual(slots, state);
  const combo = ritualCombo(normalized);
  if (!combo.ok || !combo.bossId) return null;
  if (ownedCount(state, 'witchcraft-bag') < 1) return null;
  let items = removeItem(state.items, 'witchcraft-bag', 1);
  for (const id of normalized) {
    if (!id || (items[id] ?? 0) < 1) return null;
    items = removeItem(items, id, 1);
  }
  const next: CollectionState = { ...state, items };
  saveCollection(next, store);
  return next;
}

/**
 * One-floor boss rite shares the Campaign floor-5 arena layout
 * (size, mines, 0 chests, door, boss). No per-boss mine tweaks yet.
 */
export function riteFloorConfig(): FloorConfig {
  return { ...CAMPAIGN_FLOORS[CAMPAIGN_FLOORS.length - 1] };
}
