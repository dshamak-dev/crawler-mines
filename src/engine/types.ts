import type { ChestTier, Inventory, ItemId } from './loot';

export type CellKind = 'empty' | 'mine' | 'chest';
export type CellState = 'hidden' | 'flagged' | 'revealed';
export type GameStatus = 'playing' | 'cleared';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'campaign';

export type Rng = () => number;

export interface Cell {
  kind: CellKind;
  state: CellState;
  adjacentMines: number;
  wrecked: boolean;
  exploded: boolean;
  gold: number;
  /** Visible shell. Inner loot is never shown until the floor is cleared. */
  tier: ChestTier | null;
  /** Rolled at generation; granted only after a successful clear. */
  loot: ItemId | null;
}

export interface FloorConfig {
  width: number;
  height: number;
  mines: number;
  chests: number;
  chestValue: number;
}

export interface Game {
  width: number;
  height: number;
  mines: number;
  chests: number;
  cells: Cell[];
  gold: number;
  goldDestroyed: number;
  chestsOpened: number;
  chestsDestroyed: number;
  /** Awarded only after a successful floor clear. Empty during play. */
  inventory: Inventory;
  firstClickDone: boolean;
  status: GameStatus;
  /** Inner loot already applied to this floor. Survives reload so clear cannot pay twice. */
  rewardsGranted: boolean;
}

export interface ChestReward {
  index: number;
  itemId: ItemId;
  gold: number;
}

export type GameEvent =
  | { type: 'reveal'; indices: number[] }
  | { type: 'explode'; index: number; wrecked: number[]; wave: number }
  | { type: 'chest'; index: number; tier: ChestTier }
  | { type: 'cleared'; rewards: ChestReward[] };

export const DIFFICULTIES: Record<'easy' | 'medium' | 'hard', FloorConfig> = {
  easy: { width: 8, height: 8, mines: 8, chests: 6, chestValue: 10 },
  medium: { width: 9, height: 12, mines: 16, chests: 10, chestValue: 15 },
  hard: { width: 12, height: 16, mines: 32, chests: 16, chestValue: 20 },
};

/** Sequential campaign: rising mine density and more chests. */
export const CAMPAIGN_FLOORS: FloorConfig[] = [
  { width: 8, height: 8, mines: 7, chests: 5, chestValue: 10 },
  { width: 8, height: 9, mines: 11, chests: 6, chestValue: 12 },
  { width: 9, height: 11, mines: 16, chests: 8, chestValue: 15 },
  { width: 9, height: 12, mines: 22, chests: 11, chestValue: 18 },
  { width: 12, height: 16, mines: 42, chests: 16, chestValue: 25 },
];

export function configFor(mode: Difficulty, floor: number): FloorConfig {
  if (mode === 'campaign') return CAMPAIGN_FLOORS[floor];
  return DIFFICULTIES[mode];
}

export function newCell(partial: Partial<Cell> = {}): Cell {
  return {
    kind: 'empty',
    state: 'hidden',
    adjacentMines: 0,
    wrecked: false,
    exploded: false,
    gold: 0,
    tier: null,
    loot: null,
    ...partial,
  };
}

export type CellVisual =
  | 'hidden'
  | 'flagged'
  | 'bomb-flagged'
  | 'empty'
  | 'number'
  | 'chest'
  | 'wrecked'
  | 'exploded';

export function cellVisual(c: Cell): CellVisual {
  if (c.exploded) return 'exploded';
  if (c.wrecked) return 'wrecked';
  if (c.state === 'flagged') return c.kind === 'mine' ? 'bomb-flagged' : 'flagged';
  if (c.state !== 'revealed') return 'hidden';
  if (c.kind === 'chest') return 'chest';
  if (c.adjacentMines > 0) return 'number';
  return 'empty';
}
