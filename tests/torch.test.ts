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
  closedMineIndices,
  createGameFromLayout,
  emptyCollection,
  emptyInventory,
  isUsable,
  loadCollection,
  loadRun,
  mulberry32,
  pickClosedMines,
  useTorchCharm,
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

function packed(items: Partial<Record<ItemId, number>>, gold = 0) {
  const meta = emptyCollection();
  meta.gold = gold;
  for (const [id, n] of Object.entries(items) as Array<[ItemId, number]>) {
    meta.items[id] = n;
  }
  return meta;
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

  it('persists a consumed torch on the pack', () => {
    const store = memoryStore();
    const game = createGameFromLayout(['*.*', '...']);
    const next = useTorchCharm(packed({ 'torch-charm': 2, gem: 1 }, 7), game, mulberry32(5), store, 30);
    expect(next).not.toBeNull();
    expect(next!.items['torch-charm']).toBe(1);
    expect(next!.items.gem).toBe(1);
    expect(loadCollection(store).items['torch-charm']).toBe(1);
  });
});

describe('#62 store Use', () => {
  it('consumes from Easy kit and leaves gems alone', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 0,
        items: { 'torch-charm': 2, gem: 4 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('easy', mulberry32(9))).toBe(true);
    expect(s.getState().useTorch(mulberry32(9))).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().meta.items.gem).toBe(4);
    const game = s.getState().run!.game;
    expect(activeTorchHintIndices(game, Date.now() + 10)).toHaveLength(2);
    for (const i of game.torchHint!.indices) {
      expect(game.cells[i].kind).toBe('mine');
      expect(game.cells[i].state).not.toBe('revealed');
    }
    expect(s.getState().useTorch(mulberry32(1))).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(0);
    expect(s.getState().useTorch(mulberry32(1))).toBe(false);
    expect(loadCollection(store).items['torch-charm']).toBe(0);
  });

  it('denies on a cleared board with no closed mines', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 0,
        items: { 'torch-charm': 1 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('easy', mulberry32(2))).toBe(true);
    const game = s.getState().run!.game;
    for (const cell of game.cells) {
      if (cell.kind === 'mine') {
        cell.state = 'revealed';
        cell.exploded = true;
      }
    }
    s.setState({ run: { ...s.getState().run! } });
    expect(s.getState().useTorch(mulberry32(2))).toBe(false);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
  });

  it('keeps a live hint across reload until it expires', () => {
    const store = memoryStore({
      [COLLECTION_KEY]: JSON.stringify({
        v: 1,
        gold: 0,
        items: { 'torch-charm': 1 },
      }),
    });
    const s = createGameStore(store);
    expect(s.getState().start('medium', mulberry32(6))).toBe(true);
    expect(s.getState().useTorch(mulberry32(6))).toBe(true);
    const until = s.getState().run!.game.torchHint!.until;
    const indices = s.getState().run!.game.torchHint!.indices;
    const again = createGameStore(store);
    expect(loadRun(store).run?.game.torchHint).toEqual({ indices, until });
    expect(again.getState().run?.game.torchHint).toEqual({ indices, until });
    expect(again.getState().meta.items['torch-charm']).toBe(0);
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
    expect(board).toContain('activeTorchHintIndices');
    expect(board).toContain('Mine hint');
    expect(board).toContain('mineHint');
    expect(board).toContain('styles.mineHint');
  });
});
