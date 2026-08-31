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
export function rollBossId(rng: Rng, locked?: BossId | null): BossId {
  if (locked && (BOSS_IDS as readonly string[]).includes(locked)) return locked;
  const i = Math.floor(rng() * BOSS_IDS.length);
  return BOSS_IDS[Math.min(Math.max(i, 0), BOSS_IDS.length - 1)];
}

export function bossIdFromHead(id: unknown): BossId | null {
  if (id === 'wrath-head') return 'wrath';
  if (id === 'lust-head') return 'lust';
  if (id === 'gluttony-head') return 'gluttony';
  return null;
}

export const BOSS_COPY: Record<BossId, { name: string; blurb: string }> = {
  gluttony: {
    name: 'Gluttony',
    blurb:
      'Eats the closest flag. After a hit, smashes sealed chests when no flags remain. When it falls, leave through the door.',
  },
  wrath: {
    name: 'Wrath',
    blurb:
      'Hunts your last dig or flag. Smashes adjacent chests. Slams a mine when stuck. When it falls, leave through the door.',
  },
  lust: {
    name: 'Lust',
    blurb:
      'Walks to the highest open number that still has a hidden neighbor and plants a heart (never more than his remaining lives). Blast a mine next to him. Hearts stay until a blast strips them; a hit drops extras, death clears them all. When he falls, leave through the door.',
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

/** Closed (hidden or flagged) cell in the 8-ring — remaining unknown mines or stones. */
export function hasHiddenNeighbor(game: Game, index: number): boolean {
  return neighbors(game.width, game.height, index).some((n) => game.cells[n].state !== 'revealed');
}

/** Drop stale indices and append hearted cells missing from plant order. */
export function syncHeartOrder(game: Game): void {
  const prev = game.heartOrder ?? [];
  const kept: number[] = [];
  const seen = new Set<number>();
  for (const i of prev) {
    const cell = game.cells[i];
    if (!cell || !cell.hearted || seen.has(i)) continue;
    kept.push(i);
    seen.add(i);
  }
  for (let i = 0; i < game.cells.length; i++) {
    if (game.cells[i].hearted && !seen.has(i)) {
      kept.push(i);
      seen.add(i);
    }
  }
  game.heartOrder = kept;
}

function heartedCount(game: Game): number {
  syncHeartOrder(game);
  return game.heartOrder.length;
}

/** Oldest heart is free when a plant this step will recycle it. */
function skipsHeart(game: Game, index: number): boolean {
  const cell = game.cells[index];
  if (!cell?.hearted) return false;
  const lives = game.boss?.lives ?? 0;
  syncHeartOrder(game);
  if (lives > 0 && game.heartOrder.length >= lives && game.heartOrder[0] === index) {
    return false;
  }
  return true;
}

/**
 * Highest open digit that is not already hearted and still has a hidden neighbor.
 * Ties: nearest Chebyshev to Lust, then lowest index. Fully-open rings are skipped.
 * At cap, the oldest heart is treated as free (it will be recycled on plant).
 */
export function pickLustTarget(game: Game): number | null {
  const boss = game.boss;
  if (!boss) return null;
  let best: number | null = null;
  let bestDigit = 0;
  let bestDist = Infinity;
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i];
    if (!isOpenNumber(game, i) || skipsHeart(game, i) || !hasHiddenNeighbor(game, i)) continue;
    const digit = cell.adjacentMines;
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

function removeOldestHeart(game: Game): number | null {
  syncHeartOrder(game);
  const oldest = game.heartOrder.shift();
  if (oldest == null) return null;
  if (game.cells[oldest]) game.cells[oldest].hearted = false;
  return oldest;
}

function plantHeart(game: Game, index: number): GameEvent[] {
  const cell = game.cells[index];
  if (!cell) return [];
  const lives = game.boss?.lives ?? 0;
  if (lives <= 0) return [];
  syncHeartOrder(game);
  if (heartedCount(game) >= lives) removeOldestHeart(game);
  if (cell.hearted) return [];
  cell.hearted = true;
  game.heartOrder.push(index);
  return [{ type: 'boss-plant-heart', index }];
}

/** Hearts never exceed Lust's remaining lives. Death (0) clears every overlay. Oldest first. */
export function capLustHearts(game: Game): void {
  const boss = game.boss;
  if (!boss || boss.id !== 'lust') return;
  const cap = Math.max(0, boss.lives);
  if (cap === 0) {
    for (const cell of game.cells) cell.hearted = false;
    game.heartOrder = [];
    return;
  }
  syncHeartOrder(game);
  while (game.heartOrder.length > cap) removeOldestHeart(game);
}

/**
 * One 8-adjacent step toward the chosen open number. On arrival, plants a
 * heart overlay on that cell and can retarget next turn. Sits / waits when
 * no number has a remaining hidden neighbor. Never becomes a heart.
 */
function stepLust(game: Game, boss: BossState): GameEvent[] {
  const target = pickLustTarget(game);
  if (target == null) return [];
  if (boss.index === target) return plantHeart(game, target);
  const step = firstStepToward(game, boss.index, new Set([target]));
  if (step == null || step === boss.index) return [];
  boss.index = step;
  const events: GameEvent[] = [{ type: 'boss-move', index: step }];
  if (step === target) events.push(...plantHeart(game, target));
  return events;
}

/**
 * One boss action. Gluttony: flags first, then wounded chest smash.
 * Wrath: adjacent chest smash, hunt last action, else mine-slam (self-hit).
 * Lust: one walkable step toward the highest open number with a hidden neighbor;
 * plants a heart on arrival. No flag-eat, chest smash, or mine-slam.
 * A `boss-slam` event must be resolved by the game layer via explodeChain.
 */
export function stepBoss(game: Game, _afterHit = false): GameEvent[] {
  const boss = game.boss;
  if (!boss || game.status !== 'playing' || boss.lives <= 0) return [];
  if (boss.id === 'lust') return stepLust(game, boss);
  if (boss.id === 'wrath') return stepWrath(game, boss);
  return stepGluttony(game, boss);
}

/** Strip heart overlays from every cell in each blast's 8-neighborhood. */
export function stripHeartsFromBlasts(game: Game, blastIndices: readonly number[]): void {
  const stripped = new Set<number>();
  for (const index of blastIndices) {
    for (const n of neighbors(game.width, game.height, index)) {
      if (game.cells[n].hearted) {
        game.cells[n].hearted = false;
        stripped.add(n);
      }
    }
  }
  if (stripped.size === 0) return;
  syncHeartOrder(game);
  game.heartOrder = game.heartOrder.filter((i) => !stripped.has(i));
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
  if (boss.lives <= 0 && !events.some((e) => e.type === 'boss-death')) {
    events.push({ type: 'boss-death' });
  }
  if (events.length > 0) capLustHearts(game);
  return events;
}

export function clampBossLives(lives: unknown, id: BossId = 'gluttony'): number {
  const max = bossMaxLives(id);
  if (typeof lives !== 'number' || !Number.isInteger(lives)) return max;
  return Math.max(0, Math.min(max, lives));
}
