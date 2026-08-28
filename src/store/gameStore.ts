import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  CAMPAIGN_FLOORS,
  bankFloor,
  cloneGame,
  configFor,
  createGame,
  defaultStore,
  dig,
  emptyInventory,
  loadCollection,
  loadRun,
  newGrantKey,
  recoverBank,
  RUN_KEY,
  toggleFlag,
  type CollectionState,
  type Difficulty,
  type GameEvent,
  type Inventory,
  type KeyStore,
  type Rng,
  type Run,
} from '../engine';

export type { FloorReport, Run } from '../engine';
export { floorReport, resumeLabel } from '../engine';

export interface GameStoreState {
  meta: CollectionState;
  run: Run | null;
  runLoot: Inventory;
  start: (mode: Difficulty, rng?: Rng) => void;
  abandon: () => void;
  nextFloor: (rng?: Rng) => void;
  retryFloor: (rng?: Rng) => void;
  applyDig: (index: number, rng?: Rng) => GameEvent[];
  applyFlag: (index: number) => GameEvent[];
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

function freshRun(mode: Difficulty, rng: Rng): Run {
  return {
    mode,
    floor: 0,
    game: createGame(configFor(mode, 0), rng),
    grantKey: newGrantKey(),
  };
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
        start: (mode, rng = Math.random) => {
          set({
            run: freshRun(mode, rng),
            runLoot: emptyInventory(),
          });
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
          set({
            run: {
              mode: 'campaign',
              floor,
              game: createGame(configFor('campaign', floor), rng),
              grantKey: newGrantKey(),
            },
          });
        },
        retryFloor: (rng = Math.random) => {
          const { run } = get();
          if (!run) return;
          set({
            run: {
              ...run,
              game: createGame(configFor(run.mode, run.floor), rng),
              grantKey: newGrantKey(),
            },
          });
        },
        applyDig: (index, rng = Math.random) => {
          const { run, meta, runLoot } = get();
          if (!run || run.game.status !== 'playing') return [];
          const game = cloneGame(run.game);
          const events = dig(game, index, rng);
          let nextMeta = meta;
          let nextLoot = runLoot;
          const cleared = events.find((e) => e.type === 'cleared');
          if (cleared && cleared.type === 'cleared') {
            const banked = bankFloor(meta, runLoot, cleared.rewards, run.grantKey, keyStore);
            nextMeta = banked.meta;
            nextLoot = banked.runLoot;
          }
          set({
            run: { ...run, game },
            meta: nextMeta,
            runLoot: nextLoot,
          });
          return events;
        },
        applyFlag: (index) => {
          const { run } = get();
          if (!run || run.game.status !== 'playing') return [];
          const game = cloneGame(run.game);
          toggleFlag(game, index);
          set({ run: { ...run, game } });
          return [];
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
