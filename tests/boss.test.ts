import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_LIVES,
  CAMPAIGN_COST,
  allSafeRevealed,
  cloneGame,
  createGame,
  createGameFromLayout,
  configFor,
  dig,
  emptyCollection,
  emptyInventory,
  emptyStash,
  flag,
  isLost,
  isWalkable,
  isWon,
  loadCollection,
  mulberry32,
  saveCollection,
  stepBoss,
  toggleFlag,
  type CollectionState,
  type Inventory,
  type KeyStore,
} from '../src/engine';
import { createGameStore } from '../src/store/gameStore';

function idx(game: { width: number }, x: number, y: number): number {
  return y * game.width + x;
}

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

function withWallet(
  gold: number,
  items: Partial<Inventory> = {},
  store: KeyStore = memoryStore(),
): { store: KeyStore; meta: CollectionState } {
  const meta: CollectionState = {
    gold,
    items: { ...emptyInventory(), ...items },
    lastGrantKey: null,
  };
  saveCollection(meta, store);
  return { store, meta: loadCollection(store) };
}

function revealHiddenSafe(
  store: ReturnType<typeof createGameStore>,
  rng: () => number,
): void {
  for (;;) {
    const game = store.getState().run?.game;
    if (!game || game.status !== 'playing') return;
    const i = game.cells.findIndex((c) => c.kind !== 'mine' && c.state === 'hidden');
    if (i < 0) return;
    store.getState().applyDig(i, rng);
  }
}

describe('campaign floors before last do not pay wallet', () => {
  it('stashes pouch gold and items instead of banking', () => {
    const { store } = withWallet(150);
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(2))).toBe(true);
    expect(s.getState().meta.gold).toBe(150 - CAMPAIGN_COST);

    const game = createGameFromLayout(['.$', '..'], 18, 'rusty-key');
    s.setState({
      run: {
        mode: 'campaign',
        floor: 0,
        game,
        grantKey: 'camp-f0',
        campaignStash: emptyStash(),
        bonusKey: null,
      },
    });
    const rng = mulberry32(1);
    s.getState().applyDig(idx(game, 1, 0), rng);
    s.getState().applyDig(idx(game, 0, 0), rng);
    s.getState().applyDig(idx(game, 1, 1), rng);

    expect(s.getState().run?.game.status).toBe('cleared');
    expect(s.getState().meta.gold).toBe(50);
    expect(loadCollection(store).gold).toBe(50);
    expect(loadCollection(store).items['rusty-key']).toBe(0);
    expect(s.getState().run?.campaignStash?.items['rusty-key']).toBe(1);
    expect(s.getState().run?.campaignStash?.gold).toBe(0);
    expect(s.getState().runLoot['rusty-key']).toBe(1);
  });

  it('stashes pouch coins across an earlier floor without touching the wallet', () => {
    const { store } = withWallet(50);
    const s = createGameStore(store);
    const game = createGameFromLayout(['.$', '..'], 22, 'gold-pouch');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 1,
        game,
        grantKey: 'camp-f1',
        campaignStash: { gold: 10, items: emptyInventory() },
        bonusKey: null,
      },
      runLoot: emptyInventory(),
    });
    const rng = mulberry32(1);
    s.getState().applyDig(1, rng);
    s.getState().applyDig(0, rng);
    s.getState().applyDig(idx(game, 1, 1), rng);
    expect(s.getState().run?.campaignStash?.gold).toBe(32);
    expect(s.getState().meta.gold).toBe(50);
    expect(loadCollection(store).gold).toBe(50);
  });
});

describe('Flag Eater movement', () => {
  it('waits when there is no flag', () => {
    const game = createGameFromLayout(['B..', '...', '...']);
    expect(game.boss?.index).toBe(0);
    expect(game.cells[0].state).toBe('revealed');
    expect(stepBoss(game)).toEqual([]);
    expect(game.boss?.index).toBe(0);
  });

  it('only walks open non-bomb cells and eats an adjacent flag', () => {
    const game = createGameFromLayout(['B..', '..*']);
    const open = idx(game, 1, 0);
    const flagCell = idx(game, 2, 0);
    const mine = idx(game, 2, 1);
    dig(game, open, mulberry32(1));
    expect(game.cells[open].state).toBe('revealed');
    expect(game.cells[flagCell].state).toBe('hidden');
    expect(game.boss?.index).toBe(0);

    toggleFlag(game, flagCell);
    expect(isWalkable(game, flagCell)).toBe(false);
    expect(isWalkable(game, mine)).toBe(false);

    const moved = stepBoss(game);
    expect(moved).toEqual([{ type: 'boss-move', index: open }]);
    expect(game.boss?.index).toBe(open);
    expect(game.cells[flagCell].state).toBe('flagged');

    const ate = stepBoss(game);
    expect(ate).toEqual([{ type: 'boss-eat-flag', index: flagCell }]);
    expect(game.cells[flagCell].state).toBe('hidden');
    expect(game.boss?.index).toBe(open);
    expect(game.status).toBe('playing');
  });

  it('allows re-flag after a flag is eaten', () => {
    const game = createGameFromLayout(['B.', '..']);
    const f = idx(game, 1, 0);
    expect(flag(game, f).some((e) => e.type === 'boss-eat-flag')).toBe(true);
    expect(game.cells[f].state).toBe('hidden');
    const again = flag(game, f);
    expect(again.some((e) => e.type === 'boss-eat-flag')).toBe(true);
    expect(game.cells[f].state).toBe('hidden');
    expect(toggleFlag(game, f)).toBe(true);
    expect(game.cells[f].state).toBe('flagged');
  });

  it('does not wreck a chest by standing on or next to it', () => {
    const game = createGameFromLayout(['B$*', '...']);
    const chest = idx(game, 1, 0);
    dig(game, chest, mulberry32(1));
    expect(game.cells[chest].kind).toBe('chest');
    expect(game.cells[chest].wrecked).toBe(false);
    toggleFlag(game, idx(game, 2, 0));
    stepBoss(game);
    expect(game.boss?.index).toBe(chest);
    expect(game.cells[chest].wrecked).toBe(false);
    expect(game.chestsDestroyed).toBe(0);
  });

  it('pathfinds toward the nearest flag on open cells', () => {
    const game = createGameFromLayout(['B...', '.*..', '....']);
    dig(game, idx(game, 1, 0), mulberry32(1));
    dig(game, idx(game, 2, 0), mulberry32(1));
    toggleFlag(game, idx(game, 3, 0));
    toggleFlag(game, idx(game, 0, 2));
    stepBoss(game);
    expect(game.boss?.index).toBe(idx(game, 1, 0));
  });
});

describe('Flag Eater combat', () => {
  it('takes 1 life per adjacent-mine blast and dies on two hits', () => {
    const game = createGameFromLayout(['*B', '*.']);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES);
    const events = dig(game, 0, mulberry32(1));
    const hits = events.filter((e) => e.type === 'boss-hit');
    expect(hits).toHaveLength(2);
    expect(game.boss?.lives).toBe(0);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    expect(game.status).toBe('cleared');
    expect(isWon(game)).toBe(true);
  });

  it('already-exploded mines do not re-hit', () => {
    const game = createGameFromLayout(['*B', '..']);
    dig(game, 0, mulberry32(1));
    expect(game.boss?.lives).toBe(1);
    expect(game.cells[0].exploded).toBe(true);
    const again = dig(game, 0, mulberry32(1));
    expect(again.filter((e) => e.type === 'boss-hit')).toEqual([]);
    expect(game.boss?.lives).toBe(1);
  });

  it('losing with a living boss after all safe cells open wipes the stash', () => {
    const { store } = withWallet(80);
    const s = createGameStore(store);
    const game = createGameFromLayout(['B.', '*.']);
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'boss-lose',
        campaignStash: {
          gold: 40,
          items: { ...emptyInventory(), gem: 2, 'rusty-key': 1 },
        },
        bonusKey: null,
      },
      runLoot: { ...emptyInventory(), gem: 2, 'rusty-key': 1 },
    });
    const rng = mulberry32(1);
    s.getState().applyDig(idx(game, 1, 0), rng);
    s.getState().applyDig(idx(game, 1, 1), rng);
    expect(s.getState().run?.game.status).toBe('lost');
    expect(s.getState().run?.game.boss?.lives).toBe(2);
    expect(allSafeRevealed(s.getState().run!.game)).toBe(true);
    expect(isLost(s.getState().run!.game)).toBe(true);
    expect(s.getState().run?.campaignStash?.gold).toBe(0);
    expect(s.getState().runLoot.gem).toBe(0);
    expect(s.getState().meta.gold).toBe(80);
    expect(loadCollection(store).gold).toBe(80);
    expect(loadCollection(store).items.gem).toBe(0);
  });

  it('killing the boss with two adjacent-mine hits grants stash plus a random key', () => {
    const { store } = withWallet(12);
    const s = createGameStore(store);
    const game = createGameFromLayout(['*B', '*.']);
    const stashItems = { ...emptyInventory(), 'torch-charm': 1 };
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'boss-win',
        campaignStash: { gold: 25, items: stashItems },
        bonusKey: null,
      },
      runLoot: { ...stashItems },
    });
    const rng = mulberry32(21);
    const events = s.getState().applyDig(0, rng);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.game.status).toBe('cleared');
    const bonus = s.getState().run?.bonusKey;
    expect(bonus === 'hard-key' || bonus === 'campaign-key').toBe(true);
    const paid = loadCollection(store);
    expect(paid.gold).toBe(37);
    expect(paid.items['torch-charm']).toBe(1);
    expect(paid.items[bonus!]).toBe(1);
    expect(paid.lastGrantKey).toBe('boss-win');
    expect(s.getState().run?.campaignStash?.items[bonus!]).toBe(1);
  });
});

describe('campaign resume does not charge gold', () => {
  it('reload keeps the paid wallet and the stash, and does not spend 100 again', () => {
    const { store } = withWallet(150);
    const s1 = createGameStore(store);
    expect(s1.getState().start('campaign', mulberry32(4))).toBe(true);
    expect(s1.getState().meta.gold).toBe(50);
    const game = createGameFromLayout(['.$', '..'], 9, 'gem');
    s1.setState({
      run: {
        mode: 'campaign',
        floor: 0,
        game: cloneGame(game),
        grantKey: s1.getState().run!.grantKey,
        campaignStash: emptyStash(),
        bonusKey: null,
      },
    });
    s1.getState().applyDig(1, mulberry32(1));
    s1.getState().applyDig(0, mulberry32(1));
    s1.getState().applyDig(idx(game, 1, 1), mulberry32(1));
    expect(s1.getState().run?.campaignStash?.items.gem).toBe(1);
    const grantKey = s1.getState().run?.grantKey;
    const gold = s1.getState().meta.gold;

    const s2 = createGameStore(store);
    expect(s2.getState().run?.mode).toBe('campaign');
    expect(s2.getState().run?.grantKey).toBe(grantKey);
    expect(s2.getState().meta.gold).toBe(gold);
    expect(loadCollection(store).gold).toBe(50);
    expect(s2.getState().run?.campaignStash?.items.gem).toBe(1);
    expect(s2.getState().run?.game.boss).toBeNull();
  });

  it('reload on the boss floor restores lives, cell, and turn without skipping a move', () => {
    const { store } = withWallet(100);
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['B.*', '...']);
    dig(game, idx(game, 1, 0), mulberry32(1));
    s1.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game: cloneGame(game),
        grantKey: 'boss-live',
        campaignStash: { gold: 7, items: emptyInventory() },
        bonusKey: null,
      },
      runLoot: emptyInventory(),
    });
    s1.getState().applyFlag(idx(game, 2, 0));
    expect(s1.getState().run?.game.boss?.index).toBe(idx(game, 1, 0));
    expect(s1.getState().run?.game.turn).toBe('player');

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.boss?.index).toBe(idx(game, 1, 0));
    expect(s2.getState().run?.game.boss?.lives).toBe(2);
    expect(s2.getState().run?.game.turn).toBe('player');
    expect(s2.getState().run?.campaignStash?.gold).toBe(7);
    expect(s2.getState().meta.gold).toBe(100);
  });
});

describe('last campaign floor spawns the Flag Eater', () => {
  it('reveals the boss cell at start and does not sit on a mine or chest', () => {
    const game = createGame(configFor('campaign', 4), mulberry32(9));
    expect(game.boss).not.toBeNull();
    expect(game.boss?.lives).toBe(2);
    const cell = game.cells[game.boss!.index];
    expect(cell.state).toBe('revealed');
    expect(cell.kind).toBe('empty');
    expect(cell.kind).not.toBe('mine');
    expect(cell.kind).not.toBe('chest');
  });
});

describe('reveal-all helper still works on non-boss floors', () => {
  it('easy start still pays on its own clear', () => {
    const { store } = withWallet(8);
    const s = createGameStore(store);
    s.getState().start('easy', mulberry32(6));
    revealHiddenSafe(s, mulberry32(6));
    expect(s.getState().run?.game.status).toBe('cleared');
    const paid = loadCollection(store);
    expect(paid.gold + Object.values(paid.items).reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
  });
});
