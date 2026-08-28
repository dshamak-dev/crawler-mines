import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_FLOORS,
  DIFFICULTIES,
  chestsRemaining,
  createGame,
  createGameFromLayout,
  dig,
  explodeChain,
  isWon,
  mineCount,
  mulberry32,
  neighbors,
  toggleFlag,
} from '../src/engine';

function idx(game: { width: number }, x: number, y: number): number {
  return y * game.width + x;
}

function revealAllSafe(game: ReturnType<typeof createGameFromLayout>): void {
  const rng = mulberry32(1);
  for (let i = 0; i < game.cells.length; i++) {
    const c = game.cells[i];
    if (c.kind !== 'mine' && c.state === 'hidden') dig(game, i, rng);
  }
}

describe('board generation', () => {
  it('places the requested mines, chests, and dimensions', () => {
    const rng = mulberry32(42);
    const game = createGame(DIFFICULTIES.easy, rng);
    expect(game.width).toBe(8);
    expect(game.height).toBe(8);
    expect(game.cells).toHaveLength(64);
    expect(mineCount(game)).toBe(8);
    expect(game.cells.filter((c) => c.kind === 'chest')).toHaveLength(6);
    expect(game.cells.filter((c) => c.kind === 'empty')).toHaveLength(50);
  });

  it('never stacks a mine on a chest', () => {
    const rng = mulberry32(99);
    const game = createGame(DIFFICULTIES.hard, rng);
    for (const c of game.cells) {
      expect(c.kind === 'mine' && c.gold > 0).toBe(false);
    }
    expect(mineCount(game)).toBe(DIFFICULTIES.hard.mines);
    expect(game.cells.every((c) => c.kind !== 'mine' || c.loot === null)).toBe(true);
  });

  it('computes adjacency as the count of neighboring mines', () => {
    const game = createGameFromLayout(['.*.', '.$.', '...']);
    // chest at (1,1) has mines: (1,0) only -> 1
    expect(game.cells[idx(game, 1, 1)].adjacentMines).toBe(1);
    expect(game.cells[idx(game, 0, 0)].adjacentMines).toBe(1);
    expect(game.cells[idx(game, 2, 2)].adjacentMines).toBe(0);
  });

  it('lists campaign floors with rising mine density', () => {
    const densities = CAMPAIGN_FLOORS.map(
      (f) => f.mines / (f.width * f.height),
    );
    for (let i = 1; i < densities.length; i++) {
      expect(densities[i]).toBeGreaterThan(densities[i - 1]);
    }
    expect(CAMPAIGN_FLOORS[CAMPAIGN_FLOORS.length - 1].chests).toBeGreaterThan(
      CAMPAIGN_FLOORS[0].chests,
    );
  });
});

describe('first-click safety', () => {
  it('relocates a mine under the first tap so the cell is safe', () => {
    const rng = mulberry32(7);
    const game = createGame(DIFFICULTIES.easy, rng);
    const mineAt = game.cells.findIndex((c) => c.kind === 'mine');
    expect(mineAt).toBeGreaterThanOrEqual(0);
    const beforeMines = mineCount(game);
    const events = dig(game, mineAt, rng);
    expect(game.cells[mineAt].kind).not.toBe('mine');
    expect(game.cells[mineAt].exploded).toBe(false);
    expect(mineCount(game)).toBe(beforeMines);
    expect(events.some((e) => e.type === 'explode')).toBe(false);
    expect(game.firstClickDone).toBe(true);
  });

  it('does not relocate on later taps — a later mine detonates', () => {
    const game = createGameFromLayout(['...', '.*.', '...']);
    const events = dig(game, idx(game, 1, 1), mulberry32(1));
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(game.cells[idx(game, 1, 1)].exploded).toBe(true);
    expect(game.status).not.toBeUndefined();
  });
});

describe('flood fill', () => {
  it('reveals contiguous zero-adjacent cells and their rim', () => {
    const game = createGameFromLayout([
      '.....',
      '.....',
      '....*',
      '.....',
      '.....',
    ]);
    dig(game, idx(game, 0, 0), mulberry32(1));
    // the mine stays hidden
    expect(game.cells[idx(game, 4, 2)].state).toBe('hidden');
    expect(game.cells[idx(game, 4, 2)].kind).toBe('mine');
    // zeros and numbers around the opening are revealed; cells next to the mine show numbers
    expect(game.cells[idx(game, 0, 0)].state).toBe('revealed');
    expect(game.cells[idx(game, 3, 2)].state).toBe('revealed');
    expect(game.cells[idx(game, 3, 2)].adjacentMines).toBe(1);
  });

  it('finds a chest on a zero-adjacent flood without granting inner loot yet', () => {
    const game = createGameFromLayout(['.$...', '.....', '....*'], 25);
    dig(game, idx(game, 0, 0), mulberry32(1));
    const chest = game.cells[idx(game, 1, 0)];
    expect(chest.state).toBe('revealed');
    expect(chest.wrecked).toBe(false);
    expect(game.chestsOpened).toBe(1);
    if (game.status !== 'cleared') {
      expect(game.gold).toBe(0);
      expect(game.inventory['gold-pouch']).toBe(0);
    }
  });
});

describe('flags', () => {
  it('toggles flags on hidden cells and ignores revealed ones', () => {
    const game = createGameFromLayout(['.$', '*.']);
    expect(toggleFlag(game, 0)).toBe(true);
    expect(game.cells[0].state).toBe('flagged');
    expect(toggleFlag(game, 0)).toBe(true);
    expect(game.cells[0].state).toBe('hidden');
    dig(game, idx(game, 1, 0), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].state).toBe('revealed');
    expect(toggleFlag(game, idx(game, 1, 0))).toBe(false);
  });

  it('does not detonate a flagged bomb until it is unflagged and dug', () => {
    const game = createGameFromLayout(['*$', '..']);
    const bomb = idx(game, 0, 0);
    toggleFlag(game, bomb);
    const blocked = dig(game, bomb, mulberry32(1));
    expect(blocked).toEqual([]);
    expect(game.cells[bomb].exploded).toBe(false);
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(false);
    toggleFlag(game, bomb);
    const events = dig(game, bomb, mulberry32(1));
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(game.cells[bomb].exploded).toBe(true);
  });
});

describe('explosion destroys neighboring loot', () => {
  it('wrecks chests in the 8-adjacent cells and they are not collectible', () => {
    const game = createGameFromLayout(
      [
        '.$',
        '.*',
        '.$',
      ],
      10,
    );
    const bomb = idx(game, 1, 1);
    const events = dig(game, bomb, mulberry32(1));
    const explode = events.find((e) => e.type === 'explode');
    expect(explode).toMatchObject({ type: 'explode', index: bomb });
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(true);
    expect(game.cells[idx(game, 1, 2)].wrecked).toBe(true);
    expect(game.cells[idx(game, 1, 0)].state).toBe('revealed');
    expect(game.gold).toBe(0);
    expect(game.chestsDestroyed).toBe(2);
    expect(game.goldDestroyed).toBe(20);
    expect(game.inventory['gold-pouch']).toBe(0);
    expect(chestsRemaining(game)).toBe(0);
  });

  it('does not destroy empty floor, number cells, or mines', () => {
    const game = createGameFromLayout([
      '...',
      '.*.',
      '...',
    ]);
    dig(game, idx(game, 1, 1), mulberry32(1));
    for (let i = 0; i < game.cells.length; i++) {
      const c = game.cells[i];
      if (c.kind === 'empty') {
        expect(c.wrecked).toBe(false);
        expect(c.state).toBe('hidden');
      }
      if (c.kind === 'mine') {
        expect(c.exploded).toBe(true);
        expect(c.wrecked).toBe(false);
      }
    }
  });

  it('wrecks a chest that was already found — loot is not safe until clear', () => {
    const game = createGameFromLayout(['.$', '*.'], 15);
    dig(game, idx(game, 1, 0), mulberry32(1));
    expect(game.chestsOpened).toBe(1);
    expect(game.gold).toBe(0);
    expect(game.inventory['gold-pouch']).toBe(0);
    dig(game, idx(game, 0, 1), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(true);
    expect(game.gold).toBe(0);
    expect(game.chestsOpened).toBe(0);
    expect(game.chestsDestroyed).toBe(1);
    expect(game.inventory['gold-pouch']).toBe(0);
  });

  it('still wrecks a flagged chest caught in a blast', () => {
    const game = createGameFromLayout(['*$'], 10);
    toggleFlag(game, idx(game, 1, 0));
    dig(game, idx(game, 0, 0), mulberry32(1));
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(true);
    expect(game.gold).toBe(0);
  });
});

describe('chain reactions', () => {
  it('detonates two adjacent bombs, each wrecking loot in its own radius', () => {
    //  * $
    //  * .
    const game = createGameFromLayout(['*$', '*.'], 10);
    const events = dig(game, idx(game, 0, 0), mulberry32(1));
    const blasts = events.filter((e) => e.type === 'explode');
    expect(blasts).toHaveLength(2);
    expect(game.cells[idx(game, 0, 0)].exploded).toBe(true);
    expect(game.cells[idx(game, 0, 1)].exploded).toBe(true);
    expect(game.cells[idx(game, 1, 0)].wrecked).toBe(true);
    expect(game.chestsDestroyed).toBe(1);
    const waves = blasts.map((e) => (e.type === 'explode' ? e.wave : -1));
    expect(Math.max(...waves) - Math.min(...waves)).toBe(1);
  });

  it('chains along a line of bombs', () => {
    const game = createGameFromLayout(['***$'], 10);
    const events = dig(game, 0, mulberry32(1));
    const blasts = events.filter((e) => e.type === 'explode');
    expect(blasts).toHaveLength(3);
    expect(game.cells[0].exploded).toBe(true);
    expect(game.cells[1].exploded).toBe(true);
    expect(game.cells[2].exploded).toBe(true);
    expect(game.cells[3].wrecked).toBe(true);
    expect(blasts.map((e) => (e.type === 'explode' ? e.wave : -1))).toEqual([
      0, 1, 2,
    ]);
  });

  it('chains into loot two steps away (not adjacent to the first bomb)', () => {
    // . * .
    // . * .
    // . . $
    const game = createGameFromLayout(['.*.', '.*.', '..$'], 10);
    const first = idx(game, 1, 0);
    const second = idx(game, 1, 1);
    const loot = idx(game, 2, 2);
    expect(neighbors(game.width, game.height, first)).not.toContain(loot);
    expect(neighbors(game.width, game.height, second)).toContain(loot);
    const events = dig(game, first, mulberry32(1));
    const firstBlast = events.find(
      (e) => e.type === 'explode' && e.index === first,
    );
    expect(firstBlast && firstBlast.type === 'explode' && firstBlast.wrecked).toEqual(
      [],
    );
    expect(game.cells[loot].wrecked).toBe(true);
    expect(game.chestsDestroyed).toBe(1);
    expect(game.cells[second].exploded).toBe(true);
  });

  it('does not re-explode already-exploded bombs (no infinite loop)', () => {
    const game = createGameFromLayout(['**', '**']);
    const first = explodeChain(game, 0);
    expect(first.filter((e) => e.type === 'explode')).toHaveLength(4);
    const again = explodeChain(game, 0);
    expect(again).toEqual([]);
    const fromOther = explodeChain(game, 3);
    expect(fromOther).toEqual([]);
    expect(game.cells.every((c) => c.kind !== 'mine' || c.exploded)).toBe(true);
  });

  it('chains into a flagged neighboring bomb', () => {
    const game = createGameFromLayout(['**', '$s'.replace('s', '.')], 10);
    toggleFlag(game, 1);
    expect(game.cells[1].state).toBe('flagged');
    dig(game, 0, mulberry32(1));
    expect(game.cells[1].exploded).toBe(true);
    expect(game.cells[idx(game, 0, 1)].wrecked).toBe(true);
  });
});

describe('win check and scoring', () => {
  it('wins when every non-bomb cell is revealed; bombs may stay covered', () => {
    const game = createGameFromLayout(['.$', '*.']);
    expect(isWon(game)).toBe(false);
    revealAllSafe(game);
    expect(isWon(game)).toBe(true);
    expect(game.status).toBe('cleared');
    expect(game.cells[idx(game, 0, 1)].state).toBe('hidden');
    expect(game.cells[idx(game, 0, 1)].kind).toBe('mine');
  });

  it('tapping a bomb never sets a lose state', () => {
    const game = createGameFromLayout(['*...', '....', '....', '...$']);
    dig(game, 0, mulberry32(1));
    expect(game.status).toBe('playing');
    expect(game.cells[0].exploded).toBe(true);
  });

  it('grants gold only for intact chests once the floor is cleared', () => {
    const game = createGameFromLayout(['.$.', '.*.'], 10, 'gold-pouch');
    dig(game, 1, mulberry32(1));
    expect(game.gold).toBe(0);
    expect(game.chestsOpened).toBe(1);
    expect(game.inventory['gold-pouch']).toBe(0);
    expect(game.status).toBe('playing');
    revealAllSafe(game);
    expect(game.status).toBe('cleared');
    expect(game.gold).toBe(10);
    expect(game.inventory['gold-pouch']).toBe(0);
    expect(game.chestsDestroyed).toBe(0);
  });

  it('wrecked chests count as revealed for the win condition', () => {
    const game = createGameFromLayout(['*$']);
    dig(game, 0, mulberry32(1));
    expect(game.cells[1].wrecked).toBe(true);
    expect(isWon(game)).toBe(true);
    expect(game.status).toBe('cleared');
  });
});
