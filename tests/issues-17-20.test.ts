import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_FLOORS,
  configFor,
  createGame,
  createGameFromLayout,
  dig,
  emptyInventory,
  flag,
  mulberry32,
  neighbors,
  rollPouchGold,
  sealedRowLabel,
  sealedRunRows,
  stepBoss,
  toggleFlag,
} from '../src/engine';

function idx(game: { width: number }, x: number, y: number): number {
  return y * game.width + x;
}

describe('#18 boss spawn 8-ring has no mines', () => {
  it('keeps the boss neighborhood mine-free across many seeds', () => {
    for (let seed = 0; seed < 120; seed++) {
      const game = createGame(configFor('campaign', 4), mulberry32(seed), 'campaign');
      expect(game.boss).not.toBeNull();
      const ring = neighbors(game.width, game.height, game.boss!.index);
      for (const n of ring) {
        expect(game.cells[n].kind).not.toBe('mine');
      }
    }
  });

  it('still allows adjacent-mine boss hits after the boss moves', () => {
    const game = createGameFromLayout(['*B.', '...', '...']);
    const mine = idx(game, 0, 0);
    expect(game.cells[mine].kind).toBe('mine');
    dig(game, mine, mulberry32(1));
    expect(game.boss!.lives).toBeLessThan(3);
  });
});

describe('#19 Gluttony retreats two steps after eating a flag', () => {
  it('walks up to two open cells away from the eaten flag', () => {
    const game = createGameFromLayout(['.B.F', '....']);
    const flagCell = idx(game, 3, 0);
    for (const i of [0, 2, 4, 5, 6, 7]) {
      game.cells[i].state = 'revealed';
    }
    toggleFlag(game, flagCell);
    stepBoss(game);
    expect(game.boss!.index).toBe(idx(game, 2, 0));

    const ate = stepBoss(game);
    expect(ate[0]).toEqual({ type: 'boss-eat-flag', index: flagCell });
    const retreats = ate.filter((e) => e.type === 'boss-move');
    expect(retreats).toHaveLength(2);
    expect(retreats[0]).toEqual({ type: 'boss-move', index: idx(game, 1, 0) });
    expect(retreats[1]).toEqual({ type: 'boss-move', index: idx(game, 0, 0) });
  });

  it('stops early when fewer than two retreat steps are possible', () => {
    const game = createGameFromLayout(['B..', '..*']);
    const open = idx(game, 1, 0);
    const flagCell = idx(game, 2, 0);
    dig(game, open, mulberry32(1));
    toggleFlag(game, flagCell);
    stepBoss(game);
    const ate = stepBoss(game);
    expect(ate[0].type).toBe('boss-eat-flag');
    expect(ate.filter((e) => e.type === 'boss-move').length).toBe(1);
  });
});

describe('#20 gold pouches grant 1–4 coins', () => {
  it('rolls every value in the inclusive 1–4 range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      seen.add(rollPouchGold(mulberry32(i + 50)));
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('stamps generated pouch chests with 1–4 gold', () => {
    const game = createGame(CAMPAIGN_FLOORS[0], mulberry32(77), 'campaign');
    const pouches = game.cells.filter((c) => c.loot === 'gold-pouch');
    expect(pouches.length).toBeGreaterThan(0);
    for (const c of pouches) {
      expect(c.gold).toBeGreaterThanOrEqual(1);
      expect(c.gold).toBeLessThanOrEqual(4);
    }
  });
});

describe('#17 sealed in-run collection hides inner loot', () => {
  it('shows tier shells and gold bags without item names', () => {
    const game = createGameFromLayout(['.$*', '...'], 10, 'rusty-key');
    dig(game, idx(game, 1, 0), mulberry32(1));
    dig(game, idx(game, 2, 0), mulberry32(1));
    const rows = sealedRunRows(game, emptyInventory(), 0);
    const labels = rows.map((row) => sealedRowLabel(row).title);
    expect(labels).toContain('Wooden chest');
    expect(labels.some((t) => t.includes('Rusty'))).toBe(false);
    expect(labels.some((t) => t.includes('key'))).toBe(false);
  });

  it('shows smashed chests and sealed stash tiers without inner names', () => {
    const game = createGameFromLayout(['*$'], 10, 'gem');
    dig(game, 0, mulberry32(1));
    const rows = sealedRunRows(
      game,
      { ...emptyInventory(), 'torch-charm': 2, gem: 1 },
      12,
    );
    const labels = rows.map((row) => sealedRowLabel(row).title);
    expect(labels).toContain('Iron chest');
    expect(labels).toContain('Gold bag');
    expect(labels.some((t) => t.toLowerCase().includes('gem'))).toBe(false);
    expect(labels.some((t) => t.toLowerCase().includes('torch'))).toBe(false);
  });
});

describe('#17 play HUD and hamburger menu wiring', () => {
  const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  it('removes mute and collection buttons from the play HUD', () => {
    const hudStart = appSource.indexOf('<header className="hud">');
    const hudEnd = appSource.indexOf('</header>', hudStart);
    const hud = appSource.slice(hudStart, hudEnd);
    expect(hud).not.toContain('mute-btn');
    expect(hud).not.toContain('bag-btn');
    expect(hud).not.toContain('MuteButton');
    expect(hud).toContain('MenuIcon');
    expect(hud).toContain('aria-label="Game menu"');
  });

  it('exposes Continue, Collection, Sound, and Exit run in the in-run menu', () => {
    expect(appSource).toContain('id="game-menu-title">Menu</h2>');
    expect(appSource).toContain('Continue');
    expect(appSource).toContain('Exit run');
    expect(appSource).toContain('<MuteButton variant="row"');
    expect(appSource).toContain('onExitRun');
    expect(appSource).toContain('sealed={collectionFrom === \'play\'');
  });
});
