import { coords, neighbors } from './board';
import {
  BOSS_IDS,
  BOSS_MAX_LIVES,
  LUST_MAX_LIVES,
  type BossId,
  type BossState,
  type Game,
  type GameEvent,
  type Rng,
} from './types';

/** Open non-bomb: revealed empty / number / chest / wreck. Never hidden or mine. */
export function isWalkable(game: Game, index: number): boolean {
  const cell = game.cells[index];
  if (!cell || cell.kind === 'mine') return false;
  return cell.state === 'revealed';
}

export function chebyshev(width: number, a: number, b: number): number {
  const ca = coords(width, a);
  const cb = coords(width, b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y));
}

export function flaggedCells(game: Game): number[] {
  const out: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    if (game.cells[i].state === 'flagged') out.push(i);
  }
  return out;
}

/** Wounded after the first hit until death — Gluttony may smash intact sealed chests. */
export function isWounded(boss: { lives: number }): boolean {
  return boss.lives > 0 && boss.lives < BOSS_MAX_LIVES;
}

export function isBossId(value: unknown): value is BossId {
  return typeof value === 'string' && (BOSS_IDS as readonly string[]).includes(value);
}

export function bossMaxLives(id: BossId): number {
  return id === 'lust' ? LUST_MAX_LIVES : BOSS_MAX_LIVES;
}

/** Equal-weight Gluttony / Wrath / Lust roll for a fresh campaign floor-5 board. */
export function rollBossId(rng: Rng): BossId {
  const i = Math.floor(rng() * BOSS_IDS.length);
  return BOSS_IDS[Math.min(Math.max(i, 0), BOSS_IDS.length - 1)];
}

export const BOSS_COPY: Record<BossId, { name: string; blurb: string }> = {
  gluttony: {
    name: 'Gluttony',
    blurb: 'Eats the closest flag. After a hit, smashes sealed chests when no flags remain.',
  },
  wrath: {
    name: 'Wrath',
    blurb: 'Hunts your last dig or flag. Smashes adjacent chests. Slams a mine when stuck.',
  },
  lust: {
    name: 'Lust',
    blurb: 'Walks to the highest open number and becomes a heart. Tap or blast the heart.',
  },
};

export function headItemId(id: BossId): 'gluttony-head' | 'wrath-head' | 'lust-head' {
  if (id === 'wrath') return 'wrath-head';
  if (id === 'lust') return 'lust-head';
  return 'gluttony-head';
}

/** Revealed empty number tile — not a mine, chest, or zero. */
export function isOpenNumber(game: Game, index: number): boolean {
  const cell = game.cells[index];
  return Boolean(
    cell &&
      cell.state === 'revealed' &&
      cell.kind === 'empty' &&
      cell.adjacentMines >= 1,
  );
}

/** Highest open digit; ties nearest to Lust, then lowest index. */
export function pickLustTarget(game: Game): number | null {
  const boss = game.boss;
  if (!boss) return null;
  let best: number | null = null;
  let bestDigit = 0;
  let bestDist = Infinity;
  for (let i = 0; i < game.cells.length; i++) {
    if (!isOpenNumber(game, i)) continue;
    const digit = game.cells[i].adjacentMines;
    const dist = chebyshev(game.width, boss.index, i);
    if (
      best == null ||
      digit > bestDigit ||
      (digit === bestDigit && dist < bestDist) ||
      (digit === bestDigit && dist === bestDist && i < best)
    ) {
      best = i;
      bestDigit = digit;
      bestDist = dist;
    }
  }
  return best;
}

export function isLustHeart(game: Game, index: number): boolean {
  const boss = game.boss;
  return Boolean(
    boss &&
      boss.id === 'lust' &&
      boss.lives > 0 &&
      boss.heart === true &&
      boss.index === index,
  );
}

function healthyChestIndices(game: Game): number[] {
  const out: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i];
    if (cell.kind === 'chest' && !cell.wrecked) out.push(i);
  }
  return out;
}

function adjacentFlags(game: Game, index: number, flags: readonly number[]): number[] {
  return flags.filter((f) => chebyshev(game.width, index, f) === 1);
}

function adjacentHealthyChests(game: Game, index: number): number[] {
  return neighbors(game.width, game.height, index).filter((n) => {
    const cell = game.cells[n];
    return cell.kind === 'chest' && !cell.wrecked;
  });
}

function adjacentUnexplodedMines(game: Game, index: number): number[] {
  return neighbors(game.width, game.height, index).filter((n) => {
    const cell = game.cells[n];
    return cell.kind === 'mine' && !cell.exploded;
  });
}

function pickNearest(width: number, from: number, candidates: readonly number[]): number {
  let best = candidates[0];
  let bestD = chebyshev(width, from, best);
  for (let i = 1; i < candidates.length; i++) {
    const d = chebyshev(width, from, candidates[i]);
    if (d < bestD || (d === bestD && candidates[i] < best)) {
      best = candidates[i];
      bestD = d;
    }
  }
  return best;
}

/**
 * First step along an 8-direction BFS on walkable cells toward any goal.
 * Returns null if start is already a goal or no path exists.
 */
export function firstStepToward(
  game: Game,
  start: number,
  goals: ReadonlySet<number>,
): number | null {
  if (goals.size === 0 || goals.has(start)) return null;
  const prev = new Map<number, number | null>();
  const queue = [start];
  prev.set(start, null);
  let found: number | null = null;

  while (queue.length > 0) {
    const i = queue.shift()!;
    if (goals.has(i)) {
      found = i;
      break;
    }
    for (const n of neighbors(game.width, game.height, i)) {
      if (prev.has(n)) continue;
      if (!isWalkable(game, n)) continue;
      prev.set(n, i);
      queue.push(n);
    }
  }

  if (found == null) return null;
  let cur = found;
  let parent = prev.get(cur) ?? null;
  while (parent != null && parent !== start) {
    cur = parent;
    parent = prev.get(cur) ?? null;
  }
  return parent === start ? cur : null;
}

function walkableNeighborsOfFlags(game: Game, flags: readonly number[]): Set<number> {
  const goals = new Set<number>();
  for (const f of flags) {
    for (const n of neighbors(game.width, game.height, f)) {
      if (isWalkable(game, n)) goals.add(n);
    }
  }
  return goals;
}

function walkableNeighborsOfChests(game: Game, chests: readonly number[]): Set<number> {
  const goals = new Set<number>();
  for (const c of chests) {
    for (const n of neighbors(game.width, game.height, c)) {
      if (isWalkable(game, n)) goals.add(n);
    }
  }
  return goals;
}

function huntGoals(game: Game, target: number): Set<number> {
  if (isWalkable(game, target)) return new Set([target]);
  const goals = new Set<number>();
  for (const n of neighbors(game.width, game.height, target)) {
    if (isWalkable(game, n)) goals.add(n);
  }
  return goals;
}

export function smashChest(game: Game, index: number): GameEvent | null {
  const cell = game.cells[index];
  if (!cell || cell.kind !== 'chest' || cell.wrecked) return null;
  const wasFound = cell.state === 'revealed';
  cell.wrecked = true;
  cell.state = 'revealed';
  game.chestsDestroyed += 1;
  game.goldDestroyed += cell.gold;
  if (wasFound) game.chestsOpened = Math.max(0, game.chestsOpened - 1);
  const tier = cell.tier;
  return tier ? { type: 'boss-smash-chest', index, tier } : null;
}

/** One open step that increases Chebyshev distance from `awayFrom`, if possible. */
export function stepAwayFrom(game: Game, from: number, awayFrom: number): number | null {
  const currentDist = chebyshev(game.width, from, awayFrom);
  let best: number | null = null;
  let bestDist = currentDist;
  for (const n of neighbors(game.width, game.height, from)) {
    if (!isWalkable(game, n)) continue;
    const d = chebyshev(game.width, n, awayFrom);
    if (d <= currentDist) continue;
    if (d > bestDist || (d === bestDist && best != null && n < best)) {
      best = n;
      bestDist = d;
    }
  }
  return best;
}

function retreatFromFlag(game: Game, boss: BossState, flagIndex: number, steps: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const next = stepAwayFrom(game, boss.index, flagIndex);
    if (next == null) break;
    boss.index = next;
    events.push({ type: 'boss-move', index: next });
  }
  return events;
}

function stepGluttony(game: Game, boss: BossState): GameEvent[] {
  const flags = flaggedCells(game);
  if (flags.length > 0) {
    const nextTo = adjacentFlags(game, boss.index, flags);
    if (nextTo.length > 0) {
      const target = pickNearest(game.width, boss.index, nextTo);
      const cell = game.cells[target];
      if (cell.state === 'flagged') cell.state = 'hidden';
      const events: GameEvent[] = [{ type: 'boss-eat-flag', index: target }];
      events.push(...retreatFromFlag(game, boss, target, 2));
      return events;
    }

    const goals = walkableNeighborsOfFlags(game, flags);
    const step = firstStepToward(game, boss.index, goals);
    if (step == null || step === boss.index) return [];
    boss.index = step;
    return [{ type: 'boss-move', index: step }];
  }

  if (!isWounded(boss)) return [];

  const chests = healthyChestIndices(game);
  if (chests.length === 0) return [];

  const nextChest = adjacentHealthyChests(game, boss.index);
  if (nextChest.length > 0) {
    const target = pickNearest(game.width, boss.index, nextChest);
    const smashed = smashChest(game, target);
    return smashed ? [smashed] : [];
  }

  const goals = walkableNeighborsOfChests(game, chests);
  const step = firstStepToward(game, boss.index, goals);
  if (step == null || step === boss.index) return [];
  boss.index = step;
  return [{ type: 'boss-move', index: step }];
}

function stepWrath(game: Game, boss: BossState): GameEvent[] {
  const nextChest = adjacentHealthyChests(game, boss.index);
  if (nextChest.length > 0) {
    const target = pickNearest(game.width, boss.index, nextChest);
    const smashed = smashChest(game, target);
    return smashed ? [smashed] : [];
  }

  const last = game.lastPlayerAction;
  if (last == null || last < 0 || last >= game.cells.length) return [];

  const goals = huntGoals(game, last);
  if (goals.has(boss.index)) return [];

  const step = firstStepToward(game, boss.index, goals);
  if (step != null && step !== boss.index) {
    boss.index = step;
    return [{ type: 'boss-move', index: step }];
  }

  const mines = adjacentUnexplodedMines(game, boss.index);
  if (mines.length === 0) return [];

  const target = pickNearest(game.width, boss.index, mines);
  return [{ type: 'boss-slam', index: target }];
}

/**
 * One 8-adjacent step toward the highest open number. Occupies as a heart
 * on arrival or when no number is open yet. `afterHit` skips re-occupying
 * the tile Lust was just chipped off of.
 */
function stepLust(game: Game, boss: BossState, afterHit: boolean): GameEvent[] {
  const target = pickLustTarget(game);
  if (target == null) {
    boss.heart = true;
    return [];
  }
  if (boss.index === target) {
    if (!afterHit) boss.heart = true;
    return [];
  }
  const step = firstStepToward(game, boss.index, new Set([target]));
  if (step == null || step === boss.index) return [];
  boss.index = step;
  boss.heart = step === target;
  return [{ type: 'boss-move', index: step }];
}

/**
 * One boss action. Gluttony: flags first, then wounded chest smash.
 * Wrath: adjacent chest smash, hunt last action, else mine-slam (self-hit).
 * Lust: one walkable step toward the highest open number; sits as a heart if none.
 * A `boss-slam` event must be resolved by the game layer via explodeChain.
 */
export function stepBoss(game: Game, afterHit = false): GameEvent[] {
  const boss = game.boss;
  if (!boss || game.status !== 'playing' || boss.lives <= 0) return [];
  if (boss.id === 'lust') return stepLust(game, boss, afterHit);
  if (boss.id === 'wrath') return stepWrath(game, boss);
  return stepGluttony(game, boss);
}

export function chipLustHeart(game: Game): GameEvent[] {
  const boss = game.boss;
  if (!boss || boss.id !== 'lust' || boss.lives <= 0 || boss.heart !== true) return [];
  boss.lives -= 1;
  boss.heart = false;
  return [{ type: 'boss-hit', lives: boss.lives }];
}

/** Each exploding mine whose 8-neighborhood contains the boss deals 1 life. */
export function hitBossFromBlasts(game: Game, blastIndices: readonly number[]): GameEvent[] {
  const boss = game.boss;
  if (!boss || boss.lives <= 0) return [];
  if (boss.id === 'lust') {
    if (boss.heart !== true) return [];
    const around = new Set(neighbors(game.width, game.height, boss.index));
    for (const index of blastIndices) {
      if (around.has(index)) return chipLustHeart(game);
    }
    return [];
  }
  const events: GameEvent[] = [];
  const around = new Set(neighbors(game.width, game.height, boss.index));
  for (const index of blastIndices) {
    if (boss.lives <= 0) break;
    if (!around.has(index)) continue;
    boss.lives -= 1;
    events.push({ type: 'boss-hit', lives: boss.lives });
  }
  return events;
}

export function clampBossLives(lives: unknown, id: BossId = 'gluttony'): number {
  const max = bossMaxLives(id);
  if (typeof lives !== 'number' || !Number.isInteger(lives)) return max;
  return Math.max(0, Math.min(max, lives));
}
