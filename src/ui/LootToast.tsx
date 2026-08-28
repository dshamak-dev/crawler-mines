import { useEffect } from 'react';
import { ITEMS, type ItemId } from '../engine';
import { prefersReducedMotion } from './motion';
import { ItemIcon } from './icons';

export interface LootToast {
  id: number;
  itemId: ItemId;
  gold: number;
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
  const item = ITEMS[current.itemId];

  return (
    <div className="loot-toast-slot">
      <button
        type="button"
        className="loot-toast"
        key={current.id}
        onClick={() => onDismiss(current.id)}
        aria-label={`Looted ${item.name}. ${item.flavor}`}
      >
        <span className="loot-toast-ico">
          <ItemIcon id={current.itemId} />
        </span>
        <span className="loot-toast-copy">
          <strong>{item.name}</strong>
          <em>{item.flavor}</em>
        </span>
        {current.gold > 0 && <span className="loot-toast-gold">+{current.gold}</span>}
        {queue.length > 1 && <span className="loot-toast-more">+{queue.length - 1}</span>}
      </button>
    </div>
  );
}
