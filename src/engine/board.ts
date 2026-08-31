import { emptyInventory, goldForLoot, rollLoot, tierForLoot, type ChestTier, type ItemId } from './loot';
import { bossMaxLives, rollBossId } from './boss';
import {
  type BossId,
  type BossState,
  type Cell,
  type Difficulty,
  type FloorConfig,
  type Game,
  type Rng,
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
    boss = { id, index, lives: bossMaxLives(id), heart: id === 'lust' };
    bossRing = new Set([index, ...neighbors(width, height, index)]);
  }
  const mineBanned = new Set([...chestIdx, ...bossRing]);
  const mineIdx = pickUnique(mines, total, mineBanned, rng);
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
    inventory: emptyInventory(),
    firstClickDone: false,
    status: 'playing',
    rewardsGranted: false,
    boss,
    turn: 'player',
    lastPlayerAction: null,
  };
}

/** Build a board from a layout for tests. `.` empty, `*` mine, `$` chest, `B` boss spawn. */
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
      } else if (ch === 'B') {
        bossIndex = cells.length;
        cells.push(newCell({ state: 'revealed' }));
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
            heart: bossId === 'lust',
          }
        : null,
    turn: 'player',
    lastPlayerAction: null,
  };
}

export function cloneGame(game: Game): Game {
  return {
    ...game,
    cells: game.cells.map((c) => ({ ...c })),
    inventory: { ...game.inventory },
    boss: game.boss ? { ...game.boss } : null,
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

export function allSafeRevealed(game: Game): boolean {
  return game.cells.every((c) => c.kind === 'mine' || c.state === 'revealed');
}

export function isWon(game: Game): boolean {
  if (game.boss) return game.boss.lives <= 0;
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
  const empties: number[] = [];
  const chestIdx: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    if (i === index || i === bossIndex) continue;
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
    cell.tier = destCell.tier;
    destCell.kind = 'mine';
    destCell.gold = 0;
    destCell.loot = null;
    destCell.tier = null;
  } else {
    cell.kind = 'empty';
    cell.gold = 0;
    cell.loot = null;
    cell.tier = null;
    destCell.kind = 'mine';
  }

  computeAdjacency(game.width, game.height, game.cells);
}
