import { allSafeRevealed, ensureFirstClickSafe, isWon, neighbors } from './board';
import { hitBossFromBlasts, stepBoss, stripHeartsFromBlasts } from './boss';
import { addItem, type ChestTier, type ItemId } from './loot';
import type { Cell, ChestReward, Difficulty, Game, GameEvent, Rng } from './types';

/** Easy/Medium/Hard medals. Campaign never awards one. */
export function medalForMode(mode: Difficulty): ItemId | null {
  if (mode === 'easy') return 'bronze-medal';
  if (mode === 'medium') return 'silver-medal';
  if (mode === 'hard') return 'gold-medal';
  return null;
}

/**
 * Perfect clear: no cell exploded, no flag on a safe cell, and flags match mines.
 * Zero flags is not perfect unless the floor already auto-won with exactly one
 * leftover unflagged mine (treated as flagged) and every other mine is flagged.
 * Two or more leftover mines do not count. Wrecked chests do not fail this.
 */
export function isPerfectClear(game: Game): boolean {
  let mines = 0;
  let flaggedMines = 0;
  let flaggedSafe = 0;
  for (const cell of game.cells) {
    if (cell.exploded) return false;
    if (cell.kind === 'mine') {
      mines += 1;
      if (cell.state === 'flagged') flaggedMines += 1;
    } else if (cell.state === 'flagged') {
      flaggedSafe += 1;
    }
  }
  if (flaggedSafe !== 0 || mines === 0) return false;
  if (flaggedMines === mines) return true;
  return mines - flaggedMines === 1 && allSafeRevealed(game);
}

/**
 * Detonate a mine and BFS-chain into every 8-adjacent mine (flagged or hidden).
 * Each blast wrecks un-awarded loot in its own neighborhood, including chests
 * that were already found — inner items are not safe until the floor is cleared.
 * Already-exploded bombs never re-enter the queue.
 */
export function explodeChain(game: Game, startIndex: number): GameEvent[] {
  const events: GameEvent[] = [];
  const start = game.cells[startIndex];
  if (!start || start.kind !== 'mine' || start.exploded) return events;

  const queue: Array<{ index: number; wave: number }> = [{ index: startIndex, wave: 0 }];
  const queued = new Set<number>([startIndex]);

  while (queue.length > 0) {
    const { index, wave } = queue.shift()!;
    const cell = game.cells[index];
    if (cell.kind !== 'mine' || cell.exploded) continue;

    cell.exploded = true;
    cell.state = 'revealed';

    const wrecked: number[] = [];
    for (const n of neighbors(game.width, game.height, index)) {
      const nb = game.cells[n];
      if (nb.kind === 'chest' && !nb.wrecked) {
        const wasFound = nb.state === 'revealed';
        nb.wrecked = true;
        nb.state = 'revealed';
        game.chestsDestroyed += 1;
        game.goldDestroyed += nb.gold;
        if (wasFound) game.chestsOpened = Math.max(0, game.chestsOpened - 1);
        wrecked.push(n);
      } else if (nb.kind === 'mine' && !nb.exploded && !queued.has(n)) {
        queued.add(n);
        queue.push({ index: n, wave: wave + 1 });
      }
    }

    events.push({ type: 'explode', index, wrecked, wave });
  }

  const blasts = events.filter((e) => e.type === 'explode').map((e) => e.index);
  stripHeartsFromBlasts(game, blasts);
  events.push(...hitBossFromBlasts(game, blasts));
  return events;
}

export function toggleFlag(game: Game, index: number): boolean {
  if (game.status !== 'playing') return false;
  const cell = game.cells[index];
  if (!cell || cell.state === 'revealed') return false;
  cell.state = cell.state === 'flagged' ? 'hidden' : 'flagged';
  return true;
}

function resolveBossSlam(game: Game, mineIndex: number): GameEvent[] {
  const boss = game.boss;
  if (!boss || boss.lives <= 0) return [];
  const before = boss.lives;
  const events = explodeChain(game, mineIndex);
  // Slam always costs Wrath 1 life even if blast neighborhood math misses.
  if (boss.lives === before && boss.lives > 0) {
    boss.lives -= 1;
    events.push({ type: 'boss-hit', lives: boss.lives });
  }
  return events;
}

function finishBossTurn(game: Game, bossEvents: GameEvent[], _mode?: Difficulty): GameEvent[] {
  const events: GameEvent[] = [];
  for (const e of bossEvents) {
    if (e.type === 'boss-slam') {
      events.push(...resolveBossSlam(game, e.index));
    } else {
      events.push(e);
    }
  }
  if (game.boss && game.boss.lives <= 0) {
    game.turn = 'player';
    if (!events.some((e) => e.type === 'boss-death')) events.push({ type: 'boss-death' });
    return events;
  }
  if (allSafeRevealed(game) && game.boss && game.boss.lives > 0) {
    game.status = 'lost';
    game.turn = 'player';
    events.push({ type: 'lost' });
    return events;
  }
  game.turn = 'player';
  return events;
}

/** Reload must finish a persisted boss turn instead of skipping it. */
export function resolvePendingBossTurn(game: Game, mode?: Difficulty): void {
  if (game.status !== 'playing' || !game.boss) {
    game.turn = 'player';
    return;
  }
  if (game.boss.lives <= 0) {
    game.turn = 'player';
    return;
  }
  if (game.turn !== 'boss') return;
  finishBossTurn(game, stepBoss(game), mode);
}

/**
 * After a successful dig or flag: resolve boss kill / campaign lose, else
 * the floor boss takes one move. Player + boss are one atomic action for persist.
 */
export function afterPlayerAction(
  game: Game,
  mode?: Difficulty,
  prior: readonly GameEvent[] = [],
): GameEvent[] {
  const events: GameEvent[] = [];
  if (game.status !== 'playing') return events;

  if (game.boss) {
    if (game.boss.lives <= 0) {
      game.turn = 'player';
      return events;
    }
    if (allSafeRevealed(game)) {
      game.status = 'lost';
      game.turn = 'player';
      events.push({ type: 'lost' });
      return events;
    }
    const afterHit = prior.some((e) => e.type === 'boss-hit');
    game.turn = 'boss';
    events.push(...finishBossTurn(game, stepBoss(game, afterHit), mode));
    return events;
  }

  if (isWon(game)) {
    game.status = 'cleared';
    events.push({ type: 'cleared', rewards: grantIntactLoot(game, mode) });
  }
  return events;
}

/** Flag or unflag a hidden cell, then the boss acts if this is a boss floor. */
export function flag(game: Game, index: number, mode?: Difficulty): GameEvent[] {
  if (!toggleFlag(game, index)) return [];
  game.lastPlayerAction = index;
  return afterPlayerAction(game, mode);
}

function revealFlood(game: Game, start: number, events: GameEvent[]): number[] {
  const revealed: number[] = [];
  const stack = [start];

  while (stack.length > 0) {
    const i = stack.pop()!;
    const c = game.cells[i];
    if (c.state === 'revealed' || c.state === 'flagged') continue;
    if (c.kind === 'mine') continue;

    c.state = 'revealed';
    revealed.push(i);

    if (c.kind === 'chest' && !c.wrecked && c.tier) {
      game.chestsOpened += 1;
      events.push({ type: 'chest', index: i, tier: c.tier });
    }

    if (c.adjacentMines === 0) {
      for (const n of neighbors(game.width, game.height, i)) {
        const nb = game.cells[n];
        if (nb.state === 'hidden' && nb.kind !== 'mine') stack.push(n);
      }
    }
  }

  return revealed;
}

/** Grant inner items from intact chests. Call only once the floor is cleared. */
export function grantIntactLoot(game: Game, mode?: Difficulty): ChestReward[] {
  if (game.rewardsGranted) return [];
  const rewards: ChestReward[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const c = game.cells[i];
    if (c.kind !== 'chest' || c.wrecked || c.state !== 'revealed' || !c.loot) continue;
    game.gold += c.gold;
    if (c.loot !== 'gold-pouch') {
      game.inventory = addItem(game.inventory, c.loot);
    }
    rewards.push({ index: i, itemId: c.loot, gold: c.gold });
  }
  const medal = mode ? medalForMode(mode) : null;
  if (medal && isPerfectClear(game)) {
    game.inventory = addItem(game.inventory, medal);
    rewards.push({ index: -1, itemId: medal, gold: 0 });
  }
  game.rewardsGranted = true;
  return rewards;
}

export type ChestNotice = {
  kind: 'found' | 'broken';
  tier: ChestTier;
  index: number;
};

/** Play-time toasts: chest + tier only. Never inner items. */
export function chestNotices(events: GameEvent[], cells: Cell[]): ChestNotice[] {
  const out: ChestNotice[] = [];
  for (const e of events) {
    if (e.type === 'chest') {
      out.push({ kind: 'found', tier: e.tier, index: e.index });
    } else if (e.type === 'explode') {
      for (const w of e.wrecked) {
        const tier = cells[w]?.tier;
        if (tier) out.push({ kind: 'broken', tier, index: w });
      }
    } else if (e.type === 'boss-smash-chest') {
      out.push({ kind: 'broken', tier: e.tier, index: e.index });
    }
  }
  return out;
}

/**
 * Dig a hidden cell. Flagged cells are ignored (unflag first).
 * First reveal of a floor is always relocated off a mine.
 */
export function dig(game: Game, index: number, rng: Rng, mode?: Difficulty): GameEvent[] {
  const events: GameEvent[] = [];
  if (game.status !== 'playing') return events;
  const cell = game.cells[index];
  if (!cell) return events;

  const boss = game.boss;
  if (game.doorIndex === index && cell.state === 'revealed') {
    if (!boss || boss.lives > 0) return [{ type: 'deny' }];
    if (!allSafeRevealed(game)) return [{ type: 'extract-prompt' }];
    return extract(game, mode);
  }

  if (cell.hearted) {
    return [{ type: 'deny' }];
  }

  if (cell.state === 'revealed' || cell.state === 'flagged') return events;

  if (!game.firstClickDone) {
    ensureFirstClickSafe(game, index, rng);
    game.firstClickDone = true;
  }

  const after = game.cells[index];
  if (after.kind === 'mine') {
    events.push(...explodeChain(game, index));
  } else {
    const indices = revealFlood(game, index, events);
    if (indices.length > 0) events.push({ type: 'reveal', indices });
  }

  game.lastPlayerAction = index;
  events.push(...afterPlayerAction(game, mode, events));
  return events;
}

/** Campaign finale: leave through the revealed door after the boss is dead. */
export function extract(game: Game, mode?: Difficulty): GameEvent[] {
  if (game.status !== 'playing') return [];
  const boss = game.boss;
  if (!boss || boss.lives > 0) return [];
  const door = game.doorIndex;
  if (door == null || game.cells[door].state !== 'revealed') return [];
  game.status = 'cleared';
  game.turn = 'player';
  return [{ type: 'cleared', rewards: grantIntactLoot(game, mode) }];
}
