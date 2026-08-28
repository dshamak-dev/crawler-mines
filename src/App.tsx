import { useCallback, useRef, useState } from 'react';
import {
  CAMPAIGN_FLOORS,
  DIFFICULTIES,
  addItem,
  chestNotices,
  cloneGame,
  createGame,
  dig,
  emptyInventory,
  loadCollection,
  saveCollection,
  stackedEntries,
  toggleFlag,
  type Difficulty,
  type FloorConfig,
  type Game,
  type Inventory,
} from './engine';
import Board, { collectFx, useBoardCellSize, type BlastFx } from './ui/Board';
import Collection from './ui/Collection';
import LootQueue, { type LootToast } from './ui/LootToast';
import { BagIcon, ChestIcon, FlagIcon, ItemIcon, ShovelIcon, TorchIcon } from './ui/icons';
import { chainDuration, prefersReducedMotion } from './ui/motion';

type Screen = 'menu' | 'play' | 'collection';
const TUTORIAL_KEY = 'crawler-mines-tutorial';

interface Run {
  mode: Difficulty;
  floor: number;
  game: Game;
}

interface FloorReport {
  opened: number;
  wrecked: number;
  lastFloor: boolean;
  loot: Inventory;
}

function configFor(mode: Difficulty, floor: number): FloorConfig {
  if (mode === 'campaign') return CAMPAIGN_FLOORS[floor];
  return DIFFICULTIES[mode];
}

function freshRun(mode: Difficulty): Run {
  return {
    mode,
    floor: 0,
    game: createGame(configFor(mode, 0), Math.random),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [run, setRun] = useState<Run | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [report, setReport] = useState<FloorReport | null>(null);
  const [blasts, setBlasts] = useState<BlastFx[]>([]);
  const [sparkles, setSparkles] = useState<Array<{ id: number; index: number }>>([]);
  const [shaking, setShaking] = useState(false);
  const [meta, setMeta] = useState<Inventory>(() => loadCollection());
  const [runLoot, setRunLoot] = useState<Inventory>(() => emptyInventory());
  const [lootQueue, setLootQueue] = useState<LootToast[]>([]);
  const [collectionFrom, setCollectionFrom] = useState<Screen>('menu');
  const fxId = useRef(1);
  const toastId = useRef(1);
  const clearTimer = useRef<number | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const openCollection = (from: Screen) => {
    setCollectionFrom(from);
    setScreen('collection');
  };

  const start = (mode: Difficulty) => {
    setRun(freshRun(mode));
    setFlagMode(false);
    setReport(null);
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
    setRunLoot(emptyInventory());
    setShaking(false);
    setScreen('play');
    const seen = localStorage.getItem(TUTORIAL_KEY) === '1';
    setTutorial(!seen);
  };

  const dismissTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setTutorial(false);
  };

  const applyFx = useCallback((events: ReturnType<typeof dig>, after?: () => void) => {
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

  const queueChestToasts = useCallback((events: ReturnType<typeof dig>, cells: Game['cells']) => {
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

  const bankRewards = useCallback((events: ReturnType<typeof dig>) => {
    const cleared = events.find((e) => e.type === 'cleared');
    if (!cleared || cleared.type !== 'cleared' || cleared.rewards.length === 0) return;
    setMeta((prev) => {
      let next = prev;
      for (const r of cleared.rewards) next = addItem(next, r.itemId);
      saveCollection(next);
      return next;
    });
    setRunLoot((prev) => {
      let next = prev;
      for (const r of cleared.rewards) next = addItem(next, r.itemId);
      return next;
    });
  }, []);

  const mutate = useCallback(
    (fn: (g: Game) => ReturnType<typeof dig> | void) => {
      const prev = runRef.current;
      if (!prev || prev.game.status !== 'playing') return;
      const game = cloneGame(prev.game);
      const events = fn(game) ?? [];
      const next = { ...prev, game };
      runRef.current = next;
      setRun(next);
      queueChestToasts(events, game.cells);
      bankRewards(events);
      const cleared = events.some((e) => e.type === 'cleared');
      applyFx(
        events,
        cleared
          ? () => {
              const cur = runRef.current;
              if (!cur) return;
              const last =
                cur.mode !== 'campaign' ||
                cur.floor >= CAMPAIGN_FLOORS.length - 1;
              setLootQueue([]);
              setReport({
                opened: cur.game.chestsOpened,
                wrecked: cur.game.chestsDestroyed,
                lastFloor: last,
                loot: { ...cur.game.inventory },
              });
            }
          : undefined,
      );
    },
    [applyFx, bankRewards, queueChestToasts],
  );

  const onDig = useCallback(
    (index: number) => {
      mutate((g) => dig(g, index, Math.random));
    },
    [mutate],
  );

  const onFlag = useCallback(
    (index: number) => {
      mutate((g) => {
        toggleFlag(g, index);
      });
    },
    [mutate],
  );

  const nextFloor = () => {
    if (!run) return;
    if (run.mode !== 'campaign' || run.floor >= CAMPAIGN_FLOORS.length - 1) {
      setScreen('menu');
      setRun(null);
      setReport(null);
      return;
    }
    const floor = run.floor + 1;
    setRun({
      ...run,
      floor,
      game: createGame(configFor('campaign', floor), Math.random),
    });
    setReport(null);
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
    setFlagMode(false);
  };

  const retryFloor = () => {
    if (!run) return;
    setRun({
      ...run,
      game: createGame(configFor(run.mode, run.floor), Math.random),
    });
    setReport(null);
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
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
          <Menu onStart={start} onCollection={() => openCollection('menu')} />
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
              setRun(null);
              setReport(null);
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

function Menu({
  onStart,
  onCollection,
}: {
  onStart: (m: Difficulty) => void;
  onCollection: () => void;
}) {
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
        <button className="stone-btn" onClick={() => onStart('easy')}>
          Easy <span>8x8</span>
        </button>
        <button className="stone-btn" onClick={() => onStart('medium')}>
          Medium <span>9x12</span>
        </button>
        <button className="stone-btn" onClick={() => onStart('hard')}>
          Hard <span>12x16</span>
        </button>
        <button className="stone-btn gold" onClick={() => onStart('campaign')}>
          Campaign <span>5 floors</span>
        </button>
        <button className="stone-btn" onClick={onCollection}>
          Collection
          <span className="menu-bag">
            <BagIcon /> Pack
          </span>
        </button>
      </nav>
    </div>
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
            {salvage.length > 0 ? (
              <ul className="loot-list report-loot">
                {salvage.map(({ item, count }) => (
                  <li key={item.id} className="loot-card">
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

