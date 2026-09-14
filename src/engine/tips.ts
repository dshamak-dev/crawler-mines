import type { KeyStore } from './collection';
import { TORCH_HINT_COUNT, TORCH_HINT_MS } from './torch';
import { CAMPAIGN_COST, HARD_COST } from './ticket';

export const TIPS_KEY = 'crawler-mines-tips';
/** Pre-#63 single-shot overlay. Migrates into the first three play tips. */
export const LEGACY_TUTORIAL_KEY = 'crawler-mines-tutorial';

export const TIP_IDS = [
  'bombs-wreck-loot',
  'chain-blasts',
  'win-clear-safes',
  'dig-vs-flag',
  'chests-sealed',
  'paid-entry',
  'offerings',
  'arena-door',
  'torch-use',
] as const;

export type TipId = (typeof TIP_IDS)[number];

export type TipSurface = 'play' | 'start' | 'offerings';

export type TipNeed = 'chests' | 'arena' | 'torch';

export interface TipDef {
  id: TipId;
  title: string;
  body: string;
  surface: TipSurface;
  need?: TipNeed;
}

export interface TipWorld {
  surface: TipSurface;
  /** After a play tip is dismissed, wait for a board beat before the next. */
  holdPlay?: boolean;
  hasChests?: boolean;
  arena?: boolean;
  hasTorch?: boolean;
}

export const START_TIP_WORLD: TipWorld = { surface: 'start' };
export const OFFERING_TIP_WORLD: TipWorld = { surface: 'offerings' };

const TORCH_HINT_SECS = TORCH_HINT_MS / 1000;

export const TIPS: Record<TipId, TipDef> = {
  'bombs-wreck-loot': {
    id: 'bombs-wreck-loot',
    title: 'First descent',
    body: "Bombs don't kill you. They wreck the loot next to them.",
    surface: 'play',
  },
  'chain-blasts': {
    id: 'chain-blasts',
    title: 'Chain blasts',
    body: 'A blast sets off neighboring bombs — even flagged ones.',
    surface: 'play',
  },
  'win-clear-safes': {
    id: 'win-clear-safes',
    title: 'How to win',
    body: 'Clear every safe cell. Mines may stay covered.',
    surface: 'play',
  },
  'dig-vs-flag': {
    id: 'dig-vs-flag',
    title: 'Dig vs Flag',
    body: 'Tap to dig. Long-press or flip the toggle to flag.',
    surface: 'play',
  },
  'chests-sealed': {
    id: 'chests-sealed',
    title: 'Sealed chests',
    body: 'Chests stay sealed until you clear the floor. Blasts still smash them.',
    surface: 'play',
    need: 'chests',
  },
  'paid-entry': {
    id: 'paid-entry',
    title: 'Paid dives',
    body: `Hard costs ${HARD_COST} gold or a Hard key. Campaign costs ${CAMPAIGN_COST} gold or a Campaign key.`,
    surface: 'start',
  },
  offerings: {
    id: 'offerings',
    title: 'Offerings',
    body: 'Hard and Campaign open two wells. Socket from your pack, or pay gold. Cancel spends nothing.',
    surface: 'offerings',
  },
  'arena-door': {
    id: 'arena-door',
    title: 'Fragile exit',
    body: "A blast in the door's 8-ring wrecks the exit — instant lose.",
    surface: 'play',
    need: 'arena',
  },
  'torch-use': {
    id: 'torch-use',
    title: 'Torch Use',
    body: `From Collection, Use a torch charm to highlight ${TORCH_HINT_COUNT} closed mines for ${TORCH_HINT_SECS} seconds. Consumes one.`,
    surface: 'play',
    need: 'torch',
  },
};

/** Catalog in display / pick order. Core play first, then contextual. */
export const TIP_CATALOG: readonly TipDef[] = TIP_IDS.map((id) => TIPS[id]);

const LEGACY_SEEN: readonly TipId[] = ['bombs-wreck-loot', 'chain-blasts', 'win-clear-safes'];

export function isTipId(id: unknown): id is TipId {
  return typeof id === 'string' && (TIP_IDS as readonly string[]).includes(id);
}

export function playTipWorld(input: {
  holdPlay: boolean;
  arena: boolean;
  chests: number;
  torchCount: number;
}): TipWorld {
  return {
    surface: 'play',
    holdPlay: input.holdPlay,
    hasChests: !input.arena && input.chests > 0,
    arena: input.arena,
    hasTorch: input.torchCount > 0,
  };
}

export function pickTip(seen: Iterable<string>, world: TipWorld): TipDef | null {
  if (world.surface === 'play' && world.holdPlay) return null;
  const known = seen instanceof Set ? seen : new Set(seen);
  for (const tip of TIP_CATALOG) {
    if (known.has(tip.id)) continue;
    if (tip.surface !== world.surface) continue;
    if (tip.need === 'chests' && !world.hasChests) continue;
    if (tip.need === 'arena' && !world.arena) continue;
    if (tip.need === 'torch' && !world.hasTorch) continue;
    return tip;
  }
  return null;
}

function parseSeenList(raw: string | null): TipId[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { seen?: unknown }).seen)
        ? (data as { seen: unknown[] }).seen
        : [];
    const out: TipId[] = [];
    const used = new Set<TipId>();
    for (const id of list) {
      if (!isTipId(id) || used.has(id)) continue;
      used.add(id);
      out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}

export function orderedSeen(ids: Iterable<string>): TipId[] {
  const have = ids instanceof Set ? ids : new Set(ids);
  return TIP_IDS.filter((id) => have.has(id));
}

export function loadSeenTips(store: KeyStore): Set<TipId> {
  const seen = new Set<TipId>(parseSeenList(store.getItem(TIPS_KEY)));
  if (store.getItem(LEGACY_TUTORIAL_KEY) === '1') {
    for (const id of LEGACY_SEEN) seen.add(id);
  }
  return seen;
}

export function saveSeenTips(store: KeyStore, seen: Iterable<string>): TipId[] {
  const ordered = orderedSeen(seen);
  store.setItem(TIPS_KEY, JSON.stringify(ordered));
  return ordered;
}

export function markTipSeen(store: KeyStore, id: string): Set<TipId> {
  const seen = loadSeenTips(store);
  if (isTipId(id)) seen.add(id);
  saveSeenTips(store, seen);
  return seen;
}
