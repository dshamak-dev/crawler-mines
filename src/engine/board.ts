import {
  emptyInventory,
  goldForLoot,
  rollLoot,
  SECRET_CHEST_SPAWN_RATE,
  tierForLoot,
  type ChestTier,
  type ItemId,
} from './loot';
import { bossMaxLives, rollBossId } from './boss';
import {
  type BossId,
  type BossState,
  type Cell,
  type Difficulty,
  type FloorConfig,
  type Game,
  type Rng,
  isArenaFloor,
  newCell,
} from './types';

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

export function createGame(
  config: FloorConfig,
  rng: Rng,
  mode: Difficulty = 'easy',
  lockedBossId: BossId | null = null,
): Game {
  const { width, height, mines, chests } = config;
  const total = width * height;
  const bossSlots = config.bossLives && config.bossLives > 0 ? 1 : 0;
  if (mines + chests + bossSlots >= total) {
    throw new Error('Not enough cells for mines and chests');
  }
  const cells: Cell[] = Array.from({ length: total }, () => newCell());
  const chestIdx = pickUnique(chests, total, new Set(), rng);
  for (const i of chestIdx) {
    if (rng() < SECRET_CHEST_SPAWN_RATE) {
      cells[i].kind = 'chest';
      cells[i].loot = 'secret-chest';
      cells[i].lootExtra = null;
      cells[i].tier = 'secret';
      cells[i].gold = 0;
      continue;
    }
    const loot = rollLoot(rng, mode);
    cells[i].kind = 'chest';
    cells[i].loot = loot;
    cells[i].tier = tierForLoot(loot);
    cells[i].gold = goldForLoot(loot, rng);
  }
  let boss: BossState | null = null;
  let bossRing = new Set<number>();
  const lives = config.bossLives;
  if (lives && lives > 0) {
    const occupied = new Set(chestIdx);
    const spawn = pickUnique(1, total, occupied, rng);
    const index = spawn[0];
    cells[index].state = 'revealed';
    const id = rollBossId(rng, lockedBossId);
    boss = { id, index, lives: bossMaxLives(id) };
    bossRing = new Set([index, ...neighbors(width, height, index)]);
  }
  const mineBanned = new Set([...chestIdx, ...bossRing]);
  const mineIdx = pickUnique(mines, total, mineBanned, rng);
  for (const i of mineIdx) {
    cells[i].kind = 'mine';
  }
  computeAdjacency(width, height, cells);
  const arena = boss != null && chests === 0;
  const doorIndex =
    boss != null ? pickDoorIndex(width, height, cells, boss.index, rng, arena) : null;
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
    inventory: emptyInventory(),
    firstClickDone: false,
    status: 'playing',
    rewardsGranted: false,
    boss,
    turn: 'player',
    lastPlayerAction: null,
    doorIndex,
    heartOrder: [],
    torchHint: null,
  };
}

/** Build a board from a layout for tests. `.` empty, `*` mine, `$` chest, `S` secret chest, `B` boss spawn. */
export function createGameFromLayout(
  rows: string[],
  chestValue = 10,
  loot: ItemId = 'gold-pouch',
  tier?: ChestTier,
  bossId: BossId = 'gluttony',
): Game {
  const height = rows.length;
  const width = rows[0].length;
  const cells: Cell[] = [];
  let mines = 0;
  let chests = 0;
  let bossIndex = -1;
  for (let y = 0; y < height; y++) {
    if (rows[y].length !== width) throw new Error('ragged layout');
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      if (ch === '*') {
        cells.push(newCell({ kind: 'mine' }));
        mines++;
      } else if (ch === '$') {
        cells.push(
          newCell({
            kind: 'chest',
            loot,
            tier: tier ?? tierForLoot(loot),
            gold: goldForLoot(loot, chestValue),
          }),
        );
        chests++;
      } else if (ch === 'S') {
        cells.push(
          newCell({
            kind: 'chest',
            loot: 'secret-chest',
            lootExtra: null,
            tier: 'secret',
            gold: 0,
          }),
        );
        chests++;
      } else if (ch === 'B') {
        bossIndex = cells.length;
        cells.push(newCell({ state: 'revealed' }));
      } else {
        cells.push(newCell());
      }
    }
  }
  computeAdjacency(width, height, cells);
  const doorIndex =
    bossIndex >= 0 ? pickDoorIndex(width, height, cells, bossIndex) : null;
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
    inventory: emptyInventory(),
    firstClickDone: true,
    status: 'playing',
    rewardsGranted: false,
    boss:
      bossIndex >= 0
        ? {
            id: bossId,
            index: bossIndex,
            lives: bossMaxLives(bossId),
          }
        : null,
    turn: 'player',
    lastPlayerAction: null,
    doorIndex,
    heartOrder: [],
    torchHint: null,
  };
}

export function cloneGame(game: Game): Game {
  return {
    ...game,
    cells: game.cells.map((c) => ({ ...c })),
    inventory: { ...game.inventory },
    boss: game.boss ? { ...game.boss } : null,
    heartOrder: [...(game.heartOrder ?? [])],
    torchHint: game.torchHint
      ? { indices: [...game.torchHint.indices], until: game.torchHint.until }
      : null,
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

/**
 * Every non-mine is revealed. Mines may stay hidden, flagged, or torch-hinted.
 * A found secret chest still counts once it has been unearthed.
 */
export function allSafeRevealed(game: Game): boolean {
  return game.cells.every((c) => c.kind === 'mine' || c.state === 'revealed');
}

/**
 * Empty cell that is not the boss spawn. Non-arena doors must also be zeros.
 * Arena doors may sit on numbers so a neighboring blast can wreck the exit.
 */
export function isDoorCandidate(
  cells: readonly Cell[],
  index: number,
  bossIndex: number,
  arena = false,
): boolean {
  const cell = cells[index];
  if (!cell || cell.kind !== 'empty' || index === bossIndex) return false;
  return arena || cell.adjacentMines === 0;
}

/**
 * Prefer empty tiles off the boss spawn ring. Arena boards prefer a number
 * (fragile) so the door's 8-ring can actually contain a mine. Non-arena still
 * uses zeros only (never the spawn, a mine, a number, or a chest).
 */
export function pickDoorIndex(
  width: number,
  height: number,
  cells: readonly Cell[],
  bossIndex: number,
  rng?: Rng,
  arena = false,
): number | null {
  const ring = new Set([bossIndex, ...neighbors(width, height, bossIndex)]);
  const offFragile: number[] = [];
  const offSafe: number[] = [];
  const onFragile: number[] = [];
  const onSafe: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!isDoorCandidate(cells, i, bossIndex, arena)) continue;
    const on = ring.has(i);
    const fragile = cells[i].adjacentMines > 0;
    if (on) (fragile ? onFragile : onSafe).push(i);
    else (fragile ? offFragile : offSafe).push(i);
  }
  const pool = arena
    ? offFragile.length > 0
      ? offFragile
      : onFragile.length > 0
        ? onFragile
        : offSafe.length > 0
          ? offSafe
          : onSafe
    : offSafe.length > 0
      ? offSafe
      : onSafe;
  if (pool.length === 0) return null;
  if (!rng) return pool[0];
  return pool[Math.floor(rng() * pool.length)];
}

export function ensureDoorValid(game: Game, rng?: Rng): void {
  if (!game.boss) {
    game.doorIndex = null;
    return;
  }
  const bossIndex = game.boss.index;
  const arena = isArenaFloor(game);
  if (game.doorIndex != null && isDoorCandidate(game.cells, game.doorIndex, bossIndex, arena)) {
    return;
  }
  game.doorIndex = pickDoorIndex(game.width, game.height, game.cells, bossIndex, rng, arena);
}

export function isWon(game: Game): boolean {
  if (game.boss) return false;
  return allSafeRevealed(game);
}

export function isLost(game: Game): boolean {
  if (!game.boss || game.boss.lives <= 0) return false;
  return allSafeRevealed(game);
}

/**
 * Guarantee the first tap is not a mine. Relocates that mine to a free empty
 * cell (prefer not a chest) and recomputes adjacency.
 */
export function ensureFirstClickSafe(game: Game, index: number, rng: Rng): void {
  const cell = game.cells[index];
  if (cell.kind !== 'mine') return;

  const bossIndex = game.boss?.index ?? -1;
  const doorIndex = game.doorIndex ?? -1;
  const doorRing = doorIndex >= 0 ? new Set(neighbors(game.width, game.height, doorIndex)) : new Set<number>();
  const empties: number[] = [];
  const chestIdx: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    if (i === index || i === bossIndex || i === doorIndex || doorRing.has(i)) continue;
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
    cell.loot = destCell.loot;
    cell.lootExtra = destCell.lootExtra;
    cell.tier = destCell.tier;
    destCell.kind = 'mine';
    destCell.gold = 0;
    destCell.loot = null;
    destCell.lootExtra = null;
    destCell.tier = null;
  } else {
    cell.kind = 'empty';
    cell.gold = 0;
    cell.loot = null;
    cell.lootExtra = null;
    cell.tier = null;
    destCell.kind = 'mine';
  }

  computeAdjacency(game.width, game.height, game.cells);
  ensureDoorValid(game, rng);
}
