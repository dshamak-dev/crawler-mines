import { useState } from 'react';
import {
  CAMPAIGN_OFFERING_COPY,
  ITEMS,
  canSocket,
  confirmCopy,
  confirmLabel,
  emptyOfferings,
  offeringCaptionParts,
  offeringPickerRows,
  quoteEntry,
  type CollectionState,
  type Difficulty,
  type ItemId,
  type OfferingSlots,
} from '../engine';
import MuteButton from './MuteButton';
import { BagIcon, GoldIcon, ItemIcon, ScalesIcon, TorchIcon } from './icons';

export default function TitleMenu({
  onStart,
  onResume,
  resumeCopy,
  onCollection,
  onShop,
  gold,
  meta,
  muted,
  onToggleMute,
  onUi,
  onDeny,
}: {
  onStart: (mode: Difficulty, offerings?: OfferingSlots) => void;
  onResume?: () => void;
  resumeCopy: string | null;
  onCollection: () => void;
  onShop: () => void;
  gold: number;
  meta: CollectionState;
  muted: boolean;
  onToggleMute: () => void;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [pending, setPending] = useState<Difficulty | null>(null);
  const [offerings, setOfferings] = useState<OfferingSlots>(emptyOfferings);
  const [pickingSlot, setPickingSlot] = useState<0 | 1 | null>(null);
  const quote = pending
    ? quoteEntry(pending, meta, pending === 'campaign' ? offerings : undefined)
    : null;

  const closeStart = () => {
    onUi();
    setStartOpen(false);
    setPending(null);
    setOfferings(emptyOfferings());
    setPickingSlot(null);
  };

  const pick = (mode: Difficulty) => {
    if (mode === 'campaign') {
      onUi();
      setOfferings(emptyOfferings());
      setPickingSlot(null);
      setPending('campaign');
      return;
    }
    const next = quoteEntry(mode, meta);
    if (next.kind === 'free') {
      onUi();
      setStartOpen(false);
      setPending(null);
      onStart(mode);
      return;
    }
    if (next.kind === 'blocked') onDeny();
    else onUi();
    setPending(mode);
  };

  const confirm = () => {
    if (!pending || !quote) return;
    if (quote.kind === 'blocked') {
      onDeny();
      return;
    }
    const mode = pending;
    const slots = mode === 'campaign' ? offerings : undefined;
    onUi();
    setPending(null);
    setStartOpen(false);
    setOfferings(emptyOfferings());
    setPickingSlot(null);
    onStart(mode, slots);
  };

  const socket = (slot: 0 | 1, id: ItemId) => {
    if (!canSocket(id, meta, offerings, slot)) {
      onDeny();
      return;
    }
    onUi();
    const next: OfferingSlots = [...offerings];
    next[slot] = id;
    setOfferings(next);
    setPickingSlot(null);
  };

  const clearSlot = (slot: 0 | 1) => {
    onUi();
    const next: OfferingSlots = [...offerings];
    next[slot] = null;
    setOfferings(next);
  };

  return (
    <div className="shell menu-shell">
      <header className="title-block">
        <TorchIcon />
        <h1>Crawler Mines</h1>
        <p className="tagline">Bombs don&apos;t kill you. They kill the loot.</p>
      </header>
      <ul className="rules-chip">
        <li>Clear every safe tile.</li>
        <li>Blasts chain into nearby bombs.</li>
        <li>Long-press to flag.</li>
      </ul>
      <nav className="menu-nav">
        <button
          type="button"
          className="stone-btn player-row"
          onClick={() => {
            onUi();
            onCollection();
          }}
        >
          <span className="player-row-main">
            <BagIcon />
            Collection
          </span>
          <span className="player-wallet">
            <GoldIcon />
            {gold}
          </span>
        </button>
        {onResume && resumeCopy && (
          <button
            type="button"
            className="stone-btn"
            onClick={() => {
              onUi();
              onResume();
            }}
          >
            Resume <span>{resumeCopy}</span>
          </button>
        )}
        <button
          type="button"
          className="stone-btn gold start-cta"
          onClick={() => {
            onUi();
            setStartOpen(true);
          }}
        >
          Start
        </button>
        <button
          type="button"
          className="stone-btn"
          onClick={() => {
            onUi();
            onShop();
          }}
        >
          <span className="player-row-main">
            <ScalesIcon />
            Shop
          </span>
        </button>
        <MuteButton variant="row" muted={muted} onToggle={onToggleMute} />
      </nav>
      {startOpen && !pending && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-title"
          onClick={closeStart}
        >
          <div className="tablet start-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 id="start-title">Start</h2>
            <div className="menu-modes">
              <ModeButton mode="easy" label="Easy" size="8x8" meta={meta} onPick={pick} />
              <ModeButton mode="medium" label="Medium" size="9x12" meta={meta} onPick={pick} />
              <ModeButton mode="hard" label="Hard" size="12x16" meta={meta} onPick={pick} />
              <ModeButton
                mode="campaign"
                label="Campaign"
                size="5 floors"
                gold
                meta={meta}
                onPick={pick}
              />
            </div>
            <button type="button" className="stone-btn" onClick={closeStart}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {quote && pending === 'hard' && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-title"
          onClick={() => setPending(null)}
        >
          <div className="tablet" onClick={(e) => e.stopPropagation()}>
            <h2 id="entry-title">
              {quote.kind === 'blocked' ? "Can't enter Hard" : 'Enter Hard?'}
            </h2>
            <p>{confirmCopy(quote)}</p>
            {quote.kind === 'blocked' ? (
              <button type="button" className="stone-btn gold" onClick={() => setPending(null)}>
                Got it
              </button>
            ) : (
              <div className="row-btns">
                <button type="button" className="stone-btn gold" onClick={confirm}>
                  {confirmLabel(quote)}
                </button>
                <button type="button" className="stone-btn" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {quote && pending === 'campaign' && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-title"
          onClick={() => {
            if (pickingSlot != null) {
              setPickingSlot(null);
              return;
            }
            setPending(null);
            setOfferings(emptyOfferings());
          }}
        >
          <div className="tablet entry-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 id="entry-title">Enter Campaign?</h2>
            <p className="entry-copy">{CAMPAIGN_OFFERING_COPY}</p>
            <div className="offering-wells">
              <OfferingWell
                itemId={offerings[0]}
                onOpen={() => {
                  onUi();
                  setPickingSlot(0);
                }}
                onClear={() => clearSlot(0)}
              />
              <OfferingWell
                itemId={offerings[1]}
                onOpen={() => {
                  onUi();
                  setPickingSlot(1);
                }}
                onClear={() => clearSlot(1)}
              />
            </div>
            <p className="offering-status" aria-live="polite">
              {offeringCaptionParts(offerings, quote).map((part, i) => (
                <span key={`${part.text}-${i}`}>
                  {i > 0 ? <span className="offering-dot"> · </span> : null}
                  <span className={part.gold ? 'is-gold' : undefined}>{part.text}</span>
                </span>
              ))}
            </p>
            <div className="row-btns">
              <button
                type="button"
                className={`stone-btn gold${quote.kind === 'blocked' ? ' is-locked' : ''}`}
                onClick={confirm}
              >
                {quote.kind === 'blocked' ? 'Spend 100 gold' : confirmLabel(quote)}
              </button>
              <button
                type="button"
                className="stone-btn"
                onClick={() => {
                  onUi();
                  setPending(null);
                  setOfferings(emptyOfferings());
                  setPickingSlot(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {pending === 'campaign' && pickingSlot != null && (
        <OfferingsPicker
          meta={meta}
          slots={offerings}
          fillingSlot={pickingSlot}
          onPick={(id) => socket(pickingSlot, id)}
          onCancel={() => {
            onUi();
            setPickingSlot(null);
          }}
          onDeny={onDeny}
        />
      )}
    </div>
  );
}

function OfferingWell({
  itemId,
  onOpen,
  onClear,
}: {
  itemId: ItemId | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  const filled = itemId != null;
  return (
    <div className="offering-well-wrap">
      <div className="offering-well-frame">
        {filled ? (
          <div className="offering-well is-filled" aria-hidden="true">
            <ItemIcon id={itemId} />
          </div>
        ) : (
          <button
            type="button"
            className="offering-well"
            onClick={onOpen}
            aria-label="Empty offering slot"
          />
        )}
        {filled ? (
          <button
            type="button"
            className="offering-clear"
            onClick={onClear}
            aria-label={`Remove ${ITEMS[itemId].name}`}
          >
            ×
          </button>
        ) : null}
      </div>
      <span className="offering-label">{filled ? ITEMS[itemId].name : '\u00a0'}</span>
    </div>
  );
}

function OfferingsPicker({
  meta,
  slots,
  fillingSlot,
  onPick,
  onCancel,
  onDeny,
}: {
  meta: CollectionState;
  slots: OfferingSlots;
  fillingSlot: 0 | 1;
  onPick: (id: ItemId) => void;
  onCancel: () => void;
  onDeny: () => void;
}) {
  const rows = offeringPickerRows(meta, slots, fillingSlot);
  return (
    <div
      className="overlay offerings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offerings-title"
      onClick={onCancel}
    >
      <div className="tablet offerings-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 id="offerings-title">Offerings</h2>
        <div className="offerings-rule" role="presentation" />
        <p>Pick one from your pack.</p>
        {rows.length === 0 ? (
          <p className="muted">Nothing to socket.</p>
        ) : (
          <ul className="offerings-list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`offering-row${row.disabled ? ' is-locked' : ''}`}
                  aria-disabled={row.disabled}
                  onClick={() => {
                    if (row.disabled) {
                      onDeny();
                      return;
                    }
                    onPick(row.id);
                  }}
                >
                  <ItemIcon id={row.id} />
                  <span className="offering-row-name">{row.name}</span>
                  <span className="offering-row-count">×{row.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="stone-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  mode,
  label,
  size,
  gold,
  meta,
  onPick,
}: {
  mode: Difficulty;
  label: string;
  size: string;
  gold?: boolean;
  meta: CollectionState;
  onPick: (mode: Difficulty) => void;
}) {
  const quote = quoteEntry(mode, meta);
  const free = quote.kind === 'free';
  const locked =
    mode === 'campaign'
      ? quote.kind === 'blocked' && (meta.items['campaign-key'] ?? 0) < 1
      : quote.kind === 'blocked';
  return (
    <button
      type="button"
      className={`stone-btn${gold ? ' gold' : ''}${locked ? ' is-locked' : ''}`}
      onClick={() => onPick(mode)}
    >
      {label}
      <span className="mode-meta">
        <span>{size}</span>
        {free ? (
          <span className="mode-ticket">free</span>
        ) : (
          <span className="mode-ticket">
            <span className="mode-price">
              <GoldIcon />
              {quote.cost}
            </span>
            {mode !== 'campaign' && quote.keyCount > 0 && quote.keyId ? (
              <span className="mode-key">
                <ItemIcon id={quote.keyId} />
                ×{quote.keyCount}
              </span>
            ) : null}
          </span>
        )}
      </span>
    </button>
  );
}
