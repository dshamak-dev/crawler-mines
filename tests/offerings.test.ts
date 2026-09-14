import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_COST,
  CAMPAIGN_FLOORS,
  SOCKETABLE_IDS,
  bossIdFromHead,
  canSocket,
  confirmCopy,
  confirmLabel,
  createGame,
  emptyCollection,
  emptyInventory,
  isSocketable,
  loadCollection,
  loadRun,
  mulberry32,
  normalizeOfferings,
  offeringCaption,
  offeringPickerRows,
  quoteEntry,
  remainingFinaleBosses,
  resolveLockedBossId,
  rollBossId,
  runKitEntries,
  saveCollection,
  sealedRowLabel,
  sealedRunRows,
  socketedBossId,
  spendEntry,
  type CollectionState,
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

function withWallet(
  gold: number,
  items: Partial<Inventory> = {},
  store: KeyStore = memoryStore(),
): { store: KeyStore; meta: CollectionState } {
  const meta: CollectionState = {
    ...emptyCollection(),
    gold,
    items: { ...emptyInventory(), ...items },
  };
  saveCollection(meta, store);
  return { store, meta: loadCollection(store) };
}

const PACK: Partial<Inventory> = {
  'torch-charm': 2,
  gem: 1,
  'relic-shard': 3,
  'gluttony-head': 1,
  'wrath-head': 1,
  'lust-head': 1,
  'campaign-key': 1,
  'rusty-key': 4,
  'hard-key': 2,
  'gold-medal': 1,
  'bronze-medal': 1,
  'gold-cup': 1,
};

describe('#35 socketable denylist', () => {
  it('allows charms, gem, shard, heads, and campaign key; hides the rest', () => {
    expect([...SOCKETABLE_IDS]).toEqual([
      'torch-charm',
      'gem',
      'relic-shard',
      'gluttony-head',
      'wrath-head',
      'lust-head',
      'campaign-key',
    ]);
    const denied: ItemId[] = [
      'gold-pouch',
      'rusty-key',
      'hard-key',
      'bronze-medal',
      'silver-medal',
      'gold-medal',
      'gold-cup',
      'bone-dust',
      'witchcraft-bag',
      'scroll-of-portal',
    ];
    for (const id of denied) expect(isSocketable(id)).toBe(false);
    const meta = { ...emptyCollection(), items: { ...emptyInventory(), ...PACK } };
    const rows = offeringPickerRows(meta, [null, null], 0);
    expect(rows.map((r) => r.id)).toEqual([...SOCKETABLE_IDS]);
    expect(rows.some((r) => denied.includes(r.id))).toBe(false);
  });

  it('hides rows at 0 owned and counts remaining after the other well', () => {
    const meta = {
      ...emptyCollection(),
      items: { ...emptyInventory(), 'torch-charm': 1, gem: 0, 'campaign-key': 1 },
    };
    const empty = offeringPickerRows(meta, [null, null], 0);
    expect(empty.map((r) => r.id)).toEqual(['torch-charm', 'campaign-key']);
    const afterTorch = offeringPickerRows(meta, ['torch-charm', null], 1);
    expect(afterTorch.map((r) => r.id)).toEqual(['campaign-key']);
  });
});

describe('#35 gold vs key slot', () => {
  it('charges 100 gold when no campaign key is socketed, even if one is owned', () => {
    const meta = {
      ...emptyCollection(),
      gold: 150,
      items: { ...emptyInventory(), 'campaign-key': 1, 'torch-charm': 1 },
    };
    expect(quoteEntry('campaign', meta)).toMatchObject({ kind: 'gold', cost: CAMPAIGN_COST });
    expect(quoteEntry('campaign', meta, [null, null])).toMatchObject({ kind: 'gold' });
    expect(quoteEntry('campaign', meta, ['torch-charm', null])).toMatchObject({ kind: 'gold' });
    expect(confirmLabel(quoteEntry('campaign', meta, ['torch-charm', null]))).toBe('Spend 100 gold');
    expect(quoteEntry('campaign', { ...meta, gold: 99 }).kind).toBe('blocked');
    expect(quoteEntry('campaign', { ...meta, gold: 99 }, ['torch-charm', null]).kind).toBe(
      'blocked',
    );
    expect(confirmCopy(quoteEntry('campaign', { ...meta, gold: 99 }))).toMatch(
      /socket a Campaign key/,
    );
  });

  it('is a free dive when a campaign key is in either well, and does not also charge gold', () => {
    const meta = {
      ...emptyCollection(),
      gold: 40,
      items: { ...emptyInventory(), 'campaign-key': 1, 'lust-head': 1 },
    };
    expect(quoteEntry('campaign', meta).kind).toBe('blocked');
    const left = quoteEntry('campaign', meta, ['campaign-key', null]);
    const right = quoteEntry('campaign', meta, ['lust-head', 'campaign-key']);
    expect(left).toMatchObject({ kind: 'key', keyId: 'campaign-key' });
    expect(right.kind).toBe('key');
    expect(confirmLabel(left)).toBe('Dive free');
    expect(offeringCaption(['lust-head', 'campaign-key'], left)).toBe('Floor 5 · Lust · Dive free');
  });

  it('Hard key only counts when socketed, like Campaign; keys do not cross-pay', () => {
    const meta = {
      ...emptyCollection(),
      gold: 200,
      items: { ...emptyInventory(), 'hard-key': 1, 'campaign-key': 1 },
    };
    expect(quoteEntry('hard', meta).kind).toBe('gold');
    expect(quoteEntry('hard', meta, [null, null]).kind).toBe('gold');
    expect(quoteEntry('hard', meta, ['hard-key', null])).toMatchObject({
      kind: 'key',
      keyId: 'hard-key',
    });
    expect(quoteEntry('campaign', meta).kind).toBe('gold');
    expect(quoteEntry('campaign', meta, ['hard-key', null]).kind).toBe('gold');
    expect(quoteEntry('hard', meta, ['campaign-key', null]).kind).toBe('gold');
  });
});

describe('two offering heads', () => {
  it('keeps two different heads and does not grey the others in the picker', () => {
    const slots = normalizeOfferings(['lust-head', 'wrath-head']);
    expect(slots).toEqual(['lust-head', 'wrath-head']);
    expect(bossIdFromHead(slots[0])).toBe('lust');
    expect(bossIdFromHead(slots[1])).toBe('wrath');

    const meta = { ...emptyCollection(), items: { ...emptyInventory(), ...PACK } };
    const rows = offeringPickerRows(meta, ['lust-head', null], 1);
    const heads = rows.filter((r) => r.id.endsWith('-head'));
    expect(heads.map((r) => r.id)).toEqual(['gluttony-head', 'wrath-head']);
    expect(heads.every((r) => r.disabled)).toBe(false);
    expect(canSocket('wrath-head', meta, ['lust-head', null], 1)).toBe(true);
    expect(canSocket('gluttony-head', meta, ['lust-head', null], 1)).toBe(true);
    expect(canSocket('campaign-key', meta, ['lust-head', null], 1)).toBe(true);
  });

  it('keeps two of the same head when the pack has two', () => {
    const meta = {
      ...emptyCollection(),
      items: { ...emptyInventory(), 'lust-head': 2 },
    };
    expect(normalizeOfferings(['lust-head', 'lust-head'], meta)).toEqual([
      'lust-head',
      'lust-head',
    ]);
    expect(normalizeOfferings(['lust-head', 'lust-head'], {
      ...emptyCollection(),
      items: { ...emptyInventory(), 'lust-head': 1 },
    })).toEqual(['lust-head', null]);
  });
});

describe('#35 consume on enter', () => {
  it('burns every socketed item and 100 gold when no key is socketed', () => {
    const { store, meta } = withWallet(130, PACK);
    const next = spendEntry(meta, 'campaign', store, ['torch-charm', 'gem']);
    expect(next?.gold).toBe(30);
    expect(next?.items['torch-charm']).toBe(1);
    expect(next?.items.gem).toBe(0);
    expect(next?.items['campaign-key']).toBe(1);
    expect(loadCollection(store).items['relic-shard']).toBe(3);
  });

  it('burns a socketed campaign key and does not charge gold', () => {
    const { store, meta } = withWallet(80, PACK);
    const next = spendEntry(meta, 'campaign', store, ['lust-head', 'campaign-key']);
    expect(next?.gold).toBe(80);
    expect(next?.items['campaign-key']).toBe(0);
    expect(next?.items['lust-head']).toBe(0);
    expect(next?.items['torch-charm']).toBe(2);
  });

  it('leaves an unsocketed campaign key in the pack', () => {
    const { store, meta } = withWallet(100, { 'campaign-key': 1, 'torch-charm': 1 });
    const next = spendEntry(meta, 'campaign', store, ['torch-charm', null]);
    expect(next?.gold).toBe(0);
    expect(next?.items['campaign-key']).toBe(1);
    expect(next?.items['torch-charm']).toBe(0);
  });

  it('spends nothing on cancel — quoting and a blocked confirm do not burn', () => {
    const { store, meta } = withWallet(40, PACK);
    quoteEntry('campaign', meta, ['lust-head', 'campaign-key']);
    expect(spendEntry(meta, 'campaign', store, ['torch-charm', null])).toBeNull();
    const kept = loadCollection(store);
    expect(kept.gold).toBe(40);
    expect(kept.items['torch-charm']).toBe(2);
    expect(kept.items['campaign-key']).toBe(1);
  });
});

describe('#35 locked boss from a head', () => {
  it('rollBossId honors a locked id and skips the equal roll', () => {
    expect(rollBossId(() => 0.99, 'gluttony')).toBe('gluttony');
    expect(rollBossId(() => 0, 'lust')).toBe('lust');
    expect(rollBossId(() => 0)).toBe('gluttony');
  });

  it('createGame uses the locked id on a finale board', () => {
    const rng = mulberry32(1);
    const rolled = createGame(CAMPAIGN_FLOORS[4], rng, 'campaign');
    const locked = createGame(CAMPAIGN_FLOORS[4], mulberry32(1), 'campaign', 'lust');
    expect(locked.boss?.id).toBe('lust');
    expect(locked.boss?.lives).toBe(5);
    expect(['gluttony', 'wrath', 'lust']).toContain(rolled.boss?.id);
  });

  it('one head still locks floor 5, resume, and retry', () => {
    const { store } = withWallet(100, { 'lust-head': 1, 'wrath-head': 1 });
    const s1 = createGameStore(store);
    expect(s1.getState().start('campaign', mulberry32(3), ['lust-head', null])).toBe(true);
    expect(s1.getState().meta.items['lust-head']).toBe(0);
    expect(s1.getState().meta.items['wrath-head']).toBe(1);
    expect(s1.getState().meta.gold).toBe(0);
    expect(s1.getState().run?.lockedBossId).toBe('lust');
    expect(s1.getState().run?.game.boss).toBeNull();

    for (let floor = 1; floor < CAMPAIGN_FLOORS.length; floor++) {
      s1.getState().nextFloor(mulberry32(3 + floor));
    }
    expect(s1.getState().run?.floor).toBe(4);
    expect(s1.getState().run?.game.boss?.id).toBe('lust');
    expect(s1.getState().run?.lockedBossId).toBe('lust');

    const s2 = createGameStore(store);
    expect(s2.getState().run?.lockedBossId).toBe('lust');
    expect(s2.getState().run?.game.boss?.id).toBe('lust');
    expect(loadRun(store).run?.lockedBossId).toBe('lust');

    s2.getState().retryFloor(mulberry32(99));
    expect(s2.getState().run?.game.boss?.id).toBe('lust');
    expect(s2.getState().run?.lockedBossId).toBe('lust');
  });

  it('Gluttony + Wrath always locks Lust and names it on the tablet', () => {
    const slots: [ItemId, ItemId] = ['gluttony-head', 'wrath-head'];
    expect(remainingFinaleBosses(slots)).toEqual(['lust']);
    expect(socketedBossId(slots)).toBe('lust');
    expect(resolveLockedBossId(slots, () => 0.99)).toBe('lust');
    expect(resolveLockedBossId(slots, () => 0)).toBe('lust');
    const meta = {
      ...emptyCollection(),
      gold: 100,
      items: { ...emptyInventory(), 'gluttony-head': 1, 'wrath-head': 1 },
    };
    const quote = quoteEntry('campaign', meta, slots);
    expect(offeringCaption(slots, quote)).toBe('Floor 5 · Lust · 100 gold');

    const { store } = withWallet(100, { 'gluttony-head': 1, 'wrath-head': 1 });
    const s1 = createGameStore(store);
    expect(s1.getState().start('campaign', mulberry32(11), slots)).toBe(true);
    expect(s1.getState().meta.items['gluttony-head']).toBe(0);
    expect(s1.getState().meta.items['wrath-head']).toBe(0);
    expect(s1.getState().run?.lockedBossId).toBe('lust');

    for (let floor = 1; floor < CAMPAIGN_FLOORS.length; floor++) {
      s1.getState().nextFloor(mulberry32(11 + floor));
    }
    expect(s1.getState().run?.game.boss?.id).toBe('lust');
    expect(s1.getState().run?.lockedBossId).toBe('lust');

    const s2 = createGameStore(store);
    expect(s2.getState().run?.lockedBossId).toBe('lust');
    s2.getState().retryFloor(mulberry32(0));
    expect(s2.getState().run?.game.boss?.id).toBe('lust');
  });

  it('Lust + Wrath always locks Gluttony', () => {
    const slots: [ItemId, ItemId] = ['lust-head', 'wrath-head'];
    expect(remainingFinaleBosses(slots)).toEqual(['gluttony']);
    expect(resolveLockedBossId(slots, () => 0.5)).toBe('gluttony');
    const meta = {
      ...emptyCollection(),
      gold: 100,
      items: { ...emptyInventory(), 'lust-head': 1, 'wrath-head': 1, 'campaign-key': 1 },
    };
    const quote = quoteEntry('campaign', meta, ['lust-head', 'campaign-key']);
    expect(offeringCaption(['lust-head', 'campaign-key'], quote)).toBe(
      'Floor 5 · Lust · Dive free',
    );
    expect(offeringCaption(slots, quoteEntry('campaign', meta, slots))).toBe(
      'Floor 5 · Gluttony · 100 gold',
    );

    const { store } = withWallet(100, { 'lust-head': 1, 'wrath-head': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(12), slots)).toBe(true);
    expect(s.getState().run?.lockedBossId).toBe('gluttony');
    for (let floor = 1; floor < CAMPAIGN_FLOORS.length; floor++) {
      s.getState().nextFloor(mulberry32(12 + floor));
    }
    expect(s.getState().run?.game.boss?.id).toBe('gluttony');
  });

  it('two of the same head never pick that boss and do not name it', () => {
    const slots: [ItemId, ItemId] = ['lust-head', 'lust-head'];
    expect(remainingFinaleBosses(slots)).toEqual(['gluttony', 'wrath']);
    expect(socketedBossId(slots)).toBeNull();
    expect(resolveLockedBossId(slots, () => 0)).toBe('gluttony');
    expect(resolveLockedBossId(slots, () => 0.99)).toBe('wrath');
    for (let i = 0; i < 40; i++) {
      const id = resolveLockedBossId(slots, () => i / 40);
      expect(id).not.toBe('lust');
      expect(['gluttony', 'wrath']).toContain(id);
    }
    const meta = {
      ...emptyCollection(),
      gold: 100,
      items: { ...emptyInventory(), 'lust-head': 2 },
    };
    expect(offeringCaption(slots, quoteEntry('campaign', meta, slots))).toBe('Floor 5 · 100 gold');

    const { store } = withWallet(100, { 'lust-head': 2 });
    const s1 = createGameStore(store);
    expect(s1.getState().start('campaign', mulberry32(13), slots)).toBe(true);
    expect(s1.getState().meta.items['lust-head']).toBe(0);
    const locked = s1.getState().run?.lockedBossId;
    expect(locked === 'gluttony' || locked === 'wrath').toBe(true);
    expect(locked).not.toBe('lust');

    for (let floor = 1; floor < CAMPAIGN_FLOORS.length; floor++) {
      s1.getState().nextFloor(mulberry32(13 + floor));
    }
    expect(s1.getState().run?.game.boss?.id).toBe(locked);
    expect(s1.getState().run?.lockedBossId).toBe(locked);

    const s2 = createGameStore(store);
    expect(s2.getState().run?.lockedBossId).toBe(locked);
    s2.getState().retryFloor(mulberry32(1));
    expect(s2.getState().run?.game.boss?.id).toBe(locked);
  });

  it('socketed torch/gem/shard burn with no extra board effect', () => {
    const { store } = withWallet(100, { 'torch-charm': 1, gem: 1, 'relic-shard': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(4), ['torch-charm', 'relic-shard'])).toBe(
      true,
    );
    expect(s.getState().meta.items['torch-charm']).toBe(0);
    expect(s.getState().meta.items['relic-shard']).toBe(0);
    expect(s.getState().meta.items.gem).toBe(1);
    expect(s.getState().run?.mode).toBe('campaign');
    expect(s.getState().run?.lockedBossId).toBeNull();
    expect(s.getState().run?.game.boss).toBeNull();
  });
});

describe('#35 README', () => {
  it('notes campaign offering wells and the two-head finale rules', () => {
    const readme = readFileSync(resolve('README.md'), 'utf8');
    expect(readme).toMatch(/offering wells/);
    expect(readme).toMatch(/Campaign key/);
    expect(readme).toMatch(/boss head/);
    expect(readme).toMatch(/gold cups/);
    expect(readme).toMatch(/Two heads are allowed/);
    expect(readme).toMatch(/Gluttony \+ Wrath → Lust/);
    expect(readme).not.toMatch(/At most one head/);
  });
});

describe('#65 Hard offering enter', () => {
  it('Hard picker is torch/gem/shard/Hard key; no heads or Campaign key', () => {
    const meta = { ...emptyCollection(), items: { ...emptyInventory(), ...PACK } };
    const rows = offeringPickerRows(meta, [null, null], 0, 'hard');
    expect(rows.map((r) => r.id)).toEqual(['torch-charm', 'gem', 'relic-shard', 'hard-key']);
    expect(canSocket('lust-head', meta, [null, null], 0, 'hard')).toBe(false);
    expect(canSocket('campaign-key', meta, [null, null], 0, 'hard')).toBe(false);
    expect(canSocket('hard-key', meta, [null, null], 0, 'hard')).toBe(true);
    expect(canSocket('hard-key', meta, [null, null], 0, 'campaign')).toBe(false);
    expect(normalizeOfferings(['lust-head', 'hard-key'], meta, 'hard')).toEqual([
      null,
      'hard-key',
    ]);
    expect(normalizeOfferings(['campaign-key', 'torch-charm'], meta, 'hard')).toEqual([
      null,
      'torch-charm',
    ]);
    expect(isSocketable('hard-key')).toBe(false);
  });

  it('socketed Hard key is a free enter; unsocketed Hard key stays and gold is charged', () => {
    const { store, meta } = withWallet(90, { 'hard-key': 1, 'torch-charm': 1 });
    const gold = spendEntry(meta, 'hard', store, ['torch-charm', null]);
    expect(gold?.gold).toBe(60);
    expect(gold?.items['hard-key']).toBe(1);
    expect(gold?.items['torch-charm']).toBe(0);

    const { store: keys, meta: keyed } = withWallet(90, { 'hard-key': 2, 'torch-charm': 1 });
    const free = spendEntry(keyed, 'hard', keys, ['hard-key', 'torch-charm']);
    expect(free?.gold).toBe(90);
    expect(free?.items['hard-key']).toBe(1);
    expect(free?.items['torch-charm']).toBe(0);
    expect(quoteEntry('hard', keyed, ['hard-key', null]).kind).toBe('key');
    expect(confirmLabel(quoteEntry('hard', keyed, ['hard-key', null]))).toBe('Use Hard key');
    expect(offeringCaption(['hard-key', null], quoteEntry('hard', keyed, ['hard-key', null]))).toBe(
      'Dive free',
    );
    expect(offeringCaption(['torch-charm', null], quoteEntry('hard', meta, ['torch-charm', null]))).toBe(
      '30 gold',
    );
  });

  it('Hard start burns sockets, ignores heads, and keeps Easy/Medium offering-free', () => {
    const { store } = withWallet(30, {
      'torch-charm': 2,
      'lust-head': 1,
      'campaign-key': 1,
      gem: 1,
    });
    const s = createGameStore(store);
    expect(s.getState().start('easy', mulberry32(1), ['torch-charm', 'gem'])).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(2);
    expect(s.getState().meta.items.gem).toBe(1);
    expect(s.getState().meta.gold).toBe(30);
    s.getState().abandon();
    expect(s.getState().start('hard', mulberry32(2), ['torch-charm', 'lust-head'])).toBe(true);
    expect(s.getState().run?.mode).toBe('hard');
    expect(s.getState().run?.lockedBossId).toBeNull();
    expect(s.getState().meta.gold).toBe(0);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().meta.items['lust-head']).toBe(1);
    expect(s.getState().meta.items['campaign-key']).toBe(1);
    expect(s.getState().meta.items.gem).toBe(1);
  });

  it('Hard key start is free; cancel/blocked spend nothing', () => {
    const { store } = withWallet(10, { 'hard-key': 1, 'torch-charm': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(3), ['torch-charm', null])).toBe(false);
    expect(s.getState().run).toBeNull();
    expect(s.getState().meta.gold).toBe(10);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().start('hard', mulberry32(4), ['hard-key', null])).toBe(true);
    expect(s.getState().meta.gold).toBe(10);
    expect(s.getState().meta.items['hard-key']).toBe(0);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().run?.mode).toBe('hard');
  });
});

describe('#65 this-run kit', () => {
  it('lists remaining torches after a Hard offering burn; gems stay off the kit', () => {
    const { store } = withWallet(30, { 'torch-charm': 2, gem: 1 });
    const s = createGameStore(store);
    expect(s.getState().start('hard', mulberry32(5), ['torch-charm', null])).toBe(true);
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().meta.items.gem).toBe(1);
    const kit = runKitEntries(s.getState().meta.items);
    expect(kit.map((r) => r.item.id)).toEqual(['torch-charm']);
    expect(kit[0].count).toBe(1);
    const sealed = sealedRunRows(
      s.getState().run!.game,
      s.getState().runLoot,
      s.getState().run?.campaignStash?.gold ?? 0,
    );
    expect(sealed.every((row) => row.kind === 'chest' || row.kind === 'gold-bag')).toBe(true);
    expect(sealed.map((row) => sealedRowLabel(row).title).join(' ')).not.toMatch(/torch/i);
  });

  it('Campaign offering burn also leaves leftover torches on the kit list', () => {
    const { store } = withWallet(100, { 'torch-charm': 2, 'relic-shard': 1 });
    const s = createGameStore(store);
    expect(s.getState().start('campaign', mulberry32(6), ['torch-charm', 'relic-shard'])).toBe(
      true,
    );
    expect(s.getState().meta.items['torch-charm']).toBe(1);
    expect(s.getState().meta.items['relic-shard']).toBe(0);
    const kit = runKitEntries(s.getState().meta.items);
    expect(kit).toEqual([{ item: expect.objectContaining({ id: 'torch-charm' }), count: 1 }]);
  });
});

describe('#65 Hard offering UI', () => {
  it('reuses Campaign wells for Hard and lists kit on the in-run collection', () => {
    const title = readFileSync(resolve(__dirname, '../native/src/ui/TitleMenu.tsx'), 'utf8');
    const collection = readFileSync(
      resolve(__dirname, '../native/src/ui/CollectionScreen.tsx'),
      'utf8',
    );
    expect(title).toContain('HARD_OFFERING_COPY');
    expect(title).toContain('modeUsesOfferings');
    expect(title).toContain("pending === 'hard' ? 'Enter Hard?'");
    expect(title).not.toContain("Can't enter Hard");
    expect(title).toContain('OfferingWell');
    expect(title).toContain('offeringPickerRows(meta, slots, fillingSlot, mode)');
    expect(collection).toContain('runKitEntries');
    expect(collection).toContain('kit={meta.items}');
    expect(collection).toContain('previewForItem(item.id, count, allowUse, true)');
    expect(collection).not.toContain('This run');
    const readme = readFileSync(resolve('README.md'), 'utf8');
    expect(readme).toMatch(/Hard key/);
    expect(readme).toMatch(/no boss heads/i);
    expect(readme).toMatch(/carried kit/);
  });
});
