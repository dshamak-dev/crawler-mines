import { saveCollection, type CollectionState, type KeyStore } from './collection';
import { removeItem, type ItemId } from './loot';
import {
  hasSocketedCampaignKey,
  normalizeOfferings,
  socketedList,
  type OfferingSlots,
} from './offerings';
import type { Difficulty } from './types';

export const HARD_COST = 30;
export const CAMPAIGN_COST = 100;

export type PaidMode = 'hard' | 'campaign';
export type EntryKind = 'free' | 'key' | 'gold' | 'blocked';

export interface EntryQuote {
  mode: Difficulty;
  kind: EntryKind;
  cost: number;
  keyId: ItemId | null;
  keyCount: number;
  gold: number;
}

export function isPaidMode(mode: Difficulty): mode is PaidMode {
  return mode === 'hard' || mode === 'campaign';
}

export function entryCost(mode: Difficulty): number {
  if (mode === 'hard') return HARD_COST;
  if (mode === 'campaign') return CAMPAIGN_COST;
  return 0;
}

export function entryKeyId(mode: Difficulty): ItemId | null {
  if (mode === 'hard') return 'hard-key';
  if (mode === 'campaign') return 'campaign-key';
  return null;
}

/**
 * Hard: a matching key wins over gold.
 * Campaign: a Campaign key only counts when socketed in `slots`. Unsocketed
 * keys stay in the pack; missing gold still blocks.
 */
export function quoteEntry(
  mode: Difficulty,
  meta: CollectionState,
  slots?: readonly (ItemId | null | undefined)[] | null,
): EntryQuote {
  const cost = entryCost(mode);
  const gold = Math.max(0, Math.floor(meta.gold));
  if (cost <= 0) {
    return { mode, kind: 'free', cost: 0, keyId: null, keyCount: 0, gold };
  }
  if (mode === 'campaign') {
    const offs = normalizeOfferings(slots, meta);
    if (hasSocketedCampaignKey(offs)) {
      const keyCount = Math.max(0, meta.items['campaign-key'] ?? 0);
      return { mode, kind: 'key', cost, keyId: 'campaign-key', keyCount, gold };
    }
    if (gold >= cost) {
      return { mode, kind: 'gold', cost, keyId: null, keyCount: 0, gold };
    }
    return { mode, kind: 'blocked', cost, keyId: null, keyCount: 0, gold };
  }
  const keyId = entryKeyId(mode);
  const keyCount = keyId ? Math.max(0, meta.items[keyId] ?? 0) : 0;
  if (keyCount > 0) {
    return { mode, kind: 'key', cost, keyId, keyCount, gold };
  }
  if (gold >= cost) {
    return { mode, kind: 'gold', cost, keyId, keyCount, gold };
  }
  return { mode, kind: 'blocked', cost, keyId, keyCount, gold };
}

export function confirmLabel(quote: EntryQuote): string {
  if (quote.kind === 'key') {
    return quote.mode === 'hard' ? 'Use Hard key' : 'Dive free';
  }
  if (quote.kind === 'gold') {
    return `Spend ${quote.cost} gold`;
  }
  return '';
}

export function confirmCopy(quote: EntryQuote): string {
  if (quote.kind === 'key') {
    return quote.mode === 'hard'
      ? 'Use Hard key · burns on enter. No refund if the floor is wrecked.'
      : 'Dive free. Socketed offerings burn on enter. Covers the whole five-floor descent. No refund.';
  }
  if (quote.kind === 'gold') {
    return quote.mode === 'hard'
      ? `Spend ${HARD_COST} gold · charged on enter. No refund if every chest is wrecked.`
      : `Spend ${CAMPAIGN_COST} gold · charged on enter. Covers the whole five-floor descent. No refund.`;
  }
  if (quote.kind === 'blocked') {
    const need = quote.mode === 'hard' ? 'a Hard key' : 'socket a Campaign key';
    return `Need ${quote.cost} gold or ${need}.`;
  }
  return '';
}

/**
 * Deduct gold and/or burn socketed campaign offerings. Call only after confirm.
 * Cancel never reaches here. Returns null when blocked (wallet and pack unchanged).
 */
export function spendEntry(
  meta: CollectionState,
  mode: Difficulty,
  store: KeyStore,
  slots?: readonly (ItemId | null | undefined)[] | null,
): CollectionState | null {
  const offs: OfferingSlots = mode === 'campaign' ? normalizeOfferings(slots, meta) : [null, null];
  const quote = quoteEntry(mode, meta, offs);
  if (quote.kind === 'blocked') return null;
  if (quote.kind === 'free') return meta;

  let items = { ...meta.items };
  if (mode === 'campaign') {
    for (const id of socketedList(offs)) {
      items = removeItem(items, id);
    }
  } else if (quote.kind === 'key' && quote.keyId) {
    items = removeItem(items, quote.keyId);
  }

  let gold = Math.max(0, Math.floor(meta.gold));
  if (quote.kind === 'gold') {
    gold = Math.max(0, gold - quote.cost);
  }

  const next: CollectionState = { ...meta, gold, items };
  saveCollection(next, store);
  return next;
}
