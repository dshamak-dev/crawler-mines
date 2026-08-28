import {
  ensureFirstClickSafe,
  isWon,
  neighbors,
} from './board';
import type { Game, GameEvent, Rng } from './types';

/**
 * Detonate a mine and BFS-chain into every 8-adjacent mine (flagged or hidden).
 * Each blast wrecks unrevealed loot in its own neighborhood.
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
      if (nb.kind === 'chest' && !nb.wrecked && nb.state !== 'revealed') {
        nb.wrecked = true;
        nb.state = 'revealed';
        game.chestsDestroyed += 1;
        game.goldDestroyed += nb.gold;
        wrecked.push(n);
      } else if (nb.kind === 'mine' && !nb.exploded && !queued.has(n)) {
        queued.add(n);
        queue.push({ index: n, wave: wave + 1 });
      }
    }

    events.push({ type: 'explode', index, wrecked, wave });
  }

  return events;
}

export function toggleFlag(game: Game, index: number): boolean {
  if (game.status !== 'playing') return false;
  const cell = game.cells[index];
  if (!cell || cell.state === 'revealed') return false;
  cell.state = cell.state === 'flagged' ? 'hidden' : 'flagged';
  return true;
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

    if (c.kind === 'chest' && !c.wrecked) {
      game.gold += c.gold;
      game.chestsOpened += 1;
      events.push({ type: 'chest', index: i, gold: c.gold });
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

  if (isWon(game)) {
    game.status = 'cleared';
    events.push({ type: 'cleared' });
  }

  return events;
}
