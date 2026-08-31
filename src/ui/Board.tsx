import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  BOSS_COPY,
  cellVisual,
  type BossId,
  type Cell,
  type Game,
  type GameEvent,
} from '../engine';
import { BombIcon, BossIcon, ChestIcon, FlagIcon } from './icons';
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

interface BoardProps {
  game: Game;
  flagMode: boolean;
  cellPx: number;
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  shaking: boolean;
  onDig: (index: number) => void;
  onFlag: (index: number) => void;
}

export function collectFx(events: GameEvent[], id0: number): {
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  wrecked: boolean;
  nextId: number;
} {
  let id = id0;
  const blasts: BlastFx[] = [];
  const sparkles: Array<{ id: number; index: number }> = [];
  let wrecked = false;
  for (const e of events) {
    if (e.type === 'explode') {
      blasts.push({ id: id++, index: e.index, wrecked: e.wrecked, wave: e.wave });
      if (e.wrecked.length > 0) wrecked = true;
    } else if (e.type === 'chest') {
      sparkles.push({ id: id++, index: e.index });
    }
  }
  return { blasts, sparkles, wrecked, nextId: id };
}

export default function Board({
  game,
  flagMode,
  cellPx,
  blasts,
  sparkles,
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
            bossHere={game.boss != null && game.boss.index === i && game.boss.lives > 0}
            bossId={game.boss?.id ?? 'gluttony'}
            lustHeart={
              game.boss != null &&
              game.boss.id === 'lust' &&
              game.boss.heart === true &&
              game.boss.index === i &&
              game.boss.lives > 0
            }
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
  bossHere,
  bossId,
  lustHeart,
  onDig,
  onFlag,
}: {
  index: number;
  cell: Cell;
  flagMode: boolean;
  wave?: number;
  wreckWave?: number;
  reduce: boolean;
  bossHere: boolean;
  bossId: BossId;
  lustHeart: boolean;
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

  const bossName = BOSS_COPY[bossId].name;
  const label = bossHere
    ? `${lustHeart ? `${bossName} heart` : bossName}${
        visual === 'number' ? `, ${cell.adjacentMines} adjacent bombs` : ''
      }`
    : ariaFor(visual, cell.adjacentMines, cell.tier);

  return (
    <button
      type="button"
      role="gridcell"
      className={`cell vis-${visual}${wave != null ? ' pop-bomb' : ''}${
        wreckWave != null ? ' pop-wreck' : ''
      }${bossHere ? ' is-boss' : ''}${bossId === 'lust' && bossHere ? ' is-lust' : ''}${
        lustHeart ? ' is-heart' : ''
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
        <ChestIcon tier={cell.tier ?? 'wooden'} />
      ) : visual === 'wrecked' ? (
        <ChestIcon wrecked tier={cell.tier ?? 'wooden'} />
      ) : visual === 'number' && !bossHere ? (
        <span className={`rune ${NUMBER_CLASS[cell.adjacentMines]}`}>
          {cell.adjacentMines}
        </span>
      ) : visual === 'number' && bossHere ? (
        <span className={`rune ${NUMBER_CLASS[cell.adjacentMines]} boss-under`}>
          {cell.adjacentMines}
        </span>
      ) : null}
      {bossHere ? <BossIcon id={bossId} className="boss-glyph" /> : null}
    </button>
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

function ariaFor(visual: string, n: number, tier: Cell['tier']): string {
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
      return tier ? `${tier} chest` : 'Chest';
    case 'wrecked':
      return tier ? `Broken ${tier} chest` : 'Broken chest';
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
