import { saveCollection, type CollectionState, type KeyStore } from './collection';
import { removeItem, type ItemId } from './loot';
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

/** Key wins over gold. Easy/Medium are always free. */
export function quoteEntry(mode: Difficulty, meta: CollectionState): EntryQuote {
  const cost = entryCost(mode);
  const keyId = entryKeyId(mode);
  const keyCount = keyId ? Math.max(0, meta.items[keyId] ?? 0) : 0;
  const gold = Math.max(0, Math.floor(meta.gold));
  if (cost <= 0) {
    return { mode, kind: 'free', cost: 0, keyId: null, keyCount: 0, gold };
  }
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
    return quote.mode === 'hard' ? 'Use Hard key' : 'Use Campaign key';
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
      : 'Use Campaign key · burns on enter. Covers the whole five-floor descent. No refund.';
  }
  if (quote.kind === 'gold') {
    return quote.mode === 'hard'
      ? `Spend ${HARD_COST} gold · charged on enter. No refund if every chest is wrecked.`
      : `Spend ${CAMPAIGN_COST} gold · charged on enter. Covers the whole five-floor descent. No refund.`;
  }
  if (quote.kind === 'blocked') {
    const need = quote.mode === 'hard' ? 'a Hard key' : 'a Campaign key';
    return `Need ${quote.cost} gold or ${need}.`;
  }
  return '';
}

/**
 * Deduct gold or consume one matching key. Call only after the player confirms.
 * Cancel never reaches here. Returns null when blocked (wallet and keys unchanged).
 */
export function spendEntry(
  meta: CollectionState,
  mode: Difficulty,
  store: KeyStore,
): CollectionState | null {
  const quote = quoteEntry(mode, meta);
  if (quote.kind === 'blocked') return null;
  if (quote.kind === 'free') return meta;
  if (quote.kind === 'key' && quote.keyId) {
    const next: CollectionState = {
      ...meta,
      items: removeItem(meta.items, quote.keyId),
    };
    saveCollection(next, store);
    return next;
  }
  if (quote.kind === 'gold') {
    const next: CollectionState = {
      ...meta,
      gold: Math.max(0, Math.floor(meta.gold) - quote.cost),
    };
    saveCollection(next, store);
    return next;
  }
  return null;
}
