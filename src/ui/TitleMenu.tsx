import { useState } from 'react';
import {
  confirmCopy,
  confirmLabel,
  quoteEntry,
  type CollectionState,
  type Difficulty,
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
  onStart: (mode: Difficulty) => void;
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
  const quote = pending ? quoteEntry(pending, meta) : null;

  const closeStart = () => {
    onUi();
    setStartOpen(false);
    setPending(null);
  };

  const pick = (mode: Difficulty) => {
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
    if (!pending || !quote || quote.kind === 'blocked') return;
    const mode = pending;
    onUi();
    setPending(null);
    setStartOpen(false);
    onStart(mode);
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
      {quote && pending && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-title"
          onClick={() => setPending(null)}
        >
          <div className="tablet" onClick={(e) => e.stopPropagation()}>
            <h2 id="entry-title">
              {quote.kind === 'blocked'
                ? pending === 'hard'
                  ? "Can't enter Hard"
                  : "Can't enter Campaign"
                : pending === 'hard'
                  ? 'Enter Hard?'
                  : 'Enter Campaign?'}
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
  return (
    <button
      type="button"
      className={`stone-btn${gold ? ' gold' : ''}${quote.kind === 'blocked' ? ' is-locked' : ''}`}
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
            {quote.keyCount > 0 && quote.keyId ? (
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
