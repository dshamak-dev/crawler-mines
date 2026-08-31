import { useMemo, useState } from 'react';
import {
  clampSellQty,
  ITEMS,
  sellableEntries,
  sellGold,
  type CollectionState,
  type ItemId,
} from '../engine';
import { GoldIcon, ItemIcon } from './icons';

export default function Shop({
  meta,
  onBack,
  onSell,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onBack: () => void;
  onSell: (itemId: ItemId, qty: number) => boolean;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [slotted, setSlotted] = useState<ItemId | null>(null);
  const [qty, setQty] = useState(0);
  const rows = sellableEntries(meta.items);
  const owned = slotted ? Math.max(0, meta.items[slotted] ?? 0) : 0;
  const empty = !slotted || owned < 1;
  const liveQty = empty ? 0 : clampSellQty(owned, qty);
  const total = empty || !slotted ? 0 : sellGold(slotted) * liveQty;

  const caption = useMemo(() => {
    if (empty || !slotted) return 'Tap an item to sell.';
    return `${ITEMS[slotted].name} · ${owned} owned`;
  }, [empty, slotted, owned]);

  const slotItem = (id: ItemId) => {
    onUi();
    setSlotted(id);
    setQty(1);
  };

  const bump = (delta: number) => {
    if (empty) return;
    onUi();
    setQty(clampSellQty(owned, liveQty + delta));
  };

  const confirmSell = () => {
    if (empty || !slotted || liveQty < 1) {
      onDeny();
      return;
    }
    onUi();
    const ok = onSell(slotted, liveQty);
    if (!ok) {
      onDeny();
      return;
    }
    const remain = owned - liveQty;
    if (remain < 1) {
      setSlotted(null);
      setQty(0);
      return;
    }
    setQty(clampSellQty(remain, liveQty));
  };

  return (
    <div className="shell shop-shell">
      <div className="tablet shop-tablet">
        <header className="shop-head">
          <button
            type="button"
            className="ghost back-thumb"
            onClick={() => {
              onUi();
              onBack();
            }}
            aria-label="Back"
          >
            {'\u2039'}
          </button>
          <h1>Shop</h1>
          <span className="player-wallet shop-wallet" aria-label={`${meta.gold} coins in wallet`}>
            <GoldIcon />
            {meta.gold}
          </span>
        </header>

        <div className={`shop-slot${empty ? ' is-empty' : ''}`} aria-hidden={empty}>
          {!empty && slotted ? <ItemIcon id={slotted} /> : null}
        </div>
        <p className="shop-caption">{caption}</p>

        <div className="shop-qty" role="group" aria-label="Quantity">
          <button
            type="button"
            className="stone-btn shop-step"
            disabled={empty}
            onClick={() => bump(-1)}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="shop-qty-n">{liveQty}</span>
          <button
            type="button"
            className="stone-btn shop-step"
            disabled={empty}
            onClick={() => bump(1)}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        {!empty && <p className="shop-qty-label">Qty</p>}

        <button
          type="button"
          className={`stone-btn shop-sell${empty ? ' is-locked' : ' gold'}`}
          onClick={confirmSell}
          aria-disabled={empty}
        >
          {empty ? (
            'Sell for —'
          ) : (
            <>
              Sell for {total}
              <GoldIcon />
            </>
          )}
        </button>

        <div className="shop-rule" role="separator" />
        <p className="shop-stash-label">Your stash</p>
        {rows.length === 0 ? (
          <p className="shop-empty-stash">Nothing sellable yet.</p>
        ) : (
          <ul className="shop-grid">
            {rows.map(({ item, count }) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`shop-cell${slotted === item.id ? ' is-selected' : ''}`}
                  onClick={() => slotItem(item.id)}
                  aria-pressed={slotted === item.id}
                  aria-label={`${item.name}, ${count} owned`}
                >
                  <ItemIcon id={item.id} />
                  <span className="shop-cell-qty">x{count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="shop-foot">Sell only.</p>
      </div>
    </div>
  );
}
