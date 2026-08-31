import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  cloneGame,
  createGameFromLayout,
  dig,
  emptyInventory,
  explodeChain,
  flag,
  grantIntactLoot,
  isMedal,
  isPerfectClear,
  loadCollection,
  medalForMode,
  mulberry32,
  sellGold,
  sellLoot,
  toggleFlag,
  type Difficulty,
  type Game,
  type GameEvent,
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

  it('rejects zero flags even when no mine has exploded', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
    revealAllSafe(game);
    expect(game.status).toBe('cleared');
    expect(game.cells.every((c) => !c.exploded)).toBe(true);
    expect(isPerfectClear(game)).toBe(false);
  });

  it('rejects a leftover unflagged mine', () => {
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
});

describe('imperfect and campaign clears award no medal', () => {
  it('does not grant a medal when a mine is left unflagged', () => {
    const game = createGameFromLayout(['.$', '.*'], 10, 'gem');
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
