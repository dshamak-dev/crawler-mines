import { type Cell, type FloorConfig, type Game, type Rng, newCell } from './types';

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function indexOf(width: number, x: number, y: number): number {
  return y * width + x;
}

export function coords(width: number, index: number): { x: number; y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function neighbors(width: number, height: number, index: number): number[] {
  const { x, y } = coords(width, index);
  const out: number[] = [];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(width, height, nx, ny)) out.push(indexOf(width, nx, ny));
  }
  return out;
}

export function computeAdjacency(width: number, height: number, cells: Cell[]): void {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].kind === 'mine') {
      cells[i].adjacentMines = 0;
      continue;
    }
    let n = 0;
    for (const j of neighbors(width, height, i)) {
      if (cells[j].kind === 'mine') n++;
    }
    cells[i].adjacentMines = n;
  }
}

function pickUnique(
  count: number,
  total: number,
  banned: Set<number>,
  rng: Rng,
): number[] {
  const pool: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!banned.has(i)) pool.push(i);
  }
  if (count > pool.length) {
    throw new Error(`Cannot place ${count} items among ${pool.length} free cells`);
  }
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rng() * pool.length);
    picked.push(pool[k]);
    pool.splice(k, 1);
  }
  return picked;
}

export function createGame(config: FloorConfig, rng: Rng): Game {
  const { width, height, mines, chests, chestValue } = config;
  const total = width * height;
  if (mines + chests >= total) {
    throw new Error('Not enough cells for mines and chests');
  }
  const cells: Cell[] = Array.from({ length: total }, () => newCell());
  const chestIdx = pickUnique(chests, total, new Set(), rng);
  for (const i of chestIdx) {
    cells[i].kind = 'chest';
    cells[i].gold = chestValue;
  }
  const banned = new Set(chestIdx);
  const mineIdx = pickUnique(mines, total, banned, rng);
  for (const i of mineIdx) {
    cells[i].kind = 'mine';
  }
  computeAdjacency(width, height, cells);
  return {
    width,
    height,
    mines,
    chests,
    cells,
    gold: 0,
    goldDestroyed: 0,
    chestsOpened: 0,
    chestsDestroyed: 0,
    firstClickDone: false,
    status: 'playing',
  };
}

/** Build a board from a layout for tests. `.` empty, `*` mine, `$` chest. */
export function createGameFromLayout(rows: string[], chestValue = 10): Game {
  const height = rows.length;
  const width = rows[0].length;
  const cells: Cell[] = [];
  let mines = 0;
  let chests = 0;
  for (let y = 0; y < height; y++) {
    if (rows[y].length !== width) throw new Error('ragged layout');
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      if (ch === '*') {
        cells.push(newCell({ kind: 'mine' }));
        mines++;
      } else if (ch === '$') {
        cells.push(newCell({ kind: 'chest', gold: chestValue }));
        chests++;
      } else {
        cells.push(newCell());
      }
    }
  }
  computeAdjacency(width, height, cells);
  return {
    width,
    height,
    mines,
    chests,
    cells,
    gold: 0,
    goldDestroyed: 0,
    chestsOpened: 0,
    chestsDestroyed: 0,
    firstClickDone: true,
    status: 'playing',
  };
}

export function cloneGame(game: Game): Game {
  return {
    ...game,
    cells: game.cells.map((c) => ({ ...c })),
  };
}

export function mineCount(game: Game): number {
  return game.cells.filter((c) => c.kind === 'mine').length;
}

export function chestCount(game: Game): number {
  return game.cells.filter((c) => c.kind === 'chest').length;
}

export function chestsRemaining(game: Game): number {
  return game.cells.filter(
    (c) => c.kind === 'chest' && !c.wrecked && c.state !== 'revealed',
  ).length;
}

export function isWon(game: Game): boolean {
  return game.cells.every((c) => c.kind === 'mine' || c.state === 'revealed');
}

/**
 * Guarantee the first tap is not a mine. Relocates that mine to a free empty
 * cell (prefer not a chest) and recomputes adjacency.
 */
export function ensureFirstClickSafe(game: Game, index: number, rng: Rng): void {
  const cell = game.cells[index];
  if (cell.kind !== 'mine') return;

  const empties: number[] = [];
  const chestIdx: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    if (i === index) continue;
    if (game.cells[i].kind === 'empty') empties.push(i);
    else if (game.cells[i].kind === 'chest') chestIdx.push(i);
  }
  const pool = empties.length > 0 ? empties : chestIdx;
  if (pool.length === 0) return;

  const dest = pool[Math.floor(rng() * pool.length)];
  const destCell = game.cells[dest];

  if (destCell.kind === 'chest') {
    cell.kind = 'chest';
    cell.gold = destCell.gold;
    destCell.kind = 'mine';
    destCell.gold = 0;
  } else {
    cell.kind = 'empty';
    cell.gold = 0;
    destCell.kind = 'mine';
  }

  computeAdjacency(game.width, game.height, game.cells);
}
