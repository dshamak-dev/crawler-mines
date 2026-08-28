import { allSafeRevealed, ensureFirstClickSafe, isWon, neighbors } from './board';
import { hitBossFromBlasts, stepBoss } from './boss';
import { addItem, type ChestTier } from './loot';
import type { Cell, ChestReward, Game, GameEvent, Rng } from './types';

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

/**
 * After a successful dig or flag: resolve boss kill / campaign lose, else
 * Gluttony takes one move. Player + boss are one atomic action for persist.
 */
export function afterPlayerAction(game: Game): GameEvent[] {
  const events: GameEvent[] = [];
  if (game.status !== 'playing') return events;

  if (game.boss) {
    if (game.boss.lives <= 0) {
      game.status = 'cleared';
      game.turn = 'player';
      events.push({ type: 'boss-death' });
      events.push({ type: 'cleared', rewards: grantIntactLoot(game) });
      return events;
    }
    if (allSafeRevealed(game)) {
      game.status = 'lost';
      game.turn = 'player';
      events.push({ type: 'lost' });
      return events;
    }
    game.turn = 'boss';
    events.push(...stepBoss(game));
    game.turn = 'player';
    return events;
  }

  if (isWon(game)) {
    game.status = 'cleared';
    events.push({ type: 'cleared', rewards: grantIntactLoot(game) });
  }
  return events;
}

/** Flag or unflag a hidden cell, then the boss acts if this is a boss floor. */
export function flag(game: Game, index: number): GameEvent[] {
  if (!toggleFlag(game, index)) return [];
  return afterPlayerAction(game);
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
export function grantIntactLoot(game: Game): ChestReward[] {
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
export function dig(game: Game, index: number, rng: Rng): GameEvent[] {
  const events: GameEvent[] = [];
  if (game.status !== 'playing') return events;
  const cell = game.cells[index];
  if (!cell || cell.state === 'revealed' || cell.state === 'flagged') return events;

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

  events.push(...afterPlayerAction(game));
  return events;
}
