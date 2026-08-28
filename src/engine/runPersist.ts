import { cloneGame } from './board';
import type { CollectionState, KeyStore } from './collection';
import { applyRewards } from './collection';
import {
  addItem,
  emptyInventory,
  isChestTier,
  isCollectible,
  isItemId,
  type Inventory,
  type ItemId,
} from './loot';
import {
  CAMPAIGN_FLOORS,
  type Cell,
  type Difficulty,
  type Game,
  type GameStatus,
} from './types';

export const RUN_KEY = 'crawler-mines-run';

export interface Run {
  mode: Difficulty;
  floor: number;
  game: Game;
  grantKey: string;
}

export interface FloorReport {
  opened: number;
  wrecked: number;
  lastFloor: boolean;
  loot: Inventory;
  gold: number;
}

export interface PersistedRunSlice {
  run: Run | null;
  runLoot: Inventory;
}

const KINDS: ReadonlyArray<Cell['kind']> = ['empty', 'mine', 'chest'];
const STATES: ReadonlyArray<Cell['state']> = ['hidden', 'flagged', 'revealed'];
const STATUSES: ReadonlyArray<GameStatus> = ['playing', 'cleared'];
const MODES: ReadonlyArray<Difficulty> = ['easy', 'medium', 'hard', 'campaign'];

export function newGrantKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function floorReport(run: Run): FloorReport {
  return {
    opened: run.game.chestsOpened,
    wrecked: run.game.chestsDestroyed,
    lastFloor: run.mode !== 'campaign' || run.floor >= CAMPAIGN_FLOORS.length - 1,
    loot: { ...run.game.inventory },
    gold: run.game.gold,
  };
}

export function resumeLabel(run: Run): string {
  if (run.mode === 'campaign') {
    return `Floor ${run.floor + 1}/${CAMPAIGN_FLOORS.length}`;
  }
  return run.mode;
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function sanitizeInventory(raw: unknown): Inventory {
  const inv = emptyInventory();
  if (!raw || typeof raw !== 'object') return inv;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isItemId(key) || !isCollectible(key)) continue;
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
    if (n > 0) inv[key] = n;
  }
  return inv;
}

function sanitizeCell(raw: unknown): Cell | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!KINDS.includes(c.kind as Cell['kind'])) return null;
  if (!STATES.includes(c.state as Cell['state'])) return null;
  if (!isInt(c.adjacentMines) || c.adjacentMines < 0 || c.adjacentMines > 8) return null;
  if (typeof c.wrecked !== 'boolean' || typeof c.exploded !== 'boolean') return null;
  if (typeof c.gold !== 'number' || !Number.isFinite(c.gold) || c.gold < 0) return null;
  const tier = c.tier === null || c.tier === undefined ? null : isChestTier(c.tier) ? c.tier : null;
  if (c.tier != null && tier === null) return null;
  const loot =
    c.loot === null || c.loot === undefined ? null : isItemId(c.loot) ? c.loot : null;
  if (c.loot != null && loot === null) return null;
  return {
    kind: c.kind as Cell['kind'],
    state: c.state as Cell['state'],
    adjacentMines: c.adjacentMines,
    wrecked: c.wrecked,
    exploded: c.exploded,
    gold: Math.floor(c.gold),
    tier,
    loot,
  };
}

function sanitizeGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (!isInt(g.width) || !isInt(g.height) || g.width < 1 || g.height < 1) return null;
  if (!Array.isArray(g.cells) || g.cells.length !== g.width * g.height) return null;
  const cells: Cell[] = [];
  for (const entry of g.cells) {
    const cell = sanitizeCell(entry);
    if (!cell) return null;
    cells.push(cell);
  }
  if (!isInt(g.mines) || g.mines < 0) return null;
  if (!isInt(g.chests) || g.chests < 0) return null;
  if (typeof g.gold !== 'number' || !Number.isFinite(g.gold) || g.gold < 0) return null;
  if (typeof g.goldDestroyed !== 'number' || !Number.isFinite(g.goldDestroyed) || g.goldDestroyed < 0) {
    return null;
  }
  if (!isInt(g.chestsOpened) || g.chestsOpened < 0) return null;
  if (!isInt(g.chestsDestroyed) || g.chestsDestroyed < 0) return null;
  if (typeof g.firstClickDone !== 'boolean') return null;
  if (!STATUSES.includes(g.status as GameStatus)) return null;
  const inventory = sanitizeInventory(g.inventory);
  const rewardsGranted = g.rewardsGranted === true;
  return {
    width: g.width,
    height: g.height,
    mines: g.mines,
    chests: g.chests,
    cells,
    gold: Math.floor(g.gold),
    goldDestroyed: Math.floor(g.goldDestroyed),
    chestsOpened: g.chestsOpened,
    chestsDestroyed: g.chestsDestroyed,
    inventory,
    firstClickDone: g.firstClickDone,
    status: g.status as GameStatus,
    rewardsGranted,
  };
}

export function sanitizeRun(raw: unknown): Run | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!MODES.includes(r.mode as Difficulty)) return null;
  const mode = r.mode as Difficulty;
  if (!isInt(r.floor) || r.floor < 0) return null;
  if (mode === 'campaign' && r.floor >= CAMPAIGN_FLOORS.length) return null;
  const game = sanitizeGame(r.game);
  if (!game) return null;
  if (typeof r.grantKey !== 'string' || r.grantKey.length === 0) return null;
  return {
    mode,
    floor: r.floor,
    game: cloneGame(game),
    grantKey: r.grantKey,
  };
}

export function parsePersistedRun(raw: string | null): PersistedRunSlice {
  const empty: PersistedRunSlice = { run: null, runLoot: emptyInventory() };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return empty;
    const root = parsed as Record<string, unknown>;
    const slice =
      root.state && typeof root.state === 'object'
        ? (root.state as Record<string, unknown>)
        : root;
    const run = sanitizeRun(slice.run);
    const runLoot = sanitizeInventory(slice.runLoot);
    return { run, runLoot: run ? runLoot : emptyInventory() };
  } catch {
    return empty;
  }
}

export function loadRun(store: KeyStore): PersistedRunSlice {
  return parsePersistedRun(store.getItem(RUN_KEY));
}

/** Rebuild applyRewards input from a floor that already granted into the game object. */
export function rewardsFromGame(game: Game): Array<{ itemId: ItemId; gold: number }> {
  const out: Array<{ itemId: ItemId; gold: number }> = [];
  for (const id of Object.keys(game.inventory) as ItemId[]) {
    if (!isCollectible(id)) continue;
    const n = game.inventory[id] ?? 0;
    for (let i = 0; i < n; i++) out.push({ itemId: id, gold: 0 });
  }
  if (game.gold > 0) out.push({ itemId: 'gold-pouch', gold: game.gold });
  return out;
}

export function bankFloor(
  meta: CollectionState,
  runLoot: Inventory,
  rewards: ReadonlyArray<{ itemId: ItemId; gold: number }>,
  grantKey: string,
  store: KeyStore,
): { meta: CollectionState; runLoot: Inventory } {
  if (meta.lastGrantKey === grantKey) return { meta, runLoot };
  const nextMeta = applyRewards(meta, rewards, store, grantKey);
  let nextLoot = runLoot;
  for (const r of rewards) {
    if (r.itemId === 'gold-pouch') continue;
    nextLoot = addItem(nextLoot, r.itemId);
  }
  return { meta: nextMeta, runLoot: nextLoot };
}

export function recoverBank(
  run: Run | null,
  meta: CollectionState,
  runLoot: Inventory,
  store: KeyStore,
): { meta: CollectionState; runLoot: Inventory } {
  if (!run) return { meta, runLoot };
  if (!run.game.rewardsGranted && run.game.status !== 'cleared') return { meta, runLoot };
  return bankFloor(meta, runLoot, rewardsFromGame(run.game), run.grantKey, store);
}
