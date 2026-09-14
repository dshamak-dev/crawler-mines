import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  CAMPAIGN_FLOORS,
  addItem,
  allDescentPerfect,
  bankFloor,
  cloneGame,
  configFor,
  createGame,
  defaultStore,
  dig,
  emptyInventory,
  emptyPerfectFloors,
  emptyStash,
  extract,
  flag,
  headItemId,
  isCampaignFinale,
  isPerfectClear,
  loadCollection,
  loadRun,
  mergeStash,
  newGrantKey,
  normalizeOfferings,
  modeUsesOfferings,
  recoverBank,
  resolveLockedBossId,
  rollBonusKey,
  RUN_KEY,
  runStash,
  sanitizePerfectFloors,
  buyGoods,
  consumeRitual,
  normalizeRitual,
  riteFloorConfig,
  ritualLockedBossId,
  sellLoot,
  spendEntry,
  stashToRewards,
  useTorchCharm,
  type CollectionState,
  type Difficulty,
  type Game,
  type GameEvent,
  type Inventory,
  type FlagSkinId,
  type GridSkinId,
  type ItemId,
  type KeyStore,
  selectFlagSkin as persistFlagSkin,
  selectGridSkin as persistGridSkin,
  type ShopGoodId,
  type OfferingSlots,
  type Rng,
  type RitualSlots,
  type Run,
} from '../engine';

export type { FloorReport, Run } from '../engine';
export { floorReport, resumeLabel } from '../engine';

export interface GameStoreState {
  meta: CollectionState;
  run: Run | null;
  runLoot: Inventory;
  start: (mode: Difficulty, rng?: Rng, offerings?: OfferingSlots) => boolean;
  abandon: () => void;
  nextFloor: (rng?: Rng) => void;
  retryFloor: (rng?: Rng) => void;
  dismissBossReveal: () => void;
  applyDig: (index: number, rng?: Rng) => GameEvent[];
  applyFlag: (index: number, rng?: Rng) => GameEvent[];
  applyExtract: (rng?: Rng) => GameEvent[];
  sell: (itemId: ItemId, qty?: number) => boolean;
  buy: (id: ShopGoodId, qty?: number) => boolean;
  selectFlagSkin: (skinId: FlagSkinId) => boolean;
  selectGridSkin: (skinId: GridSkinId) => boolean;
  startRite: (slots: RitualSlots, rng?: Rng) => boolean;
  useTorch: (rng?: Rng) => boolean;
}

export type GameStore = UseBoundStore<StoreApi<GameStoreState>>;

function asStateStorage(store: KeyStore): StateStorage {
  return {
    getItem: (name) => store.getItem(name),
    setItem: (name, value) => {
      store.setItem(name, value);
    },
    removeItem: (name) => {
      if (store.removeItem) store.removeItem(name);
      else store.setItem(name, '');
    },
  };
}

function freshRun(
  mode: Difficulty,
  rng: Rng,
  stash = emptyStash(),
  lockedBossId: Run['lockedBossId'] = null,
): Run {
  const game = createGame(configFor(mode, 0), rng, mode, lockedBossId ?? null);
  return {
    mode,
    floor: 0,
    game,
    grantKey: newGrantKey(),
    campaignStash: stash,
    bonusKey: null,
    bossRevealPending: false,
    perfectFloors: emptyPerfectFloors(),
    lockedBossId: lockedBossId ?? null,
  };
}

function freshRiteRun(rng: Rng, lockedBossId: NonNullable<Run['lockedBossId']>): Run {
  const game = createGame(riteFloorConfig(), rng, 'campaign', lockedBossId);
  return {
    mode: 'campaign',
    floor: CAMPAIGN_FLOORS.length - 1,
    game,
    grantKey: newGrantKey(),
    campaignStash: emptyStash(),
    bonusKey: null,
    bossRevealPending: Boolean(game.boss),
    perfectFloors: emptyPerfectFloors(),
    lockedBossId,
    rite: true,
  };
}

function settleCampaign(
  run: Run,
  game: Game,
  events: GameEvent[],
  meta: CollectionState,
  runLoot: Inventory,
  rng: Rng,
  keyStore: KeyStore,
): {
  meta: CollectionState;
  runLoot: Inventory;
  campaignStash: ReturnType<typeof emptyStash>;
  bonusKey: ItemId | null;
  perfectFloors: boolean[];
} {
  const lost = events.some((e) => e.type === 'lost');
  const cleared = events.find((e) => e.type === 'cleared');
  const perfectFloors = sanitizePerfectFloors(run.perfectFloors);
  if (run.mode !== 'campaign') {
    if (cleared && cleared.type === 'cleared') {
      const banked = bankFloor(meta, runLoot, cleared.rewards, run.grantKey, keyStore);
      return {
        meta: banked.meta,
        runLoot: banked.runLoot,
        campaignStash: emptyStash(),
        bonusKey: null,
        perfectFloors,
      };
    }
    return { meta, runLoot, campaignStash: emptyStash(), bonusKey: null, perfectFloors };
  }

  if (lost) {
    return {
      meta,
      runLoot: emptyInventory(),
      campaignStash: emptyStash(),
      bonusKey: null,
      perfectFloors,
    };
  }

  if (!cleared || cleared.type !== 'cleared') {
    return {
      meta,
      runLoot,
      campaignStash: runStash(run),
      bonusKey: run.bonusKey ?? null,
      perfectFloors,
    };
  }

  if (run.floor >= 0 && run.floor < perfectFloors.length) {
    perfectFloors[run.floor] = isPerfectClear(game);
  }

  let stash = mergeStash(runStash(run), cleared.rewards);
  let bonusKey: ItemId | null = run.bonusKey ?? null;
  let nextMeta = meta;
  let nextLoot = { ...stash.items };

  if (isCampaignFinale(run.mode, run.floor)) {
    const bossId = game.boss?.id ?? 'gluttony';
    const head = headItemId(bossId);
    stash = { gold: stash.gold, items: addItem(stash.items, head) };
    bonusKey = rollBonusKey(rng);
    if (bonusKey) {
      stash = { gold: stash.gold, items: addItem(stash.items, bonusKey) };
    }
    if (!run.rite && allDescentPerfect(perfectFloors)) {
      stash = { gold: stash.gold, items: addItem(stash.items, 'gold-cup') };
    }
    nextLoot = { ...stash.items };
    const banked = bankFloor(nextMeta, emptyInventory(), stashToRewards(stash), run.grantKey, keyStore);
    nextMeta = banked.meta;
    nextLoot = banked.runLoot;
  }

  return { meta: nextMeta, runLoot: nextLoot, campaignStash: stash, bonusKey, perfectFloors };
}

export function createGameStore(keyStore: KeyStore = defaultStore()) {
  const loaded = loadRun(keyStore);
  const loadedMeta = loadCollection(keyStore);
  const recovered = recoverBank(loaded.run, loadedMeta, loaded.runLoot, keyStore);

  const store = create<GameStoreState>()(
    persist(
      (set, get) => ({
        meta: recovered.meta,
        run: loaded.run,
        runLoot: recovered.runLoot,
        start: (mode, rng = Math.random, offerings) => {
          const slots = modeUsesOfferings(mode)
            ? normalizeOfferings(offerings, get().meta, mode)
            : undefined;
          const spent = spendEntry(get().meta, mode, keyStore, slots);
          if (!spent) return false;
          const locked =
            mode === 'campaign' ? resolveLockedBossId(slots ?? [null, null], rng) : null;
          set({
            meta: spent,
            run: freshRun(mode, rng, emptyStash(), locked),
            runLoot: emptyInventory(),
          });
          return true;
        },
        abandon: () => {
          set({ run: null, runLoot: emptyInventory() });
        },
        nextFloor: (rng = Math.random) => {
          const { run } = get();
          if (!run) return;
          if (run.mode !== 'campaign' || run.floor >= CAMPAIGN_FLOORS.length - 1) {
            set({ run: null, runLoot: emptyInventory() });
            return;
          }
          const floor = run.floor + 1;
          const locked = run.lockedBossId ?? null;
          const game = createGame(configFor('campaign', floor), rng, 'campaign', locked);
          set({
            run: {
              mode: 'campaign',
              floor,
              game,
              grantKey: newGrantKey(),
              campaignStash: runStash(run),
              bonusKey: null,
              bossRevealPending: Boolean(game.boss),
              perfectFloors: sanitizePerfectFloors(run.perfectFloors),
              lockedBossId: locked,
            },
          });
        },
        retryFloor: (rng = Math.random) => {
          const { run } = get();
          if (!run) return;
          if (run.mode === 'campaign' && isCampaignFinale(run.mode, run.floor) && run.game.status !== 'playing') {
            return;
          }
          const locked = run.lockedBossId ?? null;
          const game = run.rite
            ? createGame(riteFloorConfig(), rng, 'campaign', locked)
            : createGame(configFor(run.mode, run.floor), rng, run.mode, locked);
          const perfectFloors = sanitizePerfectFloors(run.perfectFloors);
          if (run.mode === 'campaign' && run.floor >= 0 && run.floor < perfectFloors.length) {
            perfectFloors[run.floor] = false;
          }
          set({
            run: {
              ...run,
              game,
              grantKey: newGrantKey(),
              bonusKey: null,
              bossRevealPending: Boolean(game.boss),
              perfectFloors,
              lockedBossId: locked,
            },
          });
        },
        dismissBossReveal: () => {
          const { run } = get();
          if (!run || !run.bossRevealPending) return;
          set({ run: { ...run, bossRevealPending: false } });
        },
        applyDig: (index, rng = Math.random) => {
          const { run, meta, runLoot } = get();
          if (!run || run.game.status !== 'playing') return [];
          if (run.bossRevealPending) return [];
          const game = cloneGame(run.game);
          const events = dig(game, index, rng, run.mode);
          const settled = settleCampaign(run, game, events, meta, runLoot, rng, keyStore);
          set({
            run: {
              ...run,
              game,
              campaignStash: settled.campaignStash,
              bonusKey: settled.bonusKey,
              perfectFloors: settled.perfectFloors,
            },
            meta: settled.meta,
            runLoot: settled.runLoot,
          });
          return events;
        },
        applyFlag: (index, rng = Math.random) => {
          const { run, meta, runLoot } = get();
          if (!run || run.game.status !== 'playing') return [];
          if (run.bossRevealPending) return [];
          const game = cloneGame(run.game);
          const events = flag(game, index, run.mode);
          if (events.length === 0 && game.cells[index]?.state === run.game.cells[index]?.state) {
            return [];
          }
          const settled = settleCampaign(run, game, events, meta, runLoot, rng, keyStore);
          set({
            run: {
              ...run,
              game,
              campaignStash: settled.campaignStash,
              bonusKey: settled.bonusKey,
              perfectFloors: settled.perfectFloors,
            },
            meta: settled.meta,
            runLoot: settled.runLoot,
          });
          return events;
        },
        applyExtract: (rng = Math.random) => {
          const { run, meta, runLoot } = get();
          if (!run || run.game.status !== 'playing') return [];
          if (run.bossRevealPending) return [];
          const game = cloneGame(run.game);
          const events = extract(game, run.mode);
          const settled = settleCampaign(run, game, events, meta, runLoot, rng, keyStore);
          set({
            run: {
              ...run,
              game,
              campaignStash: settled.campaignStash,
              bonusKey: settled.bonusKey,
              perfectFloors: settled.perfectFloors,
            },
            meta: settled.meta,
            runLoot: settled.runLoot,
          });
          return events;
        },
        sell: (itemId, qty = 1) => {
          const next = sellLoot(get().meta, itemId, qty, keyStore);
          if (!next) return false;
          set({ meta: next });
          return true;
        },
        buy: (id, qty = 1) => {
          const next = buyGoods(get().meta, id, qty, keyStore);
          if (!next) return false;
          set({ meta: next });
          return true;
        },
        selectFlagSkin: (skinId) => {
          const next = persistFlagSkin(get().meta, skinId, keyStore);
          if (!next) return false;
          set({ meta: next });
          return true;
        },
        selectGridSkin: (skinId) => {
          const next = persistGridSkin(get().meta, skinId, keyStore);
          if (!next) return false;
          set({ meta: next });
          return true;
        },
        startRite: (slots, rng = Math.random) => {
          const next = consumeRitual(get().meta, slots, keyStore);
          if (!next) return false;
          const locked = ritualLockedBossId(normalizeRitual(slots));
          if (!locked) return false;
          set({
            meta: next,
            run: freshRiteRun(rng, locked),
            runLoot: emptyInventory(),
          });
          return true;
        },
        useTorch: (rng = Math.random) => {
          const { run, meta } = get();
          if (!run || run.game.status !== 'playing') return false;
          if (run.bossRevealPending) return false;
          const game = cloneGame(run.game);
          const next = useTorchCharm(meta, game, rng, keyStore);
          if (!next) return false;
          set({
            meta: next,
            run: { ...run, game },
          });
          return true;
        },
      }),
      {
        name: RUN_KEY,
        version: 1,
        skipHydration: true,
        storage: createJSONStorage(() => asStateStorage(keyStore)),
        partialize: (state) => ({
          run: state.run,
          runLoot: state.runLoot,
        }),
      },
    ),
  );

  if (recovered.meta !== loadedMeta || recovered.runLoot !== loaded.runLoot) {
    store.setState({ meta: recovered.meta, runLoot: recovered.runLoot });
  }

  return store;
}

export const useGameStore = createGameStore();
