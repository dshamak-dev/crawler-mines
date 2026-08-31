import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_LIVES,
  LUST_MAX_LIVES,
  CAMPAIGN_COST,
  DIFFICULTIES,
  allSafeRevealed,
  bossMaxLives,
  chebyshev,
  clampBossLives,
  cloneGame,
  createGame,
  createGameFromLayout,
  configFor,
  dig,
  explodeChain,
  extract,
  emptyInventory,
  emptyStash,
  flag,
  isLost,
  isWalkable,
  loadCollection,
  mulberry32,
  neighbors,
  pickLustTarget,
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

function blastUntilDead(game: ReturnType<typeof createGameFromLayout>): void {
  while (game.boss && game.boss.lives > 0) {
    const mine = game.cells.findIndex((c) => c.kind === 'mine' && !c.exploded);
    if (mine < 0) throw new Error('expected mines next to the boss');
    explodeChain(game, mine);
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
    if (g.boss && g.boss.lives <= 0) break;
    const mine = g.cells.findIndex((c) => c.kind === 'mine' && !c.exploded);
    if (mine < 0) break;
    allEvents.push(...store.getState().applyDig(mine, rng));
  }
  return allEvents;
}

function extractThroughDoor(
  store: ReturnType<typeof createGameStore>,
  rng: () => number,
): GameEvent[] {
  const game = store.getState().run?.game;
  if (!game) return [];
  const door = game.doorIndex;
  if (door == null) throw new Error('expected a finale door');
  if (game.cells[door].state !== 'revealed') {
    store.getState().applyDig(door, rng);
  }
  const events = store.getState().applyDig(door, rng);
  if (events.some((e) => e.type === 'extract-prompt')) {
    return store.getState().applyExtract(rng);
  }
  return events;
}

function extractGame(game: ReturnType<typeof createGameFromLayout>, rng: () => number): GameEvent[] {
  const door = game.doorIndex;
  if (door == null) throw new Error('expected a finale door');
  if (game.cells[door].state !== 'revealed') dig(game, door, rng, 'campaign');
  const events = dig(game, door, rng, 'campaign');
  if (events.some((e) => e.type === 'extract-prompt')) return extract(game, 'campaign');
  return events;
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
  it('rolls Gluttony, Wrath, or Lust with equal weight and persists across resume', () => {
    expect(rollBossId(() => 0)).toBe('gluttony');
    expect(rollBossId(() => 1 / 3 - 1e-9)).toBe('gluttony');
    expect(rollBossId(() => 1 / 3)).toBe('wrath');
    expect(rollBossId(() => 2 / 3 - 1e-9)).toBe('wrath');
    expect(rollBossId(() => 2 / 3)).toBe('lust');
    expect(rollBossId(() => 0.99)).toBe('lust');

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
    expect(['gluttony', 'wrath', 'lust']).toContain(s.getState().run?.game.boss?.id);
  });

  it('resume keeps Lust at 5 lives and does not clamp to 3', () => {
    const { store } = withWallet(100);
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['B..', '...'], 10, 'gold-pouch', undefined, 'lust');
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    s1.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'lust-keep',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: true,
      },
      runLoot: emptyInventory(),
    });
    const s2 = createGameStore(store);
    expect(s2.getState().run?.game.boss?.id).toBe('lust');
    expect(s2.getState().run?.game.boss?.lives).toBe(LUST_MAX_LIVES);
    expect(s2.getState().run?.game.cells.every((c) => !c.hearted)).toBe(true);
    expect(s2.getState().run?.bossRevealPending).toBe(false);
    expect(
      desiredBgm('play', 'campaign', null, 4, s2.getState().run?.game.boss?.id ?? null),
    ).toBe('lust');
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
    expect(ate[0]).toEqual({ type: 'boss-eat-flag', index: flagCell });
    expect(ate.filter((e) => e.type === 'boss-move').length).toBeGreaterThanOrEqual(1);
    expect(ate.filter((e) => e.type === 'boss-move').length).toBeLessThanOrEqual(2);
    expect(game.cells[flagCell].state).toBe('hidden');
    expect(chebyshev(game.width, game.boss!.index, flagCell)).toBeGreaterThan(
      chebyshev(game.width, open, flagCell),
    );
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

describe('Lust movement and combat', () => {
  function revealSafe(game: ReturnType<typeof createGameFromLayout>): void {
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind !== 'mine') game.cells[i].state = 'revealed';
    }
  }

  it('walks one adjacent step per turn and does not teleport', () => {
    const game = createGameFromLayout(
      ['B....', '.....', '...**'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const target = idx(game, 3, 1);
    expect(game.cells[target].adjacentMines).toBe(2);
    revealSafe(game);
    expect(pickLustTarget(game)).toBe(target);
    expect(game.boss?.index).toBe(0);
    const before = chebyshev(game.width, 0, target);
    expect(before).toBeGreaterThan(1);
    const moved = stepBoss(game);
    expect(moved).toEqual([{ type: 'boss-move', index: expect.any(Number) }]);
    expect(game.boss?.index).not.toBe(target);
    expect(chebyshev(game.width, 0, game.boss!.index)).toBe(1);
    expect(chebyshev(game.width, game.boss!.index, target)).toBe(before - 1);
    expect(game.cells.every((c) => !c.hearted)).toBe(true);
  });

  it('plants a heart that hides the number, then retargets and leaves the overlay', () => {
    const game = createGameFromLayout(
      ['B....', '.....', '*..**', '.....'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const low = idx(game, 1, 1);
    const high = idx(game, 3, 1);
    expect(game.cells[low].adjacentMines).toBe(1);
    expect(game.cells[high].adjacentMines).toBe(2);
    game.cells[low].state = 'revealed';
    game.cells[idx(game, 1, 0)].state = 'revealed';
    expect(pickLustTarget(game)).toBe(low);
    const planted = stepBoss(game);
    expect(game.boss?.index).toBe(low);
    expect(game.cells[low].hearted).toBe(true);
    expect(planted.some((e) => e.type === 'boss-plant-heart' && e.index === low)).toBe(true);

    game.cells[high].state = 'revealed';
    game.cells[idx(game, 2, 1)].state = 'revealed';
    expect(game.cells[high].adjacentMines).toBeGreaterThan(game.cells[low].adjacentMines);
    expect(pickLustTarget(game)).toBe(high);
    const left = stepBoss(game);
    expect(left).toEqual([{ type: 'boss-move', index: expect.any(Number) }]);
    expect(game.boss?.index).not.toBe(high);
    expect(game.cells[low].hearted).toBe(true);
    expect(game.cells[high].hearted).toBe(false);
    expect(game.cells[low].adjacentMines).toBe(1);
    expect(chebyshev(game.width, game.boss!.index, high)).toBeGreaterThan(0);
  });

  it('sits on spawn with no heart until a number opens, then walks', () => {
    const game = createGameFromLayout(['B....', '.....', '....*'], 10, 'gold-pouch', undefined, 'lust');
    expect(game.cells[0].hearted).toBe(false);
    expect(pickLustTarget(game)).toBeNull();
    expect(stepBoss(game)).toEqual([]);
    expect(game.boss?.index).toBe(0);
    expect(game.cells.every((c) => !c.hearted)).toBe(true);

    const far = idx(game, 3, 1);
    expect(game.cells[far].adjacentMines).toBe(1);
    for (const i of [idx(game, 1, 0), idx(game, 2, 0), idx(game, 3, 0), far]) {
      game.cells[i].state = 'revealed';
    }
    expect(pickLustTarget(game)).toBe(far);
    const startDist = chebyshev(game.width, 0, far);
    expect(startDist).toBeGreaterThan(1);
    const moved = stepBoss(game);
    expect(moved[0]?.type).toBe('boss-move');
    expect(game.boss?.index).not.toBe(far);
    expect(game.cells[0].hearted).toBe(false);
  });

  it('tapping a heart denies and does not strip it, including when Lust is on that cell', () => {
    const game = createGameFromLayout(
      ['B....', '.....', '*..**', '.....'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const low = idx(game, 1, 1);
    game.cells[low].state = 'revealed';
    game.cells[idx(game, 1, 0)].state = 'revealed';
    stepBoss(game);
    expect(game.cells[low].hearted).toBe(true);
    expect(game.boss?.index).toBe(low);

    const onHim = dig(game, low, mulberry32(1));
    expect(onHim).toEqual([{ type: 'deny' }]);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    expect(game.cells[low].hearted).toBe(true);
    expect(game.status).toBe('playing');

    const high = idx(game, 3, 1);
    game.cells[high].state = 'revealed';
    game.cells[idx(game, 2, 1)].state = 'revealed';
    stepBoss(game);
    expect(game.boss?.index).not.toBe(low);
    expect(game.cells[low].hearted).toBe(true);
    const denied = dig(game, low, mulberry32(1));
    expect(denied).toEqual([{ type: 'deny' }]);
    expect(game.cells[low].hearted).toBe(true);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
  });

  it('tapping a boss cell does not chip; a neighboring mine blast still does', () => {
    for (const id of ['gluttony', 'wrath', 'lust'] as const) {
      const game = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, id);
      const lives = game.boss!.lives;
      const events = dig(game, game.boss!.index, mulberry32(1));
      expect(events.filter((e) => e.type === 'boss-hit')).toEqual([]);
      expect(game.boss?.lives).toBe(lives);
    }

    const game = createGameFromLayout(['*B.', '...'], 10, 'gold-pouch', undefined, 'lust');
    expect(game.boss?.index).toBe(1);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    const tap = dig(game, 1, mulberry32(1));
    expect(tap.filter((e) => e.type === 'boss-hit')).toEqual([]);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    const blasts = explodeChain(game, 0);
    expect(blasts.some((e) => e.type === 'boss-hit' && e.lives === LUST_MAX_LIVES - 1)).toBe(true);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES - 1);
    expect(game.cells[0].exploded).toBe(true);
  });

  it('a blast in Lust’s 8-ring chips him and walking beside a live mine does not', () => {
    const beside = createGameFromLayout(['B.**', '....'], 10, 'gold-pouch', undefined, 'lust');
    const mine = idx(beside, 2, 0);
    const stepCell = idx(beside, 1, 0);
    const number = idx(beside, 2, 1);
    expect(beside.cells[mine].kind).toBe('mine');
    expect(beside.cells[number].adjacentMines).toBe(2);
    beside.cells[stepCell].state = 'revealed';
    beside.cells[idx(beside, 1, 1)].state = 'revealed';
    beside.cells[number].state = 'revealed';
    const walked = stepBoss(beside);
    expect(walked).toEqual([{ type: 'boss-move', index: stepCell }]);
    expect(chebyshev(beside.width, beside.boss!.index, mine)).toBe(1);
    expect(beside.boss?.lives).toBe(LUST_MAX_LIVES);
    expect(beside.cells[mine].exploded).toBe(false);

    const game = createGameFromLayout(['*B.', '...'], 10, 'gold-pouch', undefined, 'lust');
    expect(game.boss?.index).toBe(1);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    dig(game, 0, mulberry32(1));
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES - 1);
    expect(game.cells[0].exploded).toBe(true);
  });

  it('a blast in a heart’s 8-neighborhood strips the overlay so the number shows again', () => {
    const game = createGameFromLayout(
      ['B....', '.....', '*..**', '.....'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const low = idx(game, 1, 1);
    const high = idx(game, 3, 1);
    const mine = idx(game, 0, 2);
    game.cells[low].state = 'revealed';
    game.cells[idx(game, 1, 0)].state = 'revealed';
    stepBoss(game);
    expect(game.cells[low].hearted).toBe(true);
    game.cells[high].state = 'revealed';
    game.cells[idx(game, 2, 1)].state = 'revealed';
    stepBoss(game);
    expect(game.boss?.index).not.toBe(low);
    expect(game.cells[low].hearted).toBe(true);
    const beforeLives = game.boss!.lives;
    dig(game, mine, mulberry32(1));
    expect(game.cells[mine].exploded).toBe(true);
    expect(game.cells[low].hearted).toBe(false);
    expect(game.boss?.lives).toBe(beforeLives);
  });

  it('prefers a 4 with hidden neighbors over a 5 whose entire ring is revealed', () => {
    const game = createGameFromLayout(
      ['B***.', '*....', '**..*', '..***'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const five = idx(game, 1, 1);
    expect(game.cells[five].adjacentMines).toBe(5);
    game.cells[five].state = 'revealed';
    for (const n of neighbors(game.width, game.height, five)) {
      game.cells[n].state = 'revealed';
    }
    const four = idx(game, 3, 2);
    expect(game.cells[four].adjacentMines).toBe(4);
    game.cells[four].state = 'revealed';
    const target = pickLustTarget(game);
    expect(target).not.toBeNull();
    expect(target).not.toBe(five);
    expect(game.cells[target!].adjacentMines).toBe(4);
  });

  it('skips already-hearted cells when picking a new target', () => {
    const game = createGameFromLayout(
      ['B....', '.....', '*..**', '.....'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    const low = idx(game, 1, 1);
    const high = idx(game, 3, 1);
    game.cells[low].state = 'revealed';
    game.cells[idx(game, 1, 0)].state = 'revealed';
    stepBoss(game);
    expect(game.cells[low].hearted).toBe(true);
    game.cells[high].state = 'revealed';
    game.cells[idx(game, 2, 1)].state = 'revealed';
    expect(pickLustTarget(game)).toBe(high);
    expect(pickLustTarget(game)).not.toBe(low);
  });

  function heartCount(game: ReturnType<typeof createGameFromLayout>): number {
    return game.cells.filter((c) => c.hearted).length;
  }

  function plantHearts(
    game: ReturnType<typeof createGameFromLayout>,
    indices: number[],
  ): void {
    game.heartOrder = [];
    for (const i of indices) {
      game.cells[i].state = 'revealed';
      game.cells[i].hearted = true;
      game.heartOrder.push(i);
    }
  }

  /** Mine at (0,0), Lust at (1,0), a row of numbers above a mine wall. */
  function lustHeartBoard() {
    const game = createGameFromLayout(
      ['*B........', '..........', '**********'],
      10,
      'gold-pouch',
      undefined,
      'lust',
    );
    for (let x = 0; x < game.width; x++) {
      game.cells[idx(game, x, 1)].state = 'revealed';
    }
    return game;
  }

  it('at 5 lives with 5 hearts, planting a 6th recycles the oldest', () => {
    const game = lustHeartBoard();
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    const planted = [0, 1, 2, 3, 4].map((x) => idx(game, x, 1));
    plantHearts(game, planted);
    expect(heartCount(game)).toBe(5);
    const sixth = idx(game, 5, 1);
    game.boss!.index = sixth;
    expect(pickLustTarget(game)).toBe(sixth);
    const events = stepBoss(game);
    expect(events.some((e) => e.type === 'boss-plant-heart' && e.index === sixth)).toBe(true);
    expect(game.cells[planted[0]].hearted).toBe(false);
    expect(game.cells[sixth].hearted).toBe(true);
    expect(heartCount(game)).toBe(5);
    expect(game.heartOrder[0]).toBe(planted[1]);
    expect(game.heartOrder.at(-1)).toBe(sixth);
    expect(game.heartOrder).toHaveLength(5);
  });

  it('after a hit with 5 hearts, the oldest is stripped first', () => {
    const game = lustHeartBoard();
    const planted = [7, 6, 5, 4, 3].map((x) => idx(game, x, 1));
    plantHearts(game, planted);
    expect(heartCount(game)).toBe(5);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    const blasts = explodeChain(game, 0);
    expect(blasts.some((e) => e.type === 'boss-hit' && e.lives === LUST_MAX_LIVES - 1)).toBe(true);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES - 1);
    expect(heartCount(game)).toBe(4);
    expect(game.cells[planted[0]].hearted).toBe(false);
    expect(game.cells[planted[1]].hearted).toBe(true);
    expect(game.heartOrder[0]).toBe(planted[1]);
    expect(game.status).toBe('playing');
  });

  it('blast-stripped hearts drop out of plant order', () => {
    const game = lustHeartBoard();
    game.boss!.index = idx(game, 8, 1);
    const oldest = idx(game, 0, 1);
    const mid = idx(game, 4, 1);
    const newest = idx(game, 5, 1);
    plantHearts(game, [oldest, mid, newest]);
    const blasts = explodeChain(game, 0);
    expect(blasts.some((e) => e.type === 'boss-hit')).toBe(false);
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
    expect(game.cells[oldest].hearted).toBe(false);
    expect(game.cells[mid].hearted).toBe(true);
    expect(game.cells[newest].hearted).toBe(true);
    expect(game.heartOrder).toEqual([mid, newest]);
  });

  it('death clears every planted heart and leaves the corpse', () => {
    const game = lustHeartBoard();
    plantHearts(
      game,
      [3, 4, 5, 6, 7].map((x) => idx(game, x, 1)),
    );
    expect(heartCount(game)).toBe(5);
    const corpse = game.boss!.index;
    game.boss!.lives = 1;
    const events = explodeChain(game, 0);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(game.boss?.lives).toBe(0);
    expect(heartCount(game)).toBe(0);
    expect(game.cells.every((c) => !c.hearted)).toBe(true);
    expect(game.heartOrder).toEqual([]);
    expect(game.status).toBe('playing');
    expect(game.boss?.index).toBe(corpse);
  });

  it('has 5 lives while Gluttony and Wrath stay at 3', () => {
    expect(bossMaxLives('lust')).toBe(5);
    expect(bossMaxLives('gluttony')).toBe(3);
    expect(bossMaxLives('wrath')).toBe(3);
    expect(clampBossLives(5, 'lust')).toBe(5);
    expect(clampBossLives(9, 'lust')).toBe(5);
    expect(clampBossLives(5, 'gluttony')).toBe(3);
    expect(clampBossLives(5, 'wrath')).toBe(3);
    const lust = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, 'lust');
    const glut = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, 'gluttony');
    const wrath = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, 'wrath');
    expect(lust.boss?.lives).toBe(5);
    expect(glut.boss?.lives).toBe(3);
    expect(wrath.boss?.lives).toBe(3);
  });

  it('does not eat flags, smash chests, or mine-slam', () => {
    const game = createGameFromLayout(['B$.', '..*', '...'], 10, 'gem', undefined, 'lust');
    const flagCell = idx(game, 2, 0);
    toggleFlag(game, flagCell);
    const events = stepBoss(game);
    expect(events.some((e) => e.type === 'boss-eat-flag')).toBe(false);
    expect(events.some((e) => e.type === 'boss-smash-chest')).toBe(false);
    expect(events.some((e) => e.type === 'boss-slam')).toBe(false);
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
    expect(game.cells[flagCell].state).toBe('flagged');
    expect(game.boss?.lives).toBe(LUST_MAX_LIVES);
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
    const game = createGameFromLayout(['B.', '..'], 10, 'gold-pouch', undefined, 'gluttony');
    expect(game.boss?.lives).toBe(3);
    expect(bossMaxLives('gluttony')).toBe(BOSS_MAX_LIVES);
  });

  it('takes 1 life per adjacent-mine blast and dies on three hits', () => {
    const oneHit = createGameFromLayout(['*B', '..']);
    expect(oneHit.boss?.lives).toBe(BOSS_MAX_LIVES);
    dig(oneHit, 0, mulberry32(1));
    expect(oneHit.boss?.lives).toBe(BOSS_MAX_LIVES - 1);

    const finisher = createGameFromLayout(['*B.', '...']);
    finisher.boss!.lives = 1;
    dig(finisher, 0, mulberry32(1));
    expect(finisher.boss?.lives).toBe(0);
    expect(finisher.status).toBe('playing');
    expect(finisher.boss?.index).toBe(1);
    const extracted = extractGame(finisher, mulberry32(1));
    expect(extracted.some((e) => e.type === 'cleared')).toBe(true);
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

  it('losing with living Lust after all safe cells open grants nothing', () => {
    const { store } = withWallet(80);
    const s = createGameStore(store);
    const game = createGameFromLayout(['B.', '*.'], 10, 'gold-pouch', undefined, 'lust');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'lust-lose',
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
    expect(s.getState().run?.game.boss?.lives).toBe(LUST_MAX_LIVES);
    expect(allSafeRevealed(s.getState().run!.game)).toBe(true);
    expect(isLost(s.getState().run!.game)).toBe(true);
    expect(s.getState().run?.campaignStash?.gold).toBe(0);
    expect(s.getState().meta.gold).toBe(80);
    expect(loadCollection(store).items['lust-head']).toBe(0);
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
    const rng = seqRng([0.9, 0.9, 0.9, 0.9]);
    const events = killBoss(s, rng);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.game.status).toBe('playing');
    expect(loadCollection(store).items['gluttony-head']).toBe(1);
    const extracted = extractThroughDoor(s, rng);
    expect(extracted.some((e) => e.type === 'cleared')).toBe(true);
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

  it('killing Lust grants lust-head and does not grant other heads', () => {
    const { store } = withWallet(4);
    const s = createGameStore(store);
    const game = createGameFromLayout(['*B*.', '***.', '....', '....'], 10, 'gold-pouch', undefined, 'lust');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'lust-win',
        campaignStash: { gold: 8, items: emptyInventory() },
        bonusKey: null,
        bossRevealPending: false,
      },
      runLoot: emptyInventory(),
    });
    const rng = seqRng([0.9, 0.9]);
    let death = false;
    for (let hit = 0; hit < LUST_MAX_LIVES + 2; hit++) {
      const g = s.getState().run?.game;
      if (!g || g.boss?.lives === 0) break;
      const mine = g.cells.findIndex((c) => c.kind === 'mine' && !c.exploded);
      if (mine < 0) break;
      const events = s.getState().applyDig(mine, rng);
      if (events.some((e) => e.type === 'boss-death')) {
        death = true;
        break;
      }
    }
    expect(death).toBe(true);
    expect(s.getState().run?.game.status).toBe('playing');
    expect(loadCollection(store).items['lust-head']).toBe(0);
    extractThroughDoor(s, rng);
    expect(s.getState().run?.game.status).toBe('cleared');
    const paid = loadCollection(store);
    expect(paid.items['lust-head']).toBe(1);
    expect(paid.items['gluttony-head']).toBe(0);
    expect(paid.items['wrath-head']).toBe(0);
    expect(paid.gold).toBe(12);
  });

  it('auto-extract on a complete dead-boss board grants the head without a door tap', () => {
    const { store } = withWallet(4);
    const s = createGameStore(store);
    const game = createGameFromLayout(['B*$.', '....'], 10, 'gold-pouch', undefined, 'lust');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'lust-auto-extract',
        campaignStash: { gold: 8, items: emptyInventory() },
        bonusKey: null,
        bossRevealPending: false,
      },
      runLoot: emptyInventory(),
    });
    const rng = seqRng([0.9, 0.9]);
    game.boss!.lives = 1;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind === 'empty') game.cells[i].state = 'revealed';
    }
    const mine = game.cells.findIndex((c) => c.kind === 'mine');
    const events = s.getState().applyDig(mine, rng);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    expect(s.getState().run?.game.status).toBe('cleared');
    const paid = loadCollection(store);
    expect(paid.items['lust-head']).toBe(1);
    expect(paid.gold).toBe(12);
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
    const rng = seqRng([0.1, 0.2]);
    const events = killBoss(s, rng);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.game.status).toBe('playing');
    extractThroughDoor(s, rng);
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
    expect(game.boss?.lives).toBe(bossMaxLives(game.boss!.id));
    expect(['gluttony', 'wrath', 'lust']).toContain(game.boss?.id);
    const cell = game.cells[game.boss!.index];
    expect(cell.state).toBe('revealed');
    expect(cell.kind).toBe('empty');
    expect(cell.kind).not.toBe('mine');
    expect(cell.kind).not.toBe('chest');
  });

  it('can roll Lust with 5 lives on a generated finale board', () => {
    let found = false;
    for (let seed = 0; seed < 120; seed++) {
      const game = createGame(configFor('campaign', 4), mulberry32(seed));
      if (game.boss?.id === 'lust') {
        expect(game.boss.lives).toBe(LUST_MAX_LIVES);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('finale door extract', () => {
  it('never places the door on a mine, number, chest, or the boss spawn', () => {
    for (let seed = 0; seed < 40; seed++) {
      const game = createGame(configFor('campaign', 4), mulberry32(seed));
      expect(game.doorIndex).not.toBeNull();
      const door = game.cells[game.doorIndex!];
      expect(door.kind).toBe('empty');
      expect(door.adjacentMines).toBe(0);
      expect(game.doorIndex).not.toBe(game.boss?.index);
    }
    const easy = createGame(configFor('easy', 0), mulberry32(1), 'easy');
    expect(easy.doorIndex).toBeNull();
    const floor0 = createGame(configFor('campaign', 0), mulberry32(1), 'campaign');
    expect(floor0.boss).toBeNull();
    expect(floor0.doorIndex).toBeNull();
  });

  it('prefers an empty zero off the spawn ring', () => {
    const game = createGameFromLayout(['B...', '....', '....', '...*']);
    expect(game.doorIndex).not.toBeNull();
    expect(game.cells[game.doorIndex!].adjacentMines).toBe(0);
    expect(chebyshev(game.width, game.boss!.index, game.doorIndex!)).toBeGreaterThan(1);
  });

  it('boss death does not clear; extract needs the door and a dead boss', () => {
    const game = createGameFromLayout(['*B*.', '***.', '....', '....'], 10, 'gold-pouch', undefined, 'lust');
    const door = game.doorIndex;
    expect(door).not.toBeNull();
    const corpse = game.boss!.index;
    game.cells[door!].state = 'revealed';
    expect(dig(game, door!, mulberry32(1))).toEqual([{ type: 'deny' }]);
    expect(game.status).toBe('playing');

    blastUntilDead(game);
    expect(game.boss?.lives).toBe(0);
    expect(game.status).toBe('playing');
    expect(game.boss?.index).toBe(corpse);
    expect(game.cells.some((c) => c.kind !== 'mine' && c.state === 'hidden')).toBe(true);
    expect(dig(game, door!, mulberry32(1))).toEqual([{ type: 'extract-prompt' }]);
    expect(game.status).toBe('playing');
    const extracted = extract(game, 'campaign');
    expect(extracted.some((e) => e.type === 'cleared')).toBe(true);
    expect(game.status).toBe('cleared');
  });

  it('extracts immediately when the boss is dead and every safe cell is already open', () => {
    const game = createGameFromLayout(['*B*.', '***.', '....', '....'], 10, 'gold-pouch', undefined, 'lust');
    const door = game.doorIndex!;
    const corpse = game.boss!.index;
    blastUntilDead(game);
    expect(game.boss?.lives).toBe(0);
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind !== 'mine') game.cells[i].state = 'revealed';
    }
    const events = dig(game, door, mulberry32(1), 'campaign');
    expect(events.some((e) => e.type === 'extract-prompt')).toBe(false);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    expect(game.status).toBe('cleared');
    expect(game.boss?.index).toBe(corpse);
  });

  it('open-all-safe after the boss is dead auto-extracts without a door tap', () => {
    const game = createGameFromLayout(['*B*.', '***.', '....', '....'], 10, 'gold-pouch', undefined, 'lust');
    const corpse = game.boss!.index;
    const door = game.doorIndex!;
    blastUntilDead(game);
    expect(game.boss?.lives).toBe(0);
    let last: GameEvent[] = [];
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind !== 'mine' && game.cells[i].state === 'hidden') {
        last = dig(game, i, mulberry32(1), 'campaign');
      }
    }
    expect(allSafeRevealed(game)).toBe(true);
    expect(game.status).toBe('cleared');
    expect(last.some((e) => e.type === 'cleared')).toBe(true);
    expect(last.some((e) => e.type === 'extract-prompt')).toBe(false);
    expect(isLost(game)).toBe(false);
    expect(game.boss?.index).toBe(corpse);
    expect(dig(game, door, mulberry32(1), 'campaign')).toEqual([]);
  });

  it('a killing blast that also finishes the board auto-extracts', () => {
    const game = createGameFromLayout(['B*$.', '....'], 10, 'gold-pouch', undefined, 'lust');
    game.boss!.lives = 1;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].kind === 'empty') game.cells[i].state = 'revealed';
    }
    const mine = game.cells.findIndex((c) => c.kind === 'mine');
    expect(allSafeRevealed(game)).toBe(false);
    const events = dig(game, mine, mulberry32(1), 'campaign');
    expect(game.boss?.lives).toBe(0);
    expect(allSafeRevealed(game)).toBe(true);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    expect(events.some((e) => e.type === 'extract-prompt')).toBe(false);
    expect(game.status).toBe('cleared');
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
