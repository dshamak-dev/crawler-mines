import { useCallback, useRef, useState } from 'react';
import {
  CAMPAIGN_FLOORS,
  chestNotices,
  confirmCopy,
  confirmLabel,
  isTicketKey,
  quoteEntry,
  stackedEntries,
  type CollectionState,
  type Difficulty,
  type GameEvent,
} from './engine';
import {
  floorReport,
  resumeLabel,
  useGameStore,
  type FloorReport,
  type Run,
} from './store/gameStore';
import Board, { collectFx, useBoardCellSize, type BlastFx } from './ui/Board';
import Collection from './ui/Collection';
import LootQueue, { type LootToast } from './ui/LootToast';
import { BagIcon, ChestIcon, FlagIcon, GoldIcon, ItemIcon, ShovelIcon, TorchIcon } from './ui/icons';
import { chainDuration, prefersReducedMotion } from './ui/motion';

type Screen = 'menu' | 'play' | 'collection';
const TUTORIAL_KEY = 'crawler-mines-tutorial';

export default function App() {
  const run = useGameStore((s) => s.run);
  const meta = useGameStore((s) => s.meta);
  const runLoot = useGameStore((s) => s.runLoot);
  const startRun = useGameStore((s) => s.start);
  const nextFloorAction = useGameStore((s) => s.nextFloor);
  const retryFloorAction = useGameStore((s) => s.retryFloor);
  const applyDig = useGameStore((s) => s.applyDig);
  const applyFlag = useGameStore((s) => s.applyFlag);

  const [screen, setScreen] = useState<Screen>(() => (run ? 'play' : 'menu'));
  const [flagMode, setFlagMode] = useState(false);
  const [tutorial, setTutorial] = useState(() => {
    if (!run) return false;
    try {
      return localStorage.getItem(TUTORIAL_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const [report, setReport] = useState<FloorReport | null>(() =>
    run?.game.status === 'cleared' ? floorReport(run) : null,
  );
  const [blasts, setBlasts] = useState<BlastFx[]>([]);
  const [sparkles, setSparkles] = useState<Array<{ id: number; index: number }>>([]);
  const [shaking, setShaking] = useState(false);
  const [lootQueue, setLootQueue] = useState<LootToast[]>([]);
  const [collectionFrom, setCollectionFrom] = useState<Screen>(run ? 'play' : 'menu');
  const fxId = useRef(1);
  const toastId = useRef(1);
  const clearTimer = useRef<number | null>(null);

  const openCollection = (from: Screen) => {
    setCollectionFrom(from);
    setScreen('collection');
  };

  const clearFx = () => {
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
    setShaking(false);
    setReport(null);
    setFlagMode(false);
  };

  const start = (mode: Difficulty) => {
    const ok = startRun(mode);
    if (!ok) return;
    clearFx();
    setScreen('play');
    try {
      setTutorial(localStorage.getItem(TUTORIAL_KEY) !== '1');
    } catch {
      setTutorial(true);
    }
  };

  const resume = () => {
    const current = useGameStore.getState().run;
    if (!current) return;
    setReport(current.game.status === 'cleared' ? floorReport(current) : null);
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
    setShaking(false);
    setScreen('play');
  };

  const dismissTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setTutorial(false);
  };

  const applyFx = useCallback((events: GameEvent[], after?: () => void) => {
    const packed = collectFx(events, fxId.current);
    fxId.current = packed.nextId;
    if (packed.blasts.length) setBlasts(packed.blasts);
    if (packed.sparkles.length) setSparkles(packed.sparkles);
    if (packed.wrecked && !prefersReducedMotion()) {
      setShaking(true);
      window.setTimeout(() => setShaking(false), 520);
    }
    const maxWave = packed.blasts.reduce((m, b) => Math.max(m, b.wave), 0);
    if (after) {
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(after, chainDuration(maxWave));
    }
  }, []);

  const queueChestToasts = useCallback((events: GameEvent[], cells: NonNullable<typeof run>['game']['cells']) => {
    const notices = chestNotices(events, cells);
    if (notices.length === 0) return;
    setLootQueue((prev) => [
      ...prev,
      ...notices.map((n) => ({
        id: toastId.current++,
        kind: n.kind,
        tier: n.tier,
      })),
    ]);
  }, []);

  const onDig = useCallback(
    (index: number) => {
      const events = applyDig(index);
      const cur = useGameStore.getState().run;
      if (!cur || events.length === 0) return;
      queueChestToasts(events, cur.game.cells);
      const cleared = events.some((e) => e.type === 'cleared');
      applyFx(
        events,
        cleared
          ? () => {
              const next = useGameStore.getState().run;
              if (!next) return;
              setLootQueue([]);
              setReport(floorReport(next));
            }
          : undefined,
      );
    },
    [applyDig, applyFx, queueChestToasts],
  );

  const onFlag = useCallback(
    (index: number) => {
      applyFlag(index);
    },
    [applyFlag],
  );

  const nextFloor = () => {
    nextFloorAction();
    const next = useGameStore.getState().run;
    clearFx();
    if (!next) {
      setScreen('menu');
      return;
    }
  };

  const retryFloor = () => {
    retryFloorAction();
    clearFx();
  };

  const dismissToast = useCallback((id: number) => {
    setLootQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="stage">
      <div className="phone">
        {screen === 'collection' ? (
          <Collection
            meta={meta}
            runLoot={runLoot}
            onBack={() => setScreen(collectionFrom === 'play' && run ? 'play' : 'menu')}
          />
        ) : screen === 'menu' || !run ? (
          <Menu
            onStart={start}
            onResume={run ? resume : undefined}
            resumeCopy={run ? resumeLabel(run) : null}
            onCollection={() => openCollection('menu')}
            gold={meta.gold}
            meta={meta}
          />
        ) : (
          <Play
            run={run}
            flagMode={flagMode}
            setFlagMode={setFlagMode}
            blasts={blasts}
            sparkles={sparkles}
            shaking={shaking}
            tutorial={tutorial}
            report={report}
            lootQueue={lootQueue}
            onDismissToast={dismissToast}
            onDig={onDig}
            onFlag={onFlag}
            onMenu={() => {
              setScreen('menu');
              setBlasts([]);
              setSparkles([]);
              setLootQueue([]);
            }}
            onCollection={() => openCollection('play')}
            onDismissTutorial={dismissTutorial}
            onNext={nextFloor}
            onRetry={retryFloor}
          />
        )}
      </div>
    </div>
  );
}

const SOUND_KEY = 'crawler-mines-sound';

function Menu({
  onStart,
  onResume,
  resumeCopy,
  onCollection,
  gold,
  meta,
}: {
  onStart: (m: Difficulty) => void;
  onResume?: () => void;
  resumeCopy: string | null;
  onCollection: () => void;
  gold: number;
  meta: CollectionState;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [pending, setPending] = useState<Difficulty | null>(null);
  const quote = pending ? quoteEntry(pending, meta) : null;

  const closeStart = () => {
    setStartOpen(false);
    setPending(null);
  };

  const pick = (mode: Difficulty) => {
    const next = quoteEntry(mode, meta);
    if (next.kind === 'free') {
      setStartOpen(false);
      setPending(null);
      onStart(mode);
      return;
    }
    setPending(mode);
  };

  const confirm = () => {
    if (!pending || !quote || quote.kind === 'blocked') return;
    const mode = pending;
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
        <button type="button" className="stone-btn player-row" onClick={onCollection}>
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
          <button type="button" className="stone-btn" onClick={onResume}>
            Resume <span>{resumeCopy}</span>
          </button>
        )}
        <button type="button" className="stone-btn gold start-cta" onClick={() => setStartOpen(true)}>
          Start
        </button>
        <SoundSlot />
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

function SoundSlot() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? '1' : '0');
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      className="stone-btn sound-slot"
      onClick={toggle}
      aria-pressed={on}
      aria-label={`Sound ${on ? 'on' : 'off'}`}
    >
      Sound
      <span>{on ? 'On' : 'Off'}</span>
    </button>
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

function Play({
  run,
  flagMode,
  setFlagMode,
  blasts,
  sparkles,
  shaking,
  tutorial,
  report,
  lootQueue,
  onDismissToast,
  onDig,
  onFlag,
  onMenu,
  onCollection,
  onDismissTutorial,
  onNext,
  onRetry,
}: {
  run: Run;
  flagMode: boolean;
  setFlagMode: (v: boolean) => void;
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  shaking: boolean;
  tutorial: boolean;
  report: FloorReport | null;
  lootQueue: LootToast[];
  onDismissToast: (id: number) => void;
  onDig: (i: number) => void;
  onFlag: (i: number) => void;
  onMenu: () => void;
  onCollection: () => void;
  onDismissTutorial: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const { game, mode, floor } = run;
  const { ref, px } = useBoardCellSize(game.width, game.height);
  const floorLabel =
    mode === 'campaign' ? `Floor ${floor + 1}/${CAMPAIGN_FLOORS.length}` : mode;
  const salvage = report ? stackedEntries(report.loot) : [];

  return (
    <div className="shell play-shell">
      <header className="hud">
        <button className="ghost" onClick={onMenu} aria-label="Back to menu">
          {'\u2039'}
        </button>
        <div className="hud-stats">
          <span className="stat found-stat" title="Intact chests found">
            <span className="stat-label">Found</span>
            <span className="stat-row">
              <ChestIcon className="stat-ico" tier="wooden" />
              {game.chestsOpened}
            </span>
          </span>
          <span className="stat wreck" title="Chests destroyed">
            <span className="stat-label">Broken</span>
            <span className="stat-row">
              <ChestIcon wrecked className="stat-ico" tier="wooden" />
              {game.chestsDestroyed}
            </span>
          </span>
        </div>
        <button className="ghost bag-btn" onClick={onCollection} aria-label="Open collection">
          <BagIcon />
        </button>
        <span className="floor-pill">{floorLabel}</span>
      </header>

      <div className="board-wrap" ref={ref}>
        <Board
          game={game}
          flagMode={flagMode}
          cellPx={px}
          blasts={blasts}
          sparkles={sparkles}
          shaking={shaking}
          onDig={onDig}
          onFlag={onFlag}
        />
      </div>

      <LootQueue queue={lootQueue} onDismiss={onDismissToast} />

      <footer className="dock">
        <div className="toggle" role="group" aria-label="Dig or flag">
          <button
            className={`toggle-btn${!flagMode ? ' on' : ''}`}
            onClick={() => setFlagMode(false)}
          >
            <ShovelIcon />
            Dig
          </button>
          <button
            className={`toggle-btn${flagMode ? ' on flag' : ''}`}
            onClick={() => setFlagMode(true)}
          >
            <FlagIcon />
            Flag
          </button>
        </div>
        <p className="hint">Tap to {flagMode ? 'flag' : 'dig'} · hold 400ms to flag</p>
      </footer>

      {tutorial && (
        <div className="overlay" onClick={onDismissTutorial} role="dialog">
          <div className="tablet" onClick={(e) => e.stopPropagation()}>
            <h2>First descent</h2>
            <p>Bombs don&apos;t kill you. They kill the loot next to them.</p>
            <p>Clear every safe tile. Blasts chain — a bomb sets off its neighbors.</p>
            <button className="stone-btn gold" onClick={onDismissTutorial}>
              I understand
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="overlay" role="dialog">
          <div className="tablet">
            <h2>{report.lastFloor && mode === 'campaign' ? 'Dungeon cleared' : 'Floor cleared'}</h2>
            <div className="tally">
              <div>
                <em>Found</em>
                <strong className="pos">{report.opened}</strong>
              </div>
              <div>
                <em>Broken</em>
                <strong className="neg">{report.wrecked}</strong>
              </div>
            </div>
            {report.gold > 0 || salvage.length > 0 ? (
              <ul className="loot-list report-loot">
                {report.gold > 0 && (
                  <li className="loot-card">
                    <span className="loot-ico">
                      <GoldIcon />
                    </span>
                    <span className="loot-copy">
                      <strong>Coins</strong>
                      <em>Pouched gold, now in your wallet.</em>
                    </span>
                    <span className="loot-count">+{report.gold}</span>
                  </li>
                )}
                {salvage.map(({ item, count }) => (
                  <li key={item.id} className={`loot-card${isTicketKey(item.id) ? ' is-ticket' : ''}`}>
                    <span className="loot-ico">
                      <ItemIcon id={item.id} />
                    </span>
                    <span className="loot-copy">
                      <strong>{item.name}</strong>
                      <em>{item.flavor}</em>
                    </span>
                    <span className="loot-count">×{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No loot survived.</p>
            )}
            <div className="row-btns">
              {mode === 'campaign' && !report.lastFloor ? (
                <button className="stone-btn gold" onClick={onNext}>
                  Descend
                </button>
              ) : (
                <button className="stone-btn gold" onClick={onNext}>
                  {mode === 'campaign' ? 'Return' : 'Menu'}
                </button>
              )}
              <button className="stone-btn" onClick={onRetry}>
                Replay floor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
