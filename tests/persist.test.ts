import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  RUN_KEY,
  cloneGame,
  createGameFromLayout,
  dig,
  emptyCollection,
  emptyInventory,
  grantIntactLoot,
  inventoryTotal,
  loadCollection,
  loadRun,
  mulberry32,
  parsePersistedRun,
  toggleFlag,
  type GameEvent,
  type KeyStore,
} from '../src/engine';
import { createGameStore } from '../src/store/gameStore';

function memoryStore(seed: Record<string, string> = {}): KeyStore {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function idx(game: { width: number }, x: number, y: number): number {
  return y * game.width + x;
}

function hiddenSafeIndex(game: { cells: Array<{ kind: string; state: string }> }): number {
  return game.cells.findIndex((c) => c.kind !== 'mine' && c.state === 'hidden');
}

function revealUntilOneSafe(store: ReturnType<typeof createGameStore>, rng: () => number): number {
  for (;;) {
    const game = store.getState().run?.game;
    if (!game) throw new Error('expected a run');
    const hidden = game.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.kind !== 'mine' && c.state === 'hidden');
    if (hidden.length <= 1) return hidden[0]?.i ?? -1;
    store.getState().applyDig(hidden[0].i, rng);
  }
}

function playEvents(store: ReturnType<typeof createGameStore>, rng: () => number): GameEvent[] {
  let last: GameEvent[] = [];
  for (;;) {
    const game = store.getState().run?.game;
    if (!game || game.status === 'cleared') return last;
    const i = hiddenSafeIndex(game);
    if (i < 0) return last;
    last = store.getState().applyDig(i, rng);
  }
}

describe('grantIntactLoot is idempotent', () => {
  it('does not pay gold or pack salvage a second time', () => {
    const game = createGameFromLayout(['.$', '..'], 10, 'gem');
    const rng = mulberry32(1);
    dig(game, idx(game, 1, 0), rng);
    dig(game, idx(game, 0, 0), rng);
    dig(game, idx(game, 1, 1), rng);
    expect(game.status).toBe('cleared');
    expect(game.rewardsGranted).toBe(true);
    expect(game.inventory.gem).toBe(1);
    const again = grantIntactLoot(game);
    expect(again).toEqual([]);
    expect(game.inventory.gem).toBe(1);
    expect(game.gold).toBe(0);
  });
});

describe('run snapshot hydrate', () => {
  it('restores the board, sealed chests, tiers, and found/broken counts', () => {
    const game = createGameFromLayout(['.$', '*.'], 10, 'gem');
    dig(game, idx(game, 1, 0), mulberry32(1));
    expect(game.chestsOpened).toBe(1);
    expect(game.inventory.gem).toBe(0);
    expect(game.cells[idx(game, 1, 0)].tier).toBe('iron');
    expect(game.cells[idx(game, 1, 0)].loot).toBe('gem');
    expect(game.cells[idx(game, 1, 0)].state).toBe('revealed');
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);

    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.setState({
      run: {
        mode: 'easy',
        floor: 0,
        game: cloneGame(game),
        grantKey: 'floor-a',
      },
      runLoot: emptyInventory(),
    });

    const blob = store.getItem(RUN_KEY);
    expect(blob).toBeTruthy();
    expect(blob).not.toMatch(/lootQueue|blasts|sparkles|toast/i);

    const s2 = createGameStore(store);
    const restored = s2.getState().run;
    expect(restored).not.toBeNull();
    if (!restored) throw new Error('expected run');
    expect(restored.mode).toBe('easy');
    expect(restored.floor).toBe(0);
    expect(restored.game.chestsOpened).toBe(1);
    expect(restored.game.chestsDestroyed).toBe(0);
    expect(restored.game.status).toBe('playing');
    expect(restored.game.rewardsGranted).toBe(false);
    expect(inventoryTotal(restored.game.inventory)).toBe(0);
    const chest = restored.game.cells[idx(restored.game, 1, 0)];
    expect(chest.kind).toBe('chest');
    expect(chest.state).toBe('revealed');
    expect(chest.tier).toBe('iron');
    expect(chest.loot).toBe('gem');
    expect(chest.wrecked).toBe(false);
    expect(restored.game.cells[idx(restored.game, 0, 1)].kind).toBe('mine');
    expect(restored.game.cells[idx(restored.game, 0, 1)].state).toBe('hidden');
  });

  it('keeps flags and first-click state', () => {
    const game = createGameFromLayout(['..', '.*']);
    toggleFlag(game, 0);
    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.setState({
      run: { mode: 'easy', floor: 0, game: cloneGame(game), grantKey: 'flagged' },
      runLoot: emptyInventory(),
    });
    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.cells[0].state).toBe('flagged');
    expect(s2.getState().run?.game.firstClickDone).toBe(true);
  });

  it('discards corrupt payloads', () => {
    expect(parsePersistedRun('{not json').run).toBeNull();
    expect(parsePersistedRun(JSON.stringify({ state: { run: { mode: 'easy' } } })).run).toBeNull();
    const store = memoryStore({ [RUN_KEY]: '{"state":{"run":null}}' });
    expect(loadRun(store).run).toBeNull();
  });
});

describe('hydrate then clear awards once', () => {
  it('grants wallet and collection once after a mid-run reload, and not again', () => {
    const rng = mulberry32(3);
    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.getState().start('easy', rng);
    const lastSafe = revealUntilOneSafe(s1, rng);
    expect(lastSafe).toBeGreaterThanOrEqual(0);
    expect(s1.getState().run?.game.status).toBe('playing');
    expect(s1.getState().run?.game.rewardsGranted).toBe(false);

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.cells).toEqual(s1.getState().run?.game.cells);
    expect(s2.getState().run?.grantKey).toBe(s1.getState().run?.grantKey);

    const events = s2.getState().applyDig(lastSafe, rng);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    const cleared = s2.getState().run;
    expect(cleared?.game.status).toBe('cleared');
    expect(cleared?.game.rewardsGranted).toBe(true);

    const afterClear = loadCollection(store);
    expect(
      (cleared?.game.gold ?? 0) + inventoryTotal(cleared?.game.inventory ?? emptyInventory()),
    ).toBeGreaterThan(0);

    const again = s2.getState().applyDig(lastSafe, rng);
    expect(again).toEqual([]);
    expect(grantIntactLoot(s2.getState().run!.game)).toEqual([]);
    expect(loadCollection(store)).toEqual(afterClear);

    const s3 = createGameStore(store);
    expect(s3.getState().run?.game.status).toBe('cleared');
    expect(s3.getState().run?.game.rewardsGranted).toBe(true);
    expect(s3.getState().applyDig(0, rng)).toEqual([]);
    expect(grantIntactLoot(s3.getState().run!.game)).toEqual([]);
    expect(loadCollection(store)).toEqual(afterClear);
    expect(loadCollection(store).lastGrantKey).toBe(s2.getState().run?.grantKey);
  });

  it('reload after clear does not double-award gold pouches or salvage', () => {
    const rng = mulberry32(11);
    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.getState().start('easy', rng);
    playEvents(s1, rng);
    expect(s1.getState().run?.game.status).toBe('cleared');
    const paid = loadCollection(store);
    expect(s1.getState().meta).toEqual(paid);
    expect(paid.lastGrantKey).toBe(s1.getState().run?.grantKey);

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.status).toBe('cleared');
    expect(s2.getState().run?.game.rewardsGranted).toBe(true);
    s2.getState().applyDig(0, rng);
    grantIntactLoot(s2.getState().run!.game);
    const again = loadCollection(store);
    expect(again.gold).toBe(paid.gold);
    expect(again.items).toEqual(paid.items);
    expect(s2.getState().meta.gold).toBe(paid.gold);
    expect(s2.getState().meta.items).toEqual(paid.items);
  });

  it('recover-banks a cleared floor if collection lagged behind the run snapshot', () => {
    const game = createGameFromLayout(['.$', '..'], 18, 'gold-pouch');
    const rng = mulberry32(1);
    dig(game, 1, rng);
    dig(game, 0, rng);
    dig(game, idx(game, 1, 1), rng);
    expect(game.status).toBe('cleared');
    expect(game.rewardsGranted).toBe(true);
    expect(game.gold).toBe(18);

    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.setState({
      run: { mode: 'easy', floor: 0, game: cloneGame(game), grantKey: 'late-bank' },
      runLoot: emptyInventory(),
    });
    expect(loadCollection(store).gold).toBe(0);

    const s2 = createGameStore(store);
    expect(s2.getState().meta.gold).toBe(18);
    expect(loadCollection(store).gold).toBe(18);
    expect(loadCollection(store).lastGrantKey).toBe('late-bank');

    const s3 = createGameStore(store);
    expect(s3.getState().meta.gold).toBe(18);
    expect(loadCollection(store).gold).toBe(18);
  });
});

describe('persisted blob omits fx', () => {
  it('does not write toast or blast fields into the run key', () => {
    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.getState().start('easy', mulberry32(4));
    const i = hiddenSafeIndex(s1.getState().run!.game);
    s1.getState().applyDig(i, mulberry32(4));
    const payload = JSON.parse(store.getItem(RUN_KEY) ?? '{}') as {
      state?: Record<string, unknown>;
    };
    expect(payload.state).toBeTruthy();
    expect(payload.state).not.toHaveProperty('lootQueue');
    expect(payload.state).not.toHaveProperty('blasts');
    expect(payload.state).not.toHaveProperty('sparkles');
    expect(payload.state).not.toHaveProperty('report');
    expect(store.getItem(COLLECTION_KEY) === null || store.getItem(COLLECTION_KEY)).toBeTruthy();
  });
});
