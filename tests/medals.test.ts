import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_LIVES,
  COLLECTION_KEY,
  cloneGame,
  createGameFromLayout,
  dig,
  emptyInventory,
  emptyPerfectFloors,
  emptyStash,
  explodeChain,
  floorReport,
  grantIntactLoot,
  isMedal,
  isPerfectClear,
  loadCollection,
  medalForMode,
  mulberry32,
  saveCollection,
  sellGold,
  sellLoot,
  toggleFlag,
  type Difficulty,
  type Game,
  type GameEvent,
  type Inventory,
  type ItemId,
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

function flagAllMines(game: Game): void {
  for (let i = 0; i < game.cells.length; i++) {
    if (game.cells[i].kind === 'mine' && game.cells[i].state !== 'flagged') {
      toggleFlag(game, i);
    }
  }
}

function revealAllSafe(game: Game, mode?: Difficulty): GameEvent[] {
  const rng = mulberry32(1);
  let last: GameEvent[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i];
    if (cell.kind !== 'mine' && cell.state === 'hidden') {
      last = dig(game, i, rng, mode);
    }
  }
  return last;
}

function playPerfect(game: Game, mode: Difficulty): GameEvent[] {
  flagAllMines(game);
  return revealAllSafe(game, mode);
}

function medalFromClear(events: GameEvent[]): ItemId | null {
  const cleared = events.find((e) => e.type === 'cleared');
  if (!cleared || cleared.type !== 'cleared') return null;
  const medal = cleared.rewards.find((r) => isMedal(r.itemId));
  return medal?.itemId ?? null;
}

describe('isPerfectClear lock', () => {
  it('requires every mine flagged, every flag on a mine, and no exploded cell', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    expect(isPerfectClear(game)).toBe(false);
    flagAllMines(game);
    expect(isPerfectClear(game)).toBe(true);
  });

  it('rejects zero flags when two or more mines remain unflagged', () => {
    const game = createGameFromLayout(['.*', '*$'], 10, 'gem');
    revealAllSafe(game);
    expect(game.status).toBe('cleared');
    expect(game.cells.every((c) => !c.exploded)).toBe(true);
    expect(isPerfectClear(game)).toBe(false);
  });

  it('rejects a leftover unflagged mine before the floor auto-wins', () => {
    const game = createGameFromLayout(['.*.', '.$.'], 10, 'gem');
    toggleFlag(game, 1);
    expect(isPerfectClear(game)).toBe(true);
    toggleFlag(game, 1);
    expect(isPerfectClear(game)).toBe(false);
  });

  it('rejects a flag on a safe cell', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    flagAllMines(game);
    toggleFlag(game, 0);
    expect(isPerfectClear(game)).toBe(false);
  });

  it('rejects any exploded mine, including a chained blast on a flagged mine', () => {
    const chained = createGameFromLayout(['**', '.$'], 10, 'gem');
    toggleFlag(chained, 1);
    explodeChain(chained, 0);
    expect(chained.cells[1].exploded).toBe(true);
    expect(isPerfectClear(chained)).toBe(false);

    const lone = createGameFromLayout(['*$'], 10, 'gem');
    dig(lone, 0, mulberry32(1));
    expect(lone.cells[0].exploded).toBe(true);
    expect(isPerfectClear(lone)).toBe(false);
  });

  it('does not fail for a wrecked chest when no mine exploded', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    game.cells[1].wrecked = true;
    flagAllMines(game);
    expect(game.cells.every((c) => !c.exploded)).toBe(true);
    expect(isPerfectClear(game)).toBe(true);
  });

  it('treats exactly one leftover unflagged mine as flagged after auto-win', () => {
    const game = createGameFromLayout(['.*', '*$'], 10, 'gem');
    toggleFlag(game, 1);
    revealAllSafe(game);
    expect(game.status).toBe('cleared');
    expect(isPerfectClear(game)).toBe(true);
  });

  it('does not credit two leftover unflagged mines after auto-win', () => {
    const game = createGameFromLayout(['.*', '*$'], 10, 'gem');
    revealAllSafe(game);
    expect(game.status).toBe('cleared');
    expect(isPerfectClear(game)).toBe(false);
  });

  it('counts zero flags as perfect only when the leftover mine is the only mine', () => {
    const lone = createGameFromLayout(['.$', '.*'], 10, 'gem');
    revealAllSafe(lone);
    expect(lone.status).toBe('cleared');
    expect(isPerfectClear(lone)).toBe(true);

    const two = createGameFromLayout(['.*', '*$'], 10, 'gem');
    revealAllSafe(two);
    expect(two.status).toBe('cleared');
    expect(isPerfectClear(two)).toBe(false);
  });
});

describe('perfect Easy/Medium/Hard grants the matching medal', () => {
  it.each([
    ['easy', 'bronze-medal'] as const,
    ['medium', 'silver-medal'] as const,
    ['hard', 'gold-medal'] as const,
  ])('%s awards %s and persists it', (mode, medal) => {
    expect(medalForMode(mode)).toBe(medal);
    const store = memoryStore();
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    s1.setState({
      run: { mode, floor: 0, game: cloneGame(game), grantKey: `perfect-${mode}` },
      runLoot: emptyInventory(),
    });

    const mine = game.cells.findIndex((c) => c.kind === 'mine');
    s1.getState().applyFlag(mine);
    for (let i = 0; i < game.cells.length; i++) {
      const cell = s1.getState().run?.game.cells[i];
      if (cell && cell.kind !== 'mine' && cell.state === 'hidden') {
        s1.getState().applyDig(i, mulberry32(1));
      }
    }

    const run = s1.getState().run;
    expect(run?.game.status).toBe('cleared');
    expect(run?.game.rewardsGranted).toBe(true);
    expect(run?.game.inventory[medal]).toBe(1);
    expect(s1.getState().meta.items[medal]).toBe(1);
    expect(s1.getState().runLoot[medal]).toBe(1);
    expect(loadCollection(store).items[medal]).toBe(1);

    const s2 = createGameStore(store);
    expect(s2.getState().meta.items[medal]).toBe(1);
    expect(loadCollection(store).items[medal]).toBe(1);
  });

  it('does not put medals on the chest roll table', () => {
    expect(medalFromClear(playPerfect(createGameFromLayout(['.$', '.*'], 10, 'gem'), 'easy'))).toBe(
      'bronze-medal',
    );
    const tableGame = createGameFromLayout(['.$', '.*'], 10, 'gem');
    expect(tableGame.cells.some((c) => c.loot && isMedal(c.loot))).toBe(false);
  });

  it.each([
    ['easy', 'bronze-medal'] as const,
    ['medium', 'silver-medal'] as const,
    ['hard', 'gold-medal'] as const,
  ])('%s auto-end with one leftover mine still awards %s', (mode, medal) => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    const last = revealAllSafe(cloneGame(game), mode);
    expect(medalFromClear(last)).toBe(medal);

    const store = memoryStore();
    const s1 = createGameStore(store);
    s1.setState({
      run: { mode, floor: 0, game: cloneGame(game), grantKey: `last-mine-${mode}` },
      runLoot: emptyInventory(),
    });
    for (let i = 0; i < game.cells.length; i++) {
      const cell = s1.getState().run?.game.cells[i];
      if (cell && cell.kind !== 'mine' && cell.state === 'hidden') {
        s1.getState().applyDig(i, mulberry32(1));
      }
    }
    expect(s1.getState().run?.game.status).toBe('cleared');
    expect(s1.getState().run?.game.inventory[medal]).toBe(1);
    expect(s1.getState().meta.items[medal]).toBe(1);
  });

  it('does not award a medal when two leftover mines stay unflagged', () => {
    const game = createGameFromLayout(['.*', '*$'], 10, 'gem');
    expect(medalFromClear(revealAllSafe(game, 'hard'))).toBeNull();
    expect(game.inventory['gold-medal']).toBe(0);
  });
});

describe('imperfect and campaign clears award no medal', () => {
  it('does not grant a medal when two mines are left unflagged', () => {
    const game = createGameFromLayout(['.*', '*$'], 10, 'gem');
    const last = revealAllSafe(game, 'easy');
    expect(game.status).toBe('cleared');
    expect(medalFromClear(last)).toBeNull();
    expect(game.inventory['bronze-medal']).toBe(0);
  });

  it('does not grant a medal when a safe cell is flagged', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    flagAllMines(game);
    toggleFlag(game, 0);
    revealAllSafe(game, 'hard');
    expect(isPerfectClear(game)).toBe(false);
    const rewards = grantIntactLoot(game, 'hard');
    expect(rewards.some((r) => r.itemId === 'gold-medal')).toBe(false);
    expect(game.inventory['gold-medal']).toBe(0);
  });

  it('does not grant a medal when any mine exploded', () => {
    const game = createGameFromLayout(['*$'], 10, 'gem');
    const last = dig(game, 0, mulberry32(1), 'medium');
    expect(game.cells[0].exploded).toBe(true);
    expect(game.status).toBe('cleared');
    expect(medalFromClear(last)).toBeNull();
    expect(game.inventory['silver-medal']).toBe(0);
  });

  it('never awards a medal on a campaign floor', () => {
    expect(medalForMode('campaign')).toBeNull();
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    const last = playPerfect(game, 'campaign');
    expect(game.status).toBe('cleared');
    expect(isPerfectClear(game)).toBe(true);
    expect(medalFromClear(last)).toBeNull();
    expect(game.inventory['bronze-medal']).toBe(0);
    expect(game.inventory['silver-medal']).toBe(0);
    expect(game.inventory['gold-medal']).toBe(0);
  });
});

describe('medal shop prices and stacks', () => {
  it('sells bronze / silver / gold for 3 / 14 / 20 and decrements the stack', () => {
    expect(sellGold('bronze-medal')).toBe(3);
    expect(sellGold('silver-medal')).toBe(14);
    expect(sellGold('gold-medal')).toBe(20);

    const store = memoryStore();
    const meta = {
      gold: 1,
      items: {
        ...emptyInventory(),
        'bronze-medal': 2,
        'silver-medal': 1,
        'gold-medal': 3,
      },
      lastGrantKey: null,
    };
    const bronze = sellLoot(meta, 'bronze-medal', 1, store);
    expect(bronze?.gold).toBe(4);
    expect(bronze?.items['bronze-medal']).toBe(1);
    const silver = sellLoot(bronze!, 'silver-medal', 1, store);
    expect(silver?.gold).toBe(18);
    expect(silver?.items['silver-medal']).toBe(0);
    const gold = sellLoot(silver!, 'gold-medal', 2, store);
    expect(gold?.gold).toBe(58);
    expect(gold?.items['gold-medal']).toBe(1);
    expect(loadCollection(store).gold).toBe(58);
    expect(loadCollection(store).items['gold-medal']).toBe(1);
  });
});

describe('reload cannot grant a medal twice on the same floor', () => {
  it('keeps a single medal after clear, grantIntactLoot, and hydrate', () => {
    const store = memoryStore();
    const s1 = createGameStore(store);
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    s1.setState({
      run: { mode: 'easy', floor: 0, game: cloneGame(game), grantKey: 'medal-once' },
      runLoot: emptyInventory(),
    });
    s1.getState().applyFlag(game.cells.findIndex((c) => c.kind === 'mine'));
    for (let i = 0; i < game.cells.length; i++) {
      const cell = s1.getState().run?.game.cells[i];
      if (cell && cell.kind !== 'mine' && cell.state === 'hidden') {
        s1.getState().applyDig(i, mulberry32(1));
      }
    }
    expect(s1.getState().meta.items['bronze-medal']).toBe(1);
    expect(s1.getState().run?.game.rewardsGranted).toBe(true);
    expect(grantIntactLoot(s1.getState().run!.game, 'easy')).toEqual([]);
    expect(s1.getState().run?.game.inventory['bronze-medal']).toBe(1);

    const s2 = createGameStore(store);
    expect(s2.getState().meta.items['bronze-medal']).toBe(1);
    expect(s2.getState().run?.game.rewardsGranted).toBe(true);
    expect(s2.getState().applyDig(0, mulberry32(1))).toEqual([]);
    expect(grantIntactLoot(s2.getState().run!.game, 'easy')).toEqual([]);
    expect(loadCollection(store).items['bronze-medal']).toBe(1);
    expect(JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}').items['bronze-medal']).toBe(1);
  });
});

describe('campaign gold cup', () => {
  function withWallet(gold: number, items: Partial<Inventory> = {}): KeyStore {
    const store = memoryStore();
    saveCollection(
      { gold, items: { ...emptyInventory(), ...items }, lastGrantKey: null },
      store,
    );
    return store;
  }

  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => {
      const v = values[Math.min(i, values.length - 1)] ?? 0;
      i += 1;
      return v;
    };
  }

  function killBoss(store: ReturnType<typeof createGameStore>, rng: () => number): GameEvent[] {
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

  function revealAllOnStore(s: ReturnType<typeof createGameStore>, rng: () => number): void {
    const game = s.getState().run?.game;
    if (!game) return;
    for (let i = 0; i < game.cells.length; i++) {
      const cell = s.getState().run?.game.cells[i];
      if (cell && cell.kind !== 'mine' && cell.state === 'hidden') {
        s.getState().applyDig(i, rng);
      }
    }
  }

  it('records a perfect descent floor, including last-cell auto-end, and grants no medal', () => {
    const store = withWallet(100);
    const s = createGameStore(store);
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 0,
        game: cloneGame(game),
        grantKey: 'camp-perfect-0',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: emptyPerfectFloors(),
      },
      runLoot: emptyInventory(),
    });
    revealAllOnStore(s, mulberry32(1));
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(isPerfectClear(s.getState().run!.game)).toBe(true);
    expect(s.getState().run?.perfectFloors).toEqual([true, false, false, false]);
    expect(s.getState().run?.game.inventory['bronze-medal']).toBe(0);
    expect(s.getState().run?.game.inventory['gold-cup']).toBe(0);
    expect(loadCollection(store).items['bronze-medal']).toBe(0);
    expect(loadCollection(store).items['gold-cup']).toBe(0);
  });

  it('retrying a floor clears that slot and re-evaluates the next clear', () => {
    const store = withWallet(100);
    const s = createGameStore(store);
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 2,
        game: createGameFromLayout(['.$', '.*'], 10, 'gem'),
        grantKey: 'camp-retry',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: [true, true, true, false],
      },
      runLoot: emptyInventory(),
    });
    s.getState().retryFloor(mulberry32(1));
    expect(s.getState().run?.perfectFloors).toEqual([true, true, false, false]);

    s.setState({
      run: {
        ...s.getState().run!,
        game: createGameFromLayout(['.*', '*$'], 10, 'gem'),
      },
    });
    revealAllOnStore(s, mulberry32(1));
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(s.getState().run?.perfectFloors).toEqual([true, true, false, false]);

    s.getState().retryFloor(mulberry32(2));
    s.setState({
      run: {
        ...s.getState().run!,
        game: createGameFromLayout(['.$', '.*'], 10, 'gem'),
      },
    });
    revealAllOnStore(s, mulberry32(1));
    expect(s.getState().run?.perfectFloors).toEqual([true, true, true, false]);
  });

  it('keeps perfectFloors when descending to the next floor', () => {
    const store = withWallet(100);
    const s = createGameStore(store);
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 0,
        game: createGameFromLayout(['.$', '.*'], 10, 'gem'),
        grantKey: 'camp-next',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: emptyPerfectFloors(),
      },
      runLoot: emptyInventory(),
    });
    revealAllOnStore(s, mulberry32(1));
    expect(s.getState().run?.perfectFloors).toEqual([true, false, false, false]);
    s.getState().nextFloor(mulberry32(3));
    expect(s.getState().run?.floor).toBe(1);
    expect(s.getState().run?.perfectFloors).toEqual([true, false, false, false]);
  });

  it('hydrate and resume keep perfectFloors', () => {
    const store = withWallet(100);
    const s1 = createGameStore(store);
    const marks = [true, false, true, true];
    s1.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 2,
        game: createGameFromLayout(['.$', '..'], 10, 'gem'),
        grantKey: 'camp-hydrate',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: marks,
      },
      runLoot: emptyInventory(),
    });
    const s2 = createGameStore(store);
    expect(s2.getState().run?.perfectFloors).toEqual(marks);
    expect(s2.getState().run?.floor).toBe(2);
  });

  it('grants a stacking gold-cup with the boss head when all four descent floors were perfect', () => {
    const store = withWallet(12, { 'gold-cup': 1, 'gluttony-head': 1 });
    const s = createGameStore(store);
    const game = createGameFromLayout(['*..', '.B.', '*.*'], 10, 'gold-pouch', undefined, 'gluttony');
    const stashItems = { ...emptyInventory(), 'torch-charm': 1 };
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'cup-win',
        campaignStash: { gold: 25, items: stashItems },
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: [true, true, true, true],
      },
      runLoot: { ...stashItems },
    });
    const rng = seqRng([0.9, 0.9, 0.9, 0.9]);
    const events = killBoss(s, rng);
    expect(events.some((e) => e.type === 'boss-death')).toBe(true);
    expect(s.getState().run?.game.status).toBe('playing');
    extractThroughDoor(s, rng);
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(s.getState().run?.campaignStash?.items['gold-cup']).toBe(1);
    expect(s.getState().run?.campaignStash?.items['gluttony-head']).toBe(1);
    const report = floorReport(s.getState().run!);
    expect(report.goldCup).toBe('gold-cup');
    expect(report.bossHead).toBe('gluttony-head');
    const paid = loadCollection(store);
    expect(paid.items['gold-cup']).toBe(2);
    expect(paid.items['gluttony-head']).toBe(2);
    expect(paid.items['torch-charm']).toBe(1);
    expect(paid.items['bronze-medal']).toBe(0);
    expect(paid.items['silver-medal']).toBe(0);
    expect(paid.items['gold-medal']).toBe(0);
  });

  it('does not grant a gold-cup when any descent floor was imperfect', () => {
    const store = withWallet(0);
    const s = createGameStore(store);
    const game = createGameFromLayout(['*..', '.B.', '*.*'], 10, 'gold-pouch', undefined, 'gluttony');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'cup-miss',
        campaignStash: { gold: 5, items: emptyInventory() },
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: [true, true, false, true],
      },
      runLoot: emptyInventory(),
    });
    const missRng = seqRng([0.9, 0.9]);
    killBoss(s, missRng);
    expect(s.getState().run?.game.status).toBe('playing');
    extractThroughDoor(s, missRng);
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(floorReport(s.getState().run!).goldCup).toBeNull();
    expect(loadCollection(store).items['gold-cup']).toBe(0);
    expect(loadCollection(store).items['gluttony-head']).toBe(1);
  });

  it('does not require the boss floor itself to be perfect', () => {
    const store = withWallet(0);
    const s = createGameStore(store);
    const game = createGameFromLayout(['*..', '.B.', '*.*'], 10, 'gold-pouch', undefined, 'wrath');
    s.setState({
      meta: loadCollection(store),
      run: {
        mode: 'campaign',
        floor: 4,
        game,
        grantKey: 'cup-boss-imperfect',
        campaignStash: emptyStash(),
        bonusKey: null,
        bossRevealPending: false,
        perfectFloors: [true, true, true, true],
      },
      runLoot: emptyInventory(),
    });
    const imperfectRng = seqRng([0.9, 0.9]);
    killBoss(s, imperfectRng);
    expect(s.getState().run?.game.status).toBe('playing');
    extractThroughDoor(s, imperfectRng);
    expect(s.getState().run?.game.status).toBe('cleared');
    expect(isPerfectClear(s.getState().run!.game)).toBe(false);
    expect(loadCollection(store).items['gold-cup']).toBe(1);
    expect(loadCollection(store).items['wrath-head']).toBe(1);
  });
});
