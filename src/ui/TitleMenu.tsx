import { useState } from 'react';
import type { Difficulty } from '../engine';
import MuteButton from './MuteButton';
import { BagIcon, GoldIcon, TorchIcon } from './icons';

const MODES: ReadonlyArray<{ id: Difficulty; label: string; hint: string; gold?: boolean }> = [
  { id: 'easy', label: 'Easy', hint: '8x8' },
  { id: 'medium', label: 'Medium', hint: '9x12' },
  { id: 'hard', label: 'Hard', hint: '12x16' },
  { id: 'campaign', label: 'Campaign', hint: '5 floors', gold: true },
];

export default function TitleMenu({
  onStart,
  onResume,
  resumeCopy,
  onCollection,
  gold,
  muted,
  onToggleMute,
  onUi,
}: {
  onStart: (mode: Difficulty) => void;
  onResume?: () => void;
  resumeCopy: string | null;
  onCollection: () => void;
  gold: number;
  muted: boolean;
  onToggleMute: () => void;
  onUi: () => void;
}) {
  const [picking, setPicking] = useState(false);

  const pick = (mode: Difficulty) => {
    onUi();
    setPicking(false);
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
        <button
          type="button"
          className="stone-btn gold start-btn"
          onClick={() => {
            onUi();
            setPicking(true);
          }}
        >
          Start
        </button>
        <MuteButton variant="row" muted={muted} onToggle={onToggleMute} />
      </nav>

      {picking && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-sheet-title"
          onClick={() => {
            onUi();
            setPicking(false);
          }}
        >
          <div
            className="tablet start-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="start-sheet-title">Choose a descent</h2>
            <p>Easy, Medium, and Hard are a single floor. Campaign is five.</p>
            {onResume && resumeCopy && (
              <button
                type="button"
                className="stone-btn gold"
                onClick={() => {
                  onUi();
                  setPicking(false);
                  onResume();
                }}
              >
                Resume <span>{resumeCopy}</span>
              </button>
            )}
            <div className="menu-modes">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`stone-btn${mode.gold ? ' gold' : ''}`}
                  onClick={() => pick(mode.id)}
                >
                  {mode.label} <span>{mode.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="stone-btn"
              onClick={() => {
                onUi();
                setPicking(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
