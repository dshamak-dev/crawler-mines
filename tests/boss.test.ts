import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_LIVES,
  CAMPAIGN_COST,
  DIFFICULTIES,
  allSafeRevealed,
  cloneGame,
  createGame,
  createGameFromLayout,
  configFor,
  dig,
  emptyInventory,
  emptyStash,
  flag,
  isLost,
  isWalkable,
  loadCollection,
  mulberry32,
  rollBonusKey,
  rollBossId,
  saveCollection,
  stepBoss,
  toggleFlag,
  type CollectionState,
  type GameEvent,
  type Inventory,
  type KeyStore,
} from '../src/engine';
import { desiredBgm } from '../src/audio';
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

function killBoss(
  store: ReturnType<typeof createGameStore>,
  rng: () => number,
): GameEvent[] {
  const allEvents: GameEvent[] = [];
  for (let hit = 0; hit < BOSS_MAX_LIVES + 2; hit++) {
    const g = store.getState().run?.game;
    if (!g || g.status !== 'playing') break;
    const mine = g.cells.findIndex((c) => c.kind === 'mine' && !c.exploded);
    if (mine < 0) break;
    allEvents.push(...store.getState().applyDig(mine, rng));
  }
  return allEvents;
}

/** Fixed sequence: first values for digs (unused when firstClickDone), then settle rolls. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i += 1;
    return v;
  };
}

describe('Hard has no boss', () => {
  it('hard config and generated boards never spawn a boss', () => {
    expect(DIFFICULTIES.hard.bossLives).toBeUndefined();
    const game = createGame(configFor('hard', 0), mulberry32(3), 'hard');
    expect(game.boss).toBeNull();
  });
});

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
        bossRevealPending: false,
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
        bossRevealPending: false,
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

describe('floor 5 rolls and persists boss id', () => {
  it('rolls Gluttony or Wrath with equal weight and persists across resume', () => {
    expect(rollBossId(() => 0.49)).toBe('gluttony');
    expect(rollBossId(() => 0.5)).toBe('wrath');

    const { store } = withWallet(100);
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['B.*', '...'], 10, 'gold-pouch', undefined, 'wrath');
    dig(game, idx(game, 1, 0), mulberry32(1));
    s1.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game: cloneGame(game),
        grantKey: 'boss-roll',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: true,
      },
      runLoot: emptyInventory(),
    });
    expect(s1.getState().run?.game.boss?.id).toBe('wrath');
    expect(s1.getState().run?.bossRevealPending).toBe(true);

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.boss?.id).toBe('wrath');
    expect(s2.getState().run?.bossRevealPending).toBe(false);
    expect(
      desiredBgm('play', 'campaign', null, s2.getState().run?.floor ?? 0, s2.getState().run?.game.boss?.id ?? null),
    ).toBe('wrath');
    expect(
      desiredBgm('collection', 'campaign', 'play', 4, s2.getState().run?.game.boss?.id ?? null),
    ).toBe('wrath');
  });

  it('descending onto floor 5 marks reveal pending and does not name bosses on earlier floors', () => {
    const { store } = withWallet(100);
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(8))).toBe(true);
    expect(s.getState().run?.game.boss).toBeNull();
    expect(s.getState().run?.bossRevealPending).toBe(false);

    s.setState({
      run: {
        ...s.getState().run!,
        floor: 3,
        game: createGame(configFor('campaign', 3), mulberry32(1), 'campaign'),
        campaignStash: emptyStash(),
        bossRevealPending: false,
      },
    });
    expect(s.getState().run?.game.boss).toBeNull();
    s.getState().nextFloor(mulberry32(11));
    expect(s.getState().run?.floor).toBe(4);
    expect(s.getState().run?.game.boss).not.toBeNull();
    expect(s.getState().run?.bossRevealPending).toBe(true);
    expect(['gluttony', 'wrath']).toContain(s.getState().run?.game.boss?.id);
  });

  it('resume skips popup and does not reroll the boss id', () => {
    const { store } = withWallet(100);
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['B..', '...'], 10, 'gold-pouch', undefined, 'gluttony');
    s1.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'boss-keep',
        campaignStash: { gold: 3, items: emptyInventory() },
        bonusKey: null,
        bossRevealPending: true,
      },
      runLoot: emptyInventory(),
    });
    s1.getState().dismissBossReveal();
    expect(s1.getState().run?.bossRevealPending).toBe(false);

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.boss?.id).toBe('gluttony');
    expect(s2.getState().run?.bossRevealPending).toBe(false);
    expect(s2.getState().run?.campaignStash?.gold).toBe(3);
    expect(
      desiredBgm('play', 'campaign', null, s2.getState().run?.floor ?? 0, s2.getState().run?.game.boss?.id ?? null),
    ).toBe('boss');
  });
});

describe('Gluttony movement', () => {
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

  it('does not smash chests at full health when no flags', () => {
    const game = createGameFromLayout(['B$.', '...', '..*']);
    const chest = idx(game, 1, 0);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES);
    stepBoss(game);
    expect(game.cells[chest].wrecked).toBe(false);
    expect(game.chestsDestroyed).toBe(0);
  });

  it('smashes an adjacent healthy sealed chest when wounded and no flags', () => {
    const game = createGameFromLayout(['B$.', '...', '..*']);
    const chest = idx(game, 1, 0);
    game.boss!.lives = BOSS_MAX_LIVES - 1;
    const events = stepBoss(game);
    expect(events).toEqual([{ type: 'boss-smash-chest', index: chest, tier: 'wooden' }]);
    expect(game.cells[chest].wrecked).toBe(true);
    expect(game.chestsDestroyed).toBe(1);
    expect(game.inventory['gold-pouch']).toBe(0);
  });

  it('hunts flags before chests when wounded', () => {
    const game = createGameFromLayout(['B*$', '...']);
    const chest = idx(game, 2, 0);
    const flagCell = idx(game, 1, 0);
    game.boss!.lives = BOSS_MAX_LIVES - 1;
    toggleFlag(game, flagCell);
    const events = stepBoss(game);
    expect(events.some((e) => e.type === 'boss-eat-flag')).toBe(true);
    expect(game.cells[chest].wrecked).toBe(false);
  });

  it('does not wreck a chest by standing on or next to it at full health', () => {
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

describe('Wrath movement and combat', () => {
  it('hunts the last dig cell and ignores flags as food', () => {
    const game = createGameFromLayout(['B...', '....'], 10, 'gold-pouch', undefined, 'wrath');
    const digCell = idx(game, 3, 0);
    const flagCell = idx(game, 0, 1);
    for (const i of [idx(game, 1, 0), idx(game, 2, 0), digCell]) {
      game.cells[i].state = 'revealed';
    }
    game.lastPlayerAction = digCell;
    expect(toggleFlag(game, flagCell)).toBe(true);
    expect(game.cells[flagCell].state).toBe('flagged');
    const moved = stepBoss(game);
    expect(moved.some((e) => e.type === 'boss-eat-flag')).toBe(false);
    expect(moved).toEqual([{ type: 'boss-move', index: idx(game, 1, 0) }]);
    expect(game.cells[flagCell].state).toBe('flagged');
  });

  it('smashes an adjacent healthy sealed chest from life 1', () => {
    const game = createGameFromLayout(['B$.', '...'], 10, 'gem', undefined, 'wrath');
    const chest = idx(game, 1, 0);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES);
    const events = stepBoss(game);
    expect(events).toEqual([{ type: 'boss-smash-chest', index: chest, tier: 'iron' }]);
    expect(game.cells[chest].wrecked).toBe(true);
    expect(game.chestsDestroyed).toBe(1);
  });

  it('mine-slams when it cannot path to the last action and takes 1 life', () => {
    const game = createGameFromLayout(['B*.', '...', '...'], 10, 'gold-pouch', undefined, 'wrath');
    const far = idx(game, 2, 2);
    const events = flag(game, far);
    expect(game.lastPlayerAction).toBe(far);
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(events.filter((e) => e.type === 'boss-hit')).toHaveLength(1);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES - 1);
    expect(game.cells[idx(game, 1, 0)].exploded).toBe(true);
  });

  it('waits when there is no path and no neighboring mine', () => {
    const game = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, 'wrath');
    game.lastPlayerAction = idx(game, 1, 1);
    expect(stepBoss(game)).toEqual([]);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES);
  });
});

describe('Gluttony combat', () => {
  it('starts with 3 lives on the boss floor', () => {
    const game = createGame(configFor('campaign', 4), mulberry32(9));
    expect(game.boss?.lives).toBe(3);
  });

  it('takes 1 life per adjacent-mine blast and dies on three hits', () => {
    const oneHit = createGameFromLayout(['*B', '..']);
    expect(oneHit.boss?.lives).toBe(BOSS_MAX_LIVES);
    dig(oneHit, 0, mulberry32(1));
    expect(oneHit.boss?.lives).toBe(BOSS_MAX_LIVES - 1);

    const finisher = createGameFromLayout(['*B', '..']);
    finisher.boss!.lives = 1;
    dig(finisher, 0, mulberry32(1));
    expect(finisher.boss?.lives).toBe(0);
    expect(finisher.status).toBe('cleared');
  });

  it('already-exploded mines do not re-hit', () => {
    const game = createGameFromLayout(['*B', '..']);
    dig(game, 0, mulberry32(1));
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES - 1);
    expect(game.cells[0].exploded).toBe(true);
    const again = dig(game, 0, mulberry32(1));
    expect(again.filter((e) => e.type === 'boss-hit')).toEqual([]);
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES - 1);
  });

  it('losing with a living boss after all safe cells open grants nothing', () => {
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
        bossRevealPending: false,
      },
      runLoot: { ...emptyInventory(), gem: 2, 'rusty-key': 1 },
    });
    const rng = mulberry32(1);
    s.getState().applyDig(idx(game, 1, 0), rng);
    s.getState().applyDig(idx(game, 1, 1), rng);
    expect(s.getState().run?.game.status).toBe('lost');
    expect(s.getState().run?.game.boss?.lives).toBe(BOSS_MAX_LIVES);
    expect(allSafeRevealed(s.getState().run!.game)).toBe(true);
    expect(isLost(s.getState().run!.game)).toBe(true);
    expect(s.getState().run?.campaignStash?.gold).toBe(0);
    expect(s.getState().runLoot.gem).toBe(0);
    expect(s.getState().meta.gold).toBe(80);
    expect(loadCollection(store).gold).toBe(80);
    expect(loadCollection(store).items.gem).toBe(0);
    expect(loadCollection(store).items['gluttony-head']).toBe(0);
    expect(loadCollection(store).items['hard-key']).toBe(0);
    expect(loadCollection(store).items['campaign-key']).toBe(0);
  });
});

describe('boss win rewards', () => {
  it('25% chance of a bonus key then 50/50 hard vs campaign; otherwise null', () => {
    expect(rollBonusKey(() => 0.25)).toBeNull();
    expect(rollBonusKey(seqRng([0.24, 0.4]))).toBe('hard-key');
    expect(rollBonusKey(seqRng([0.1, 0.6]))).toBe('campaign-key');
  });

  it('killing Gluttony always grants a stacked head and optionally a key', () => {
    const { store } = withWallet(12, { 'gluttony-head': 1 });
    const s = createGameStore(store);
    const game = createGameFromLayout(['*..', '.B.', '*.*'], 10, 'gold-pouch', undefined, 'gluttony');
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
        bossRevealPending: false,
      },
      runLoot: { ...stashItems },
    });
    // After digs (no rng use when firstClickDone), settleCampaign rolls bonus: miss the 25%.
    const events = killBoss(s, seqRng([0.9, 0.9, 0.9, 0.9]));
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(s.getState().run?.bonusKey).toBeNull();
    const paid = loadCollection(store);
    expect(paid.gold).toBe(37);
    expect(paid.items['torch-charm']).toBe(1);
    expect(paid.items['gluttony-head']).toBe(2);
    expect(paid.items['hard-key']).toBe(0);
    expect(paid.items['campaign-key']).toBe(0);
    expect(paid.lastGrantKey).toBe('boss-win');
  });

  it('killing Wrath grants wrath-head and a rolled hard-key inside the 25%', () => {
    const { store } = withWallet(0);
    const s = createGameStore(store);
    const game = createGameFromLayout(['*..', '.B.', '*.*'], 10, 'gold-pouch', undefined, 'wrath');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'wrath-win',
        campaignStash: { gold: 5, items: emptyInventory() },
        bonusKey: null,
        bossRevealPending: false,
      },
      runLoot: emptyInventory(),
    });
    const events = killBoss(s, seqRng([0.1, 0.2]));
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.bonusKey).toBe('hard-key');
    const paid = loadCollection(store);
    expect(paid.items['wrath-head']).toBe(1);
    expect(paid.items['hard-key']).toBe(1);
    expect(paid.items['gluttony-head']).toBe(0);
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
        bossRevealPending: false,
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
        bossRevealPending: false,
      },
      runLoot: emptyInventory(),
    });
    s1.getState().applyFlag(idx(game, 2, 0));
    expect(s1.getState().run?.game.boss?.index).toBe(idx(game, 1, 0));
    expect(s1.getState().run?.game.turn).toBe('player');

    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.boss?.index).toBe(idx(game, 1, 0));
    expect(s2.getState().run?.game.boss?.lives).toBe(BOSS_MAX_LIVES);
    expect(s2.getState().run?.game.turn).toBe('player');
    expect(s2.getState().run?.campaignStash?.gold).toBe(7);
    expect(s2.getState().meta.gold).toBe(100);
  });
});

describe('last campaign floor spawns a boss', () => {
  it('reveals the boss cell at start and does not sit on a mine or chest', () => {
    const game = createGame(configFor('campaign', 4), mulberry32(9));
    expect(game.boss).not.toBeNull();
    expect(game.boss?.lives).toBe(BOSS_MAX_LIVES);
    expect(['gluttony', 'wrath']).toContain(game.boss?.id);
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
