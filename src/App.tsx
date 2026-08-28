import { useCallback, useRef, useState } from 'react';
import { playDeny, sfxFromEvents, useGameAudio } from './audio';
import {
  CAMPAIGN_FLOORS,
  ITEMS,
  chestNotices,
  isTicketKey,
  stackedEntries,
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
import MuteButton from './ui/MuteButton';
import TitleMenu from './ui/TitleMenu';
import { BagIcon, BossIcon, ChestIcon, FlagIcon, GoldIcon, ItemIcon, ShovelIcon } from './ui/icons';
import { chainDuration, prefersReducedMotion } from './ui/motion';

type Screen = 'menu' | 'play' | 'collection';
const TUTORIAL_KEY = 'crawler-mines-tutorial';

function reportFor(run: NonNullable<ReturnType<typeof useGameStore.getState>['run']>): FloorReport | null {
  if (run.game.status === 'cleared' || run.game.status === 'lost') return floorReport(run);
  return null;
}

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
  const [report, setReport] = useState<FloorReport | null>(() => (run ? reportFor(run) : null));
  const [blasts, setBlasts] = useState<BlastFx[]>([]);
  const [sparkles, setSparkles] = useState<Array<{ id: number; index: number }>>([]);
  const [shaking, setShaking] = useState(false);
  const [lootQueue, setLootQueue] = useState<LootToast[]>([]);
  const [collectionFrom, setCollectionFrom] = useState<Screen>(run ? 'play' : 'menu');
  const fxId = useRef(1);
  const toastId = useRef(1);
  const clearTimer = useRef<number | null>(null);
  const { muted, toggleMuted, playSfx } = useGameAudio(
    screen,
    run?.mode ?? null,
    collectionFrom,
    run?.floor ?? 0,
  );

  const cueUi = () => playSfx('ui');

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
    if (!ok) {
      playDeny();
      return;
    }
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
    setReport(reportFor(current));
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

  const finishIfEnded = useCallback((events: GameEvent[]) => {
    const ended = events.some((e) => e.type === 'cleared' || e.type === 'lost');
    applyFx(
      events,
      ended
        ? () => {
            const next = useGameStore.getState().run;
            if (!next) return;
            setLootQueue([]);
            setReport(floorReport(next));
          }
        : undefined,
    );
  }, [applyFx]);

  const onDig = useCallback(
    (index: number) => {
      const events = applyDig(index);
      const cur = useGameStore.getState().run;
      if (!cur || events.length === 0) return;
      for (const id of sfxFromEvents(events)) playSfx(id);
      queueChestToasts(events, cur.game.cells);
      finishIfEnded(events);
    },
    [applyDig, finishIfEnded, playSfx, queueChestToasts],
  );

  const onFlag = useCallback(
    (index: number) => {
      const cell = useGameStore.getState().run?.game.cells[index];
      if (!cell || cell.state === 'revealed') return;
      const events = applyFlag(index);
      playSfx('flag');
      for (const id of sfxFromEvents(events)) playSfx(id);
    },
    [applyFlag, playSfx],
  );

  const nextFloor = () => {
    nextFloorAction();
    const next = useGameStore.getState().run;
    clearFx();
    if (!next) {
      setScreen('menu');
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
            onBack={() => {
              cueUi();
              setScreen(collectionFrom === 'play' && run ? 'play' : 'menu');
            }}
          />
        ) : screen === 'menu' || !run ? (
          <TitleMenu
            onStart={start}
            onResume={run ? resume : undefined}
            resumeCopy={run ? resumeLabel(run) : null}
            onCollection={() => openCollection('menu')}
            gold={meta.gold}
            meta={meta}
            muted={muted}
            onToggleMute={toggleMuted}
            onUi={cueUi}
            onDeny={playDeny}
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
            muted={muted}
            onToggleMute={toggleMuted}
            onDismissToast={dismissToast}
            onDig={onDig}
            onFlag={onFlag}
            onUi={cueUi}
            onMenu={() => {
              cueUi();
              setScreen('menu');
              setBlasts([]);
              setSparkles([]);
              setLootQueue([]);
            }}
            onCollection={() => {
              cueUi();
              openCollection('play');
            }}
            onDismissTutorial={dismissTutorial}
            onNext={nextFloor}
            onRetry={retryFloor}
          />
        )}
      </div>
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
  muted,
  onToggleMute,
  onDismissToast,
  onDig,
  onFlag,
  onUi,
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
  muted: boolean;
  onToggleMute: () => void;
  onDismissToast: (id: number) => void;
  onDig: (i: number) => void;
  onFlag: (i: number) => void;
  onUi: () => void;
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
  const boss = game.boss;
  const showReplay = report && report.outcome !== 'lost' && report.outcome !== 'victory';
  const goldCopy =
    report?.outcome === 'stashed'
      ? 'Held until Gluttony falls.'
      : report?.outcome === 'victory'
        ? 'Stash dumped into your wallet.'
        : 'Pouched gold, now in your wallet.';

  return (
    <div className="shell play-shell">
      <header className="hud">
        <button type="button" className="ghost" onClick={onMenu} aria-label="Back to menu">
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
          {boss && (
            <span className="stat boss-stat" title="Gluttony lives">
              <span className="stat-label">Gluttony</span>
              <span className="stat-row">
                <BossIcon className="stat-ico" />
                {Math.max(0, boss.lives)}
              </span>
            </span>
          )}
        </div>
        <MuteButton muted={muted} onToggle={onToggleMute} />
        <button type="button" className="ghost bag-btn" onClick={onCollection} aria-label="Open collection">
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
            type="button"
            className={`toggle-btn${!flagMode ? ' on' : ''}`}
            onClick={() => {
              onUi();
              setFlagMode(false);
            }}
          >
            <ShovelIcon />
            Dig
          </button>
          <button
            type="button"
            className={`toggle-btn${flagMode ? ' on flag' : ''}`}
            onClick={() => {
              onUi();
              setFlagMode(true);
            }}
          >
            <FlagIcon />
            Flag
          </button>
        </div>
        <p className="hint">
          {boss
            ? 'Hit it with a blast. Eating a flag is not a loss.'
            : `Tap to ${flagMode ? 'flag' : 'dig'} · hold 400ms to flag`}
        </p>
      </footer>

      {tutorial && (
        <div className="overlay" onClick={onDismissTutorial} role="dialog">
          <div className="tablet" onClick={(e) => e.stopPropagation()}>
            <h2>First descent</h2>
            <p>Bombs don&apos;t kill you. They kill the loot next to them.</p>
            <p>Clear every safe tile. Blasts chain — a bomb sets off its neighbors.</p>
            <button
              type="button"
              className="stone-btn gold"
              onClick={() => {
                onUi();
                onDismissTutorial();
              }}
            >
              I understand
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="overlay" role="dialog">
          <div className="tablet">
            <h2>
              {report.outcome === 'lost'
                ? 'Campaign failed'
                : report.outcome === 'victory'
                  ? 'Gluttony defeated'
                  : report.lastFloor && mode === 'campaign'
                    ? 'Dungeon cleared'
                    : 'Floor cleared'}
            </h2>
            {report.outcome === 'lost' ? (
              <p className="muted">Gluttony kept the stash. Every coin and relic is gone.</p>
            ) : (
              <>
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
                {report.outcome === 'stashed' && (
                  <p className="muted">Loot is stashed until Gluttony falls.</p>
                )}
                {report.bonusKey && (
                  <p className="bonus-line">
                    Bonus <ItemIcon id={report.bonusKey} /> {ITEMS[report.bonusKey].name}
                  </p>
                )}
                {report.gold > 0 || salvage.length > 0 ? (
                  <ul className="loot-list report-loot">
                    {report.gold > 0 && (
                      <li className="loot-card">
                        <span className="loot-ico">
                          <GoldIcon />
                        </span>
                        <span className="loot-copy">
                          <strong>Coins</strong>
                          <em>{goldCopy}</em>
                        </span>
                        <span className="loot-count">+{report.gold}</span>
                      </li>
                    )}
                    {salvage.map(({ item, count }) => (
                      <li
                        key={item.id}
                        className={`loot-card${isTicketKey(item.id) ? ' is-ticket' : ''}${
                          report.bonusKey === item.id ? ' is-bonus' : ''
                        }`}
                      >
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
              </>
            )}
            <div className="row-btns">
              {mode === 'campaign' && report.outcome === 'stashed' ? (
                <button
                  type="button"
                  className="stone-btn gold"
                  onClick={() => {
                    onUi();
                    onNext();
                  }}
                >
                  Descend
                </button>
              ) : (
                <button
                  type="button"
                  className="stone-btn gold"
                  onClick={() => {
                    onUi();
                    onNext();
                  }}
                >
                  {mode === 'campaign' ? 'Return' : 'Menu'}
                </button>
              )}
              {showReplay && (
                <button
                  type="button"
                  className="stone-btn"
                  onClick={() => {
                    onUi();
                    onRetry();
                  }}
                >
                  Replay floor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
