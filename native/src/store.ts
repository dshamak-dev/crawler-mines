import { createGameStore } from '../../src/store/gameStore';
import { keyStore } from './storage';

export type { FloorReport, Run } from '../../src/store/gameStore';
export { floorReport, resumeLabel } from '../../src/store/gameStore';

export const useGameStore = createGameStore(keyStore);
