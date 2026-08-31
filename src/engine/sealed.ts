import type { Game } from './types';
import { CHEST_TIERS, isCollectible, isMedal, ITEM_IDS, tierForLoot, TIER_COPY, type ChestTier, type Inventory } from './loot';

export type SealedKind = 'chest' | 'gold-bag';

export interface SealedRow {
  kind: SealedKind;
  tier: ChestTier | null;
  wrecked: boolean;
  count: number;
}

function rowKey(kind: SealedKind, tier: ChestTier | null, wrecked: boolean): string {
  return `${kind}:${tier ?? 'none'}:${wrecked ? 'wreck' : 'sealed'}`;
}

function bump(map: Map<string, SealedRow>, row: Omit<SealedRow, 'count'>, n = 1): void {
  const key = rowKey(row.kind, row.tier, row.wrecked);
  const prev = map.get(key);
  if (prev) prev.count += n;
  else map.set(key, { ...row, count: n });
}

/** Floor cells: found chests by tier, smashed chests — never inner loot names. */
export function sealedRowsFromBoard(game: Game): SealedRow[] {
  const map = new Map<string, SealedRow>();
  for (const c of game.cells) {
    if (c.kind !== 'chest' || !c.tier) continue;
    if (!c.wrecked && c.state !== 'revealed') continue;
    bump(map, { kind: 'chest', tier: c.tier, wrecked: c.wrecked });
  }
  return [...map.values()];
}

/** Stashed run loot: tier shells only; gold stays a sealed bag. */
export function sealedRowsFromStash(inv: Inventory, stashGold: number): SealedRow[] {
  const map = new Map<string, SealedRow>();
  for (const id of ITEM_IDS) {
    if (!isCollectible(id) || isMedal(id)) continue;
    const n = inv[id] ?? 0;
    if (n <= 0) continue;
    bump(map, { kind: 'chest', tier: tierForLoot(id), wrecked: false }, n);
  }
  if (stashGold > 0) {
    bump(map, { kind: 'gold-bag', tier: null, wrecked: false });
  }
  return [...map.values()];
}

export function sealedRunRows(game: Game, inv: Inventory, stashGold: number): SealedRow[] {
  const map = new Map<string, SealedRow>();
  for (const row of [...sealedRowsFromBoard(game), ...sealedRowsFromStash(inv, stashGold)]) {
    bump(map, { kind: row.kind, tier: row.tier, wrecked: row.wrecked }, row.count);
  }
  return sortSealedRows([...map.values()]);
}

const TIER_ORDER = new Map(CHEST_TIERS.map((t, i) => [t, i]));

export function sortSealedRows(rows: SealedRow[]): SealedRow[] {
  return [...rows].sort((a, b) => {
    if (a.wrecked !== b.wrecked) return a.wrecked ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === 'gold-bag' ? 1 : -1;
    const ta = a.tier ? (TIER_ORDER.get(a.tier) ?? 99) : 99;
    const tb = b.tier ? (TIER_ORDER.get(b.tier) ?? 99) : 99;
    return ta - tb;
  });
}

export function sealedRowLabel(row: SealedRow): { title: string; subtitle: string } {
  if (row.kind === 'gold-bag') {
    return { title: 'Gold bag', subtitle: 'Still sealed' };
  }
  const copy = row.tier ? TIER_COPY[row.tier] : null;
  if (!copy) return { title: 'Chest', subtitle: row.wrecked ? 'Smashed' : 'Still sealed' };
  return {
    title: copy.name,
    subtitle: row.wrecked ? copy.broken : copy.found,
  };
}
