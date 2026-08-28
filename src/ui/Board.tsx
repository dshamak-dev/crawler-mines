import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  cellVisual,
  type Cell,
  type Game,
  type GameEvent,
  type ItemId,
} from '../engine';
import { BombIcon, ChestIcon, FlagIcon, ItemIcon } from './icons';
import { BLAST_STAGGER_MS, prefersReducedMotion } from './motion';

const LONG_MS = 400;
const NUMBER_CLASS = [
  '',
  'n1',
  'n2',
  'n3',
  'n4',
  'n5',
  'n6',
  'n7',
  'n8',
];

export interface BlastFx {
  id: number;
  index: number;
  wrecked: number[];
  wave: number;
}

export interface LostFx {
  id: number;
  index: number;
  itemId: ItemId;
  wave: number;
}

interface BoardProps {
  game: Game;
  flagMode: boolean;
  cellPx: number;
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  lostLoot: LostFx[];
  shaking: boolean;
  onDig: (index: number) => void;
  onFlag: (index: number) => void;
}

export function collectFx(events: GameEvent[], cells: Cell[], id0: number): {
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  lostLoot: LostFx[];
  wrecked: boolean;
  nextId: number;
} {
  let id = id0;
  const blasts: BlastFx[] = [];
  const sparkles: Array<{ id: number; index: number }> = [];
  const lostLoot: LostFx[] = [];
  let wrecked = false;
  for (const e of events) {
    if (e.type === 'explode') {
      blasts.push({ id: id++, index: e.index, wrecked: e.wrecked, wave: e.wave });
      if (e.wrecked.length > 0) wrecked = true;
      for (const w of e.wrecked) {
        const loot = cells[w]?.loot;
        if (loot) lostLoot.push({ id: id++, index: w, itemId: loot, wave: e.wave });
      }
    } else if (e.type === 'chest') {
      sparkles.push({ id: id++, index: e.index });
    }
  }
  return { blasts, sparkles, lostLoot, wrecked, nextId: id };
}

export default function Board({
  game,
  flagMode,
  cellPx,
  blasts,
  sparkles,
  lostLoot,
  shaking,
  onDig,
  onFlag,
}: BoardProps) {
  const reduce = prefersReducedMotion();
  const waveOf = new Map<number, number>();
  const wreckWave = new Map<number, number>();
  for (const b of blasts) {
    waveOf.set(b.index, b.wave);
    for (const w of b.wrecked) wreckWave.set(w, b.wave);
  }

  return (
    <div
      className={`board-stage${shaking && !reduce ? ' is-shaking' : ''}`}
      style={
        {
          '--cols': game.width,
          '--rows': game.height,
          '--cell': `${cellPx}px`,
        } as CSSProperties
      }
    >
      <div
        className="board"
        role="grid"
        aria-label="Dungeon floor"
        onContextMenu={(e) => e.preventDefault()}
      >
        {game.cells.map((cell, i) => (
          <DungeonCell
            key={i}
            index={i}
            cell={cell}
            flagMode={flagMode}
            wave={waveOf.get(i)}
            wreckWave={wreckWave.get(i)}
            reduce={reduce}
            onDig={onDig}
            onFlag={onFlag}
          />
        ))}
      </div>
      <div className="fx-layer" aria-hidden="true">
        {blasts.map((b) => (
          <Burst
            key={b.id}
            index={b.index}
            width={game.width}
            cellPx={cellPx}
            delay={reduce ? 0 : b.wave * BLAST_STAGGER_MS}
            kind="bomb"
          />
        ))}
        {sparkles.map((s) => (
          <Burst
            key={s.id}
            index={s.index}
            width={game.width}
            cellPx={cellPx}
            delay={0}
            kind="gold"
          />
        ))}
        {lostLoot.map((lost) => (
          <LostFlash
            key={lost.id}
            index={lost.index}
            itemId={lost.itemId}
            width={game.width}
            cellPx={cellPx}
            delay={reduce ? 0 : lost.wave * BLAST_STAGGER_MS}
          />
        ))}
      </div>
    </div>
  );
}

function DungeonCell({
  index,
  cell,
  flagMode,
  wave,
  wreckWave,
  reduce,
  onDig,
  onFlag,
}: {
  index: number;
  cell: Cell;
  flagMode: boolean;
  wave?: number;
  wreckWave?: number;
  reduce: boolean;
  onDig: (i: number) => void;
  onFlag: (i: number) => void;
}) {
  const visual = cellVisual(cell);
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const longFired = useRef(false);

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button === 2) {
        e.preventDefault();
        onFlag(index);
        return;
      }
      longFired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      timer.current = window.setTimeout(() => {
        longFired.current = true;
        onFlag(index);
        if (navigator.vibrate) navigator.vibrate(10);
      }, LONG_MS);
    },
    [index, onFlag],
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 14) {
      clearTimer();
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const wasLong = longFired.current;
    clearTimer();
    if (wasLong) return;
    if (flagMode) onFlag(index);
    else onDig(index);
  }, [flagMode, index, onDig, onFlag]);

  useEffect(() => () => clearTimer(), []);

  const delay =
    reduce
      ? 0
      : visual === 'exploded' && wave != null
        ? wave * BLAST_STAGGER_MS
        : visual === 'wrecked' && wreckWave != null
          ? wreckWave * BLAST_STAGGER_MS
          : 0;

  const label = ariaFor(visual, cell.adjacentMines);

  return (
    <button
      type="button"
      role="gridcell"
      className={`cell vis-${visual}${wave != null ? ' pop-bomb' : ''}${
        wreckWave != null ? ' pop-wreck' : ''
      }`}
      style={{ '--delay': `${delay}ms` } as CSSProperties}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visual === 'flagged' || visual === 'bomb-flagged' ? (
        <FlagIcon ember={visual === 'bomb-flagged'} />
      ) : visual === 'exploded' ? (
        <BombIcon cracked />
      ) : visual === 'chest' ? (
        <ChestIcon />
      ) : visual === 'wrecked' ? (
        <ChestIcon wrecked />
      ) : visual === 'number' ? (
        <span className={`rune ${NUMBER_CLASS[cell.adjacentMines]}`}>
          {cell.adjacentMines}
        </span>
      ) : null}
    </button>
  );
}

function LostFlash({
  index,
  itemId,
  width,
  cellPx,
  delay,
}: {
  index: number;
  itemId: ItemId;
  width: number;
  cellPx: number;
  delay: number;
}) {
  const gap = 3;
  const col = index % width;
  const row = Math.floor(index / width);
  const x = col * (cellPx + gap) + cellPx / 2;
  const y = row * (cellPx + gap) + cellPx / 2;
  return (
    <span
      className="lost-flash"
      style={{ left: x, top: y, animationDelay: `${delay}ms` }}
    >
      <ItemIcon id={itemId} />
    </span>
  );
}

function Burst({
  index,
  width,
  cellPx,
  delay,
  kind,
}: {
  index: number;
  width: number;
  cellPx: number;
  delay: number;
  kind: 'bomb' | 'gold';
}) {
  const gap = 3;
  const col = index % width;
  const row = Math.floor(index / width);
  const x = col * (cellPx + gap) + cellPx / 2;
  const y = row * (cellPx + gap) + cellPx / 2;
  return (
    <span
      className={`burst burst-${kind}`}
      style={{ left: x, top: y, animationDelay: `${delay}ms` }}
    />
  );
}

function ariaFor(visual: string, n: number): string {
  switch (visual) {
    case 'hidden':
      return 'Hidden stone';
    case 'flagged':
    case 'bomb-flagged':
      return 'Flagged';
    case 'empty':
      return 'Clear floor';
    case 'number':
      return `${n} adjacent bombs`;
    case 'chest':
      return 'Treasure';
    case 'wrecked':
      return 'Broken chest';
    case 'exploded':
      return 'Detonated bomb';
    default:
      return 'Cell';
  }
}

export function useBoardCellSize(cols: number, rows: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(40);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const gap = 3;
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Fit the wrap: 8x8 is width-limited on a tall phone (cells stay square).
      // No 52px cap — use the full content width. Floor at 26 so 12x16 still fits;
      // 8x8 lands well above a 36px tap target once padding is tight.
      const cs = Math.floor(
        Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows),
      );
      setPx(Math.max(26, cs));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  return { ref, px };
}
