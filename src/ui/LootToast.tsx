import { useEffect } from 'react';
import { TIER_COPY, type ChestTier } from '../engine';
import { prefersReducedMotion } from './motion';
import { ChestIcon } from './icons';

export interface LootToast {
  id: number;
  kind: 'found' | 'broken';
  tier: ChestTier;
}

export default function LootQueue({
  queue,
  onDismiss,
}: {
  queue: LootToast[];
  onDismiss: (id: number) => void;
}) {
  const current = queue[0];
  const last = queue.length === 1;

  useEffect(() => {
    if (!current) return;
    const ms = prefersReducedMotion() ? 900 : last ? 2400 : 1400;
    const t = window.setTimeout(() => onDismiss(current.id), ms);
    return () => window.clearTimeout(t);
  }, [current, last, onDismiss]);

  if (!current) return null;
  const copy = TIER_COPY[current.tier];
  const smashed = current.kind === 'broken';

  return (
    <div className="loot-toast-slot">
      <button
        type="button"
        className={`loot-toast${smashed ? ' is-broken' : ''}`}
        key={current.id}
        onClick={() => onDismiss(current.id)}
        aria-label={`${copy.name}. ${smashed ? copy.broken : copy.found}`}
      >
        <span className="loot-toast-ico">
          <ChestIcon tier={current.tier} wrecked={smashed} />
        </span>
        <span className="loot-toast-copy">
          <strong>{copy.name}</strong>
          <em>{smashed ? copy.broken : copy.found}</em>
        </span>
        {queue.length > 1 && <span className="loot-toast-more">+{queue.length - 1}</span>}
      </button>
    </div>
  );
}
