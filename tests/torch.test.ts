import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_KEY,
  TORCH_HINT_COUNT,
  TORCH_HINT_MS,
  activeTorchHintIndices,
  applyTorchCharm,
  canUseFromPreview,
  cellVisual,
  closedMineIndices,
  createGameFromLayout,
  emptyInventory,
  flag,
  isUsable,
  loadCollection,
  loadRun,
  mulberry32,
  pickClosedMines,
  runKitOf,
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

function snapshotCells(game: ReturnType<typeof createGameFromLayout>) {
  return game.cells.map((c) => ({
    kind: c.kind,
    state: c.state,
    exploded: c.exploded,
    wrecked: c.wrecked,
  }));
}

describe('#62 torch Use', () => {
  it('marks torch usable in-run and gem never usable', () => {
    expect(isUsable('torch-charm')).toBe(true);
    expect(isUsable('gem')).toBe(false);
    expect(canUseFromPreview('torch-charm', 1)).toBe(false);
    expect(canUseFromPreview('torch-charm', 1, true)).toBe(true);
    expect(canUseFromPreview('torch-charm', 0, true)).toBe(false);
    expect(canUseFromPreview('gem', 9)).toBe(false);
    expect(canUseFromPreview('gem', 9, true)).toBe(false);
    expect(canUseFromPreview('witchcraft-bag', 1)).toBe(true);
    expect(canUseFromPreview('witchcraft-bag', 1, true)).toBe(false);
    expect(canUseFromPreview('secret-chest', 1)).toBe(true);
    expect(canUseFromPreview('secret-chest', 1, true)).toBe(false);
  });

  it('highlights two random closed mines for 3s and consumes one torch', () => {
    const game = createGameFromLayout(['*.*', '...', '*.*']);
    const before = snapshotCells(game);
    const now = 1_000;
    const next = applyTorchCharm({ ...emptyInventory(), 'torch-charm': 2 }, game, mulberry32(3), now);
    expect(next).not.toBeNull();
    expect(next!['torch-charm']).toBe(1);
    expect(game.torchHint?.until).toBe(now + TORCH_HINT_MS);
    expect(TORCH_HINT_MS).toBe(3000);
    expect(game.torchHint?.indices).toHaveLength(TORCH_HINT_COUNT);
    const hinted = activeTorchHintIndices(game, now + 1);
    expect(hinted).toHaveLength(2);
    expect(new Set(hinted).size).toBe(2);
    for (const i of hinted) {
      expect(game.cells[i].kind).toBe('mine');
      expect(game.cells[i].state).toBe('hidden');
      expect(game.cells[i].exploded).toBe(false);
    }
    expect(snapshotCells(game)).toEqual(before);
    expect(activeTorchHintIndices(game, now + TORCH_HINT_MS)).toEqual([]);
    expect(activeTorchHintIndices(game, now + TORCH_HINT_MS + 1)).toEqual([]);
  });

  it('highlights fewer than two when only one closed mine remains', () => {
    const game = createGameFromLayout(['*..', '...']);
    game.cells[0].state = 'revealed';
    game.cells[0].exploded = true;
    const closed = closedMineIndices(game);
    expect(closed).toHaveLength(0);

    const game2 = createGameFromLayout(['*.*', '...']);
    game2.cells[0].state = 'revealed';
    game2.cells[0].exploded = true;
    const next = applyTorchCharm(
      { ...emptyInventory(), 'torch-charm': 1 },
      game2,
      mulberry32(1),
      50,
    );
    expect(next!['torch-charm']).toBe(0);
    expect(game2.torchHint?.indices).toEqual([2]);
    expect(game2.cells[2].state).toBe('hidden');
  });

  it('denies and does not consume when no closed mines remain', () => {
    const game = createGameFromLayout(['*..', '...']);
    game.cells[0].state = 'revealed';
    game.cells[0].exploded = true;
    const items = { ...emptyInventory(), 'torch-charm': 3 };
    const next = applyTorchCharm(items, game, mulberry32(8), 10);
    expect(next).toBeNull();
    expect(items['torch-charm']).toBe(3);
    expect(game.torchHint).toBeNull();
  });

  it('denies when there is no torch to spend', () => {
    const game = createGameFromLayout(['*.*', '...']);
    expect(applyTorchCharm(emptyInventory(), game, mulberry32(2), 10)).toBeNull();
    expect(game.torchHint).toBeNull();
  });

  it('prefers still-hidden mines over flagged ones', () => {
    const game = createGameFromLayout(['***', '...']);
    game.cells[0].state = 'flagged';
    game.cells[2].state = 'flagged';
    expect(pickClosedMines(game, mulberry32(11), 1)).toEqual([1]);
    const next = applyTorchCharm(
      { ...emptyInventory(), 'torch-charm': 1 },
      game,
      mulberry32(11),
      20,
    );
    expect(next).not.toBeNull();
    expect(game.torchHint?.indices).toContain(1);
    expect(game.torchHint?.indices).toHaveLength(2);
    expect(game.cells[0].state).toBe('flagged');
    expect(game.cells[1].state).toBe('hidden');
    expect(game.cells[2].state).toBe('flagged');
  });

  it('fills from flagged mines when hidden mines run out', () => {
    const game = createGameFromLayout(['**.', '...']);
    game.cells[0].state = 'flagged';
    game.cells[1].state = 'flagged';
    const picked = pickClosedMines(game, mulberry32(4), 2);
    expect(new Set(picked)).toEqual(new Set([0, 1]));
  });

  it('flags a torch-hinted mine and keeps it hinted', () => {
    const game = createGameFromLayout(['*.*', '...']);
    const now = 500;
    expect(applyTorchCharm({ ...emptyInventory(), 'torch-charm': 1 }, game, mulberry32(3), now)).not.toBeNull();
    const hinted = game.torchHint!.indices[0];
    expect(game.cells[hinted].state).toBe('hidden');
    expect(cellVisual(game.cells[hinted])).toBe('hidden');
    const events = flag(game, hinted);
    expect(game.cells[hinted].state).toBe('flagged');
    expect(cellVisual(game.cells[hinted])).toBe('bomb-flagged');
    expect(activeTorchHintIndices(game, now + 1)).toContain(hinted);
    expect(events.some((e) => e.type === 'cleared' || e.type === 'lost')).toBe(false);
  });

  it('consumes from a kit inventory and does not mutate the input stack', () => {
    const store = memoryStore();
    const game = createGameFromLayout(['*.*', '...']);
    const kit = { ...emptyInventory(), 'torch-charm': 2, gem: 1 };
    const next = applyTorchCharm(kit, game, mulberry32(5), 30);
    expect(next).not.toBeNull();
    expect(next!['torch-charm']).toBe(1);
    expect(next!.gem).toBe(1);
    expect(kit['torch-charm']).toBe(2);
    expect(store.getItem(COLLECTION_KEY)).toBeNull();
  });
});

describe('#62 store Use', () => {
  it('does not spend bank torches on Easy or Medium', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 0,
        items: { 'torch-charm': 30, gem: 4 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('easy', mulberry32(9))).toBe(true);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(0);
    expect(s.getState().useTorch(mulberry32(9))).toBe(false);
    expect(s.getState().meta.items['torch-charm']).toBe(30);
    expect(s.getState().meta.items.gem).toBe(4);
    s.getState().abandon();
    expect(s.getState().start('medium', mulberry32(8))).toBe(true);
    expect(s.getState().useTorch(mulberry32(8))).toBe(false);
    expect(s.getState().meta.items['torch-charm']).toBe(30);
  });

  it('Hard: 30 bank + offer 1 → Use consumes kit, not the bank', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 30,
        items: { 'torch-charm': 30, gem: 4 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(9), ['torch-charm', null])).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(1);
    expect(s.getState().useTorch(mulberry32(9))).toBe(true);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(0);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
    expect(s.getState().meta.items.gem).toBe(4);
    const game = s.getState().run!.game;
    expect(activeTorchHintIndices(game, Date.now() + 10)).toHaveLength(2);
    for (const i of game.torchHint!.indices) {
      expect(game.cells[i].kind).toBe('mine');
      expect(game.cells[i].state).not.toBe('revealed');
    }
    expect(s.getState().useTorch(mulberry32(1))).toBe(false);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
    expect(loadCollection(store).items['torch-charm']).toBe(29);
  });

  it('Campaign offered torch Use consumes kit and cannot spend remaining bank charms', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 100,
        items: { 'torch-charm': 30 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(4), ['torch-charm', null])).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(1);
    expect(s.getState().useTorch(mulberry32(4))).toBe(true);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(0);
    expect(s.getState().useTorch(mulberry32(5))).toBe(false);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
  });

  it('denies on a cleared board with no closed mines and keeps the kit torch', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 30,
        items: { 'torch-charm': 1 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(2), ['torch-charm', null])).toBe(true);
    const game = s.getState().run!.game;
    for (const cell of game.cells) {
      if (cell.kind === 'mine') {
        cell.state = 'revealed';
        cell.exploded = true;
      }
    }
    s.setState({ run: { ...s.getState().run! } });
    expect(s.getState().useTorch(mulberry32(2))).toBe(false);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(1);
    expect(s.getState().meta.items['torch-charm']).toBe(0);
  });

  it('keeps kit and a live hint across reload until it expires', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 30,
        items: { 'torch-charm': 2 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(6), ['torch-charm', null])).toBe(true);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(1);
    expect(s.getState().useTorch(mulberry32(6))).toBe(true);
    const until = s.getState().run!.game.torchHint!.until;
    const indices = s.getState().run!.game.torchHint!.indices;
    const again = createGameStore(store);
    expect(loadRun(store).run?.game.torchHint).toEqual({ indices, until });
    expect(again.getState().run?.game.torchHint).toEqual({ indices, until });
    expect(runKitOf(again.getState().run)['torch-charm']).toBe(0);
    expect(again.getState().meta.items['torch-charm']).toBe(1);
  });

  it('Campaign kit survives nextFloor', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 100,
        items: { 'torch-charm': 30 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(3), ['torch-charm', null])).toBe(true);
    expect(s.getState().run?.floor).toBe(0);
    s.getState().nextFloor(mulberry32(3));
    expect(s.getState().run?.floor).toBe(1);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(1);
    expect(s.getState().meta.items['torch-charm']).toBe(29);
    expect(s.getState().useTorch(mulberry32(3))).toBe(true);
    expect(runKitOf(s.getState().run)['torch-charm']).toBe(0);
  });

  it('applyFlag emits cleared when every safe cell is already open', () => {
    const store = memoryStore();
    const s = createGameStore(store);
    const board = createGameFromLayout(['.$', '*.']);
    for (const c of board.cells) {
      if (c.kind !== 'mine') c.state = 'revealed';
    }
    s.setState({
      run: { mode: 'easy', floor: 0, game: board, grantKey: 'flag-clear' },
      runLoot: emptyInventory(),
    });
    const mine = board.cells.findIndex((c) => c.kind === 'mine');
    const events = s.getState().applyFlag(mine);
    expect(events.some((e) => e.type === 'cleared')).toBe(true);
    expect(s.getState().run!.game.status).toBe('cleared');
    expect(s.getState().run!.game.cells[mine].state).toBe('flagged');
  });
});

describe('#62 UI wiring', () => {
  const collection = readFileSync(resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'), 'utf8');
  const preview = readFileSync(resolve(__dirname, '../native/src/ui/ItemPreviewSheet.tsx'), 'utf8');
  const board = readFileSync(resolve(__dirname, '../native/src/ui/Board.tsx'), 'utf8');
  const route = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');

  it('wires this-run kit Use through ItemPreviewSheet and the board hint', () => {
    expect(preview).toContain('canUseFromPreview(itemId, have, inRun)');
    expect(collection).toContain('previewForItem(item.id, count, allowUse, true)');
    expect(collection).toContain('onUseTorch');
    expect(collection).toContain('onBack()');
    expect(route).toContain('useTorch');
    expect(route).toContain('onUseTorch');
    expect(route).toContain('kit={fromPlay ? run?.kit : undefined}');
    const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
    expect(play).toContain("torchCount: run.kit?.['torch-charm'] ?? 0");
    expect(board).toContain('activeTorchHintIndices');
    expect(board).toContain('Mine hint');
    expect(board).toContain('mineHint');
    expect(board).toContain('mineHintBorder');
  });

  it('shows a flag on a torch-hinted mine and keeps the hint ring', () => {
    const cellFn = board.slice(board.indexOf('const DungeonCell'), board.indexOf('function Burst'));
    const flagGlyph = cellFn.indexOf('{flagged ? (');
    const hintBomb = cellFn.indexOf('mineHint ? (');
    expect(flagGlyph).toBeGreaterThan(-1);
    expect(hintBomb).toBeGreaterThan(flagGlyph);
    expect(cellFn).toContain("<FlagIcon ember={visual === 'bomb-flagged'}");
    expect(cellFn).toContain('onFlag(index)');
    expect(cellFn).toContain('if (flagMode) onFlag(index)');
    expect(cellFn).toContain('Gesture.LongPress()');
    expect(cellFn).toContain('Flagged mine hint');
    expect(cellFn).toContain('cellStyle(visual, bossHere, bossId, door, theme, mineHint)');
    const cellView = cellFn.slice(cellFn.indexOf('<Animated.View'), cellFn.indexOf('</Animated.View>'));
    expect(cellView).not.toContain('pointerEvents');
    expect(board).toContain('hinted && { borderWidth: 2, borderColor: paint.mineHintBorder }');
  });

  it('surfaces floor-cleared or lost from onFlag the same way as dig', () => {
    const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
    const onFlag = play.slice(play.indexOf('const onFlag'), play.indexOf('const clearFx'));
    expect(onFlag).toContain('finishIfEnded(events)');
    expect(onFlag).toContain("playSfx('flag')");
    expect(onFlag.indexOf("playSfx('flag')")).toBeLessThan(onFlag.indexOf('finishIfEnded(events)'));
    const onDig = play.slice(play.indexOf('const onDig'), play.indexOf('const onExtract'));
    expect(onDig).toContain('finishIfEnded(events)');
  });
});
