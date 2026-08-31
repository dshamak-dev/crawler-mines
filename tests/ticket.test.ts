import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_COST,
  CAMPAIGN_FLOORS,
  COLLECTION_KEY,
  HARD_COST,
  confirmCopy,
  confirmLabel,
  createGameFromLayout,
  dig,
  emptyCollection,
  emptyInventory,
  loadCollection,
  mulberry32,
  quoteEntry,
  saveCollection,
  spendEntry,
  stackedEntries,
  type CollectionState,
  type GameEvent,
  type Inventory,
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

function revealAllSafe(game: ReturnType<typeof createGameFromLayout>): GameEvent[] {
  const rng = mulberry32(1);
  let last: GameEvent[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const c = game.cells[i];
    if (c.kind !== 'mine' && c.state === 'hidden') last = dig(game, i, rng);
  }
  return last;
}

describe('entry quotes', () => {
  it('Easy and Medium are free with no gold or key', () => {
    const meta = emptyCollection();
    expect(quoteEntry('easy', meta)).toMatchObject({ kind: 'free', cost: 0, keyId: null });
    expect(quoteEntry('medium', meta)).toMatchObject({ kind: 'free', cost: 0, keyId: null });
    expect(confirmLabel(quoteEntry('easy', meta))).toBe('');
  });

  it('Hard costs 30 and Campaign costs 100', () => {
    const meta = { ...emptyCollection(), gold: 200 };
    expect(quoteEntry('hard', meta)).toMatchObject({ kind: 'gold', cost: HARD_COST });
    expect(quoteEntry('campaign', meta)).toMatchObject({ kind: 'gold', cost: CAMPAIGN_COST });
    expect(confirmLabel(quoteEntry('hard', meta))).toBe('Spend 30 gold');
    expect(confirmLabel(quoteEntry('campaign', meta))).toBe('Spend 100 gold');
  });

  it('prefers a matching Hard key over gold; Campaign keys stay unsocketed', () => {
    const hard = {
      ...emptyCollection(),
      gold: 90,
      items: { ...emptyInventory(), 'hard-key': 1 },
    };
    const campaign = {
      ...emptyCollection(),
      gold: 200,
      items: { ...emptyInventory(), 'campaign-key': 2 },
    };
    expect(quoteEntry('hard', hard)).toMatchObject({
      kind: 'key',
      keyId: 'hard-key',
      keyCount: 1,
      gold: 90,
    });
    expect(quoteEntry('campaign', campaign)).toMatchObject({
      kind: 'gold',
      cost: CAMPAIGN_COST,
      keyId: null,
    });
    expect(confirmLabel(quoteEntry('hard', hard))).toBe('Use Hard key');
    expect(confirmLabel(quoteEntry('campaign', campaign))).toBe('Spend 100 gold');
    expect(quoteEntry('hard', campaign).kind).toBe('gold');
  });

  it('blocks when there is neither enough gold nor a matching key', () => {
    const meta = { ...emptyCollection(), gold: 29 };
    expect(quoteEntry('hard', meta).kind).toBe('blocked');
    expect(quoteEntry('campaign', { ...meta, gold: 99 }).kind).toBe('blocked');
    expect(confirmCopy(quoteEntry('hard', meta))).toMatch(/30 gold or a Hard key/);
  });

  it('quoting does not spend — cancel is a no-op', () => {
    const { store, meta } = withWallet(80, { 'hard-key': 1 });
    quoteEntry('hard', meta);
    quoteEntry('campaign', meta);
    expect(loadCollection(store).gold).toBe(80);
    expect(loadCollection(store).items['hard-key']).toBe(1);
  });
});

describe('spendEntry', () => {
  it('Easy and Medium leave wallet and keys untouched', () => {
    const { store, meta } = withWallet(40, { 'hard-key': 1 });
    expect(spendEntry(meta, 'easy', store)?.gold).toBe(40);
    expect(spendEntry(loadCollection(store), 'medium', store)?.items['hard-key']).toBe(1);
    expect(loadCollection(store).gold).toBe(40);
  });

  it('Hard deducts 30 gold each spend', () => {
    const { store, meta } = withWallet(80);
    const once = spendEntry(meta, 'hard', store);
    expect(once?.gold).toBe(50);
    expect(loadCollection(store).gold).toBe(50);
    const twice = spendEntry(loadCollection(store), 'hard', store);
    expect(twice?.gold).toBe(20);
    expect(loadCollection(store).gold).toBe(20);
  });

  it('Campaign deducts 100 gold once', () => {
    const { store, meta } = withWallet(130);
    expect(spendEntry(meta, 'campaign', store)?.gold).toBe(30);
    expect(loadCollection(store).gold).toBe(30);
  });

  it('consumes one Hard key and does not charge gold', () => {
    const { store, meta } = withWallet(80, { 'hard-key': 2, 'campaign-key': 1 });
    const hard = spendEntry(meta, 'hard', store);
    expect(hard?.gold).toBe(80);
    expect(hard?.items['hard-key']).toBe(1);
    const camp = spendEntry(loadCollection(store), 'campaign', store, ['campaign-key', null]);
    expect(camp?.gold).toBe(80);
    expect(camp?.items['campaign-key']).toBe(0);
    expect(loadCollection(store).items['hard-key']).toBe(1);
  });

  it('returns null and spends nothing when blocked', () => {
    const { store, meta } = withWallet(10);
    expect(spendEntry(meta, 'hard', store)).toBeNull();
    expect(loadCollection(store).gold).toBe(10);
  });
});

describe('paid start via the game store', () => {
  it('Easy start does not spend gold or keys', () => {
    const { store } = withWallet(40, { 'hard-key': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('easy', mulberry32(2))).toBe(true);
    expect(s.getState().run?.mode).toBe('easy');
    expect(s.getState().meta.gold).toBe(40);
    expect(s.getState().meta.items['hard-key']).toBe(1);
    expect(loadCollection(store).gold).toBe(40);
  });

  it('Hard deducts 30 and Campaign deducts 100 on enter', () => {
    const { store } = withWallet(150);
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(3))).toBe(true);
    expect(s.getState().meta.gold).toBe(120);
    expect(s.getState().run?.mode).toBe('hard');
    s.getState().abandon();
    expect(s.getState().start('campaign', mulberry32(4))).toBe(true);
    expect(s.getState().meta.gold).toBe(20);
    expect(s.getState().run?.mode).toBe('campaign');
    expect(loadCollection(store).gold).toBe(20);
  });

  it('uses a Hard key instead of gold when both are present', () => {
    const { store } = withWallet(90, { 'hard-key': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(5))).toBe(true);
    expect(s.getState().meta.gold).toBe(90);
    expect(s.getState().meta.items['hard-key']).toBe(0);
    expect(loadCollection(store).gold).toBe(90);
    expect(loadCollection(store).items['hard-key']).toBe(0);
  });

  it('does not start and spends nothing when blocked', () => {
    const { store } = withWallet(5);
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(6))).toBe(false);
    expect(s.getState().run).toBeNull();
    expect(s.getState().meta.gold).toBe(5);
    expect(loadCollection(store).gold).toBe(5);
  });

  it('does not refund after a wrecked paid floor or an abandon', () => {
    const { store } = withWallet(30, { 'campaign-key': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(8))).toBe(true);
    expect(s.getState().meta.gold).toBe(0);
    s.getState().abandon();
    expect(s.getState().meta.gold).toBe(0);
    expect(loadCollection(store).gold).toBe(0);
    expect(s.getState().start('campaign', mulberry32(9), ['campaign-key', null])).toBe(true);
    expect(s.getState().meta.items['campaign-key']).toBe(0);
    s.getState().abandon();
    expect(loadCollection(store).items['campaign-key']).toBe(0);
    expect(loadCollection(store).gold).toBe(0);
  });

  it('Campaign 100 covers the whole descent, not floors 2–5', () => {
    const { store } = withWallet(150);
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(10))).toBe(true);
    expect(s.getState().meta.gold).toBe(50);
    expect(s.getState().run?.floor).toBe(0);
    for (let floor = 1; floor < CAMPAIGN_FLOORS.length; floor++) {
      s.getState().nextFloor(mulberry32(10 + floor));
      expect(s.getState().run?.mode).toBe('campaign');
      expect(s.getState().run?.floor).toBe(floor);
      expect(s.getState().meta.gold).toBe(50);
      expect(loadCollection(store).gold).toBe(50);
    }
    s.getState().nextFloor(mulberry32(99));
    expect(s.getState().run).toBeNull();
    expect(s.getState().meta.gold).toBe(50);
  });

  it('reload after a paid enter does not charge again', () => {
    const { store } = withWallet(40, { 'hard-key': 1 });
    const s1 = createGameStore(store);
    expect(s1.getState().start('hard', mulberry32(11))).toBe(true);
    expect(s1.getState().meta.gold).toBe(40);
    expect(s1.getState().meta.items['hard-key']).toBe(0);
    const grantKey = s1.getState().run?.grantKey;
    expect(grantKey).toBeTruthy();

    const s2 = createGameStore(store);
    expect(s2.getState().run?.mode).toBe('hard');
    expect(s2.getState().run?.grantKey).toBe(grantKey);
    expect(s2.getState().meta.gold).toBe(40);
    expect(s2.getState().meta.items['hard-key']).toBe(0);
    expect(loadCollection(store).gold).toBe(40);
    expect(loadCollection(store).items['hard-key']).toBe(0);
  });

  it('retrying a campaign floor does not charge again', () => {
    const { store } = withWallet(100);
    const s = createGameStore(store);
    s.getState().start('campaign', mulberry32(12));
    expect(s.getState().meta.gold).toBe(0);
    s.getState().nextFloor(mulberry32(13));
    s.getState().retryFloor(mulberry32(14));
    expect(s.getState().run?.floor).toBe(1);
    expect(s.getState().meta.gold).toBe(0);
  });
});

describe('rare keys stay sealed until extract', () => {
  it('awards a Hard key only after a successful clear', () => {
    const game = createGameFromLayout(['.$.', '.*.'], 18, 'hard-key');
    dig(game, 1, mulberry32(1));
    expect(game.inventory['hard-key']).toBe(0);
    expect(game.cells[1].tier).toBe('rare');
    expect(game.cells[1].loot).toBe('hard-key');
    const last = revealAllSafe(game);
    const cleared = last.find((e) => e.type === 'cleared');
    expect(game.status).toBe('cleared');
    expect(game.inventory['hard-key']).toBe(1);
    if (!cleared || cleared.type !== 'cleared') throw new Error('expected clear');
    expect(cleared.rewards).toEqual([{ index: 1, itemId: 'hard-key', gold: 0 }]);
  });

  it('does not award a key from a wrecked rare chest', () => {
    const game = createGameFromLayout(['*$'], 10, 'campaign-key');
    const events = dig(game, 0, mulberry32(1));
    expect(game.cells[1].wrecked).toBe(true);
    expect(game.cells[1].tier).toBe('rare');
    expect(game.inventory['campaign-key']).toBe(0);
    const cleared = events.find((e) => e.type === 'cleared');
    expect(cleared && cleared.type === 'cleared' && cleared.rewards).toEqual([]);
  });

  it('banks extracted keys as collection inventory, not wallet gold', () => {
    const { store } = withWallet(12);
    const s = createGameStore(store);
    s.setState({
      meta: loadCollection(store),
    });
    const game = createGameFromLayout(['.$', '..'], 10, 'hard-key');
    revealAllSafe(game);
    expect(game.inventory['hard-key']).toBe(1);
    s.setState({
      run: {
        mode: 'easy',
        floor: 0,
        game,
        grantKey: 'key-drop',
      },
      runLoot: emptyInventory(),
    });
    const s2 = createGameStore(store);
    expect(s2.getState().meta.gold).toBe(12);
    expect(s2.getState().meta.items['hard-key']).toBe(1);
    expect(s2.getState().meta.items['gold-pouch']).toBe(0);
    expect(stackedEntries(s2.getState().meta.items).map((row) => row.item.id)).toEqual([
      'hard-key',
    ]);
    const payload = JSON.parse(store.getItem(COLLECTION_KEY) ?? '{}') as {
      gold?: number;
      items?: Record<string, number>;
    };
    expect(payload.gold).toBe(12);
    expect(payload.items?.['hard-key']).toBe(1);
    expect(payload.items?.['gold-pouch']).toBe(0);
  });
});
