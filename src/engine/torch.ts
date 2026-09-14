import { removeItem, type Inventory } from './loot';
import type { Cell, Game, Rng } from './types';

export const TORCH_HINT_MS = 3000;
export const TORCH_HINT_COUNT = 2;

/** Hidden or flagged mine that has not exploded. Revealed mines are open. */
export function isClosedMine(cell: Cell | undefined): boolean {
  if (!cell || cell.kind !== 'mine' || cell.exploded) return false;
  return cell.state !== 'revealed';
}

export function closedMineIndices(game: Game): number[] {
  const out: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    if (isClosedMine(game.cells[i])) out.push(i);
  }
  return out;
}

function takeRandom(pool: number[], rng: Rng, n: number, into: number[]): void {
  while (into.length < n && pool.length > 0) {
    const k = Math.floor(rng() * pool.length);
    const pick = pool[k];
    pool.splice(k, 1);
    if (pick !== undefined) into.push(pick);
  }
}

/**
 * Up to `count` closed mines. Prefer still-hidden mines; fill from flagged
 * if fewer hidden remain.
 */
export function pickClosedMines(
  game: Game,
  rng: Rng,
  count = TORCH_HINT_COUNT,
): number[] {
  const want = Math.max(0, Math.floor(count));
  if (want < 1) return [];
  const hidden: number[] = [];
  const flagged: number[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i];
    if (!isClosedMine(cell)) continue;
    if (cell.state === 'flagged') flagged.push(i);
    else hidden.push(i);
  }
  const picked: number[] = [];
  takeRandom(hidden, rng, want, picked);
  takeRandom(flagged, rng, want, picked);
  return picked;
}

export function activeTorchHintIndices(game: Game, now = Date.now()): number[] {
  const hint = game.torchHint;
  if (!hint || now >= hint.until) return [];
  return hint.indices.filter((i) => isClosedMine(game.cells[i]));
}

/**
 * Highlight up to two closed mines for 3s. Consumes one torch only when at
 * least one closed mine was highlighted. Mutates `game.torchHint`.
 */
export function applyTorchCharm(
  items: Inventory,
  game: Game,
  rng: Rng,
  now = Date.now(),
): Inventory | null {
  if (Math.max(0, Math.floor(items['torch-charm'] ?? 0)) < 1) return null;
  const indices = pickClosedMines(game, rng, TORCH_HINT_COUNT);
  if (indices.length === 0) return null;
  game.torchHint = { indices, until: now + TORCH_HINT_MS };
  return removeItem(items, 'torch-charm', 1);
}
