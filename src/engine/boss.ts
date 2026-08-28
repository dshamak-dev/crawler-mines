import { coords, neighbors } from './board';
import { BOSS_MAX_LIVES, type Game, type GameEvent } from './types';

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

/** Wounded after the first hit until death — may smash intact sealed chests. */
export function isWounded(boss: { lives: number }): boolean {
  return boss.lives > 0 && boss.lives < BOSS_MAX_LIVES;
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

function smashChest(game: Game, index: number): GameEvent | null {
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

/**
 * One Gluttony action: eat an adjacent flag, else (when wounded) smash or
 * step toward the nearest intact sealed chest, else step toward the nearest
 * flag on open non-bomb cells, else wait.
 */
export function stepBoss(game: Game): GameEvent[] {
  const boss = game.boss;
  if (!boss || game.status !== 'playing' || boss.lives <= 0) return [];

  const flags = flaggedCells(game);
  if (flags.length > 0) {
    const nextTo = adjacentFlags(game, boss.index, flags);
    if (nextTo.length > 0) {
      const target = pickNearest(game.width, boss.index, nextTo);
      const cell = game.cells[target];
      if (cell.state === 'flagged') cell.state = 'hidden';
      return [{ type: 'boss-eat-flag', index: target }];
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

/** Reload must finish a persisted boss turn instead of skipping it. */
export function resolvePendingBossTurn(game: Game): void {
  if (game.status !== 'playing' || !game.boss) {
    game.turn = 'player';
    return;
  }
  if (game.turn !== 'boss') return;
  stepBoss(game);
  game.turn = 'player';
}

/** Each exploding mine whose 8-neighborhood contains the boss deals 1 life. */
export function hitBossFromBlasts(game: Game, blastIndices: readonly number[]): GameEvent[] {
  const boss = game.boss;
  if (!boss || boss.lives <= 0) return [];
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

export function clampBossLives(lives: unknown): number {
  if (typeof lives !== 'number' || !Number.isInteger(lives)) return BOSS_MAX_LIVES;
  return Math.max(0, Math.min(BOSS_MAX_LIVES, lives));
}
