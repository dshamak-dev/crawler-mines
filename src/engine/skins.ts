export const FLAG_SKIN_IDS = ['flag-red', 'flag-golden', 'flag-pirate'] as const;
export const GRID_SKIN_IDS = ['grid-gray', 'grid-classic', 'grid-vintage'] as const;
export const SKIN_IDS = [...FLAG_SKIN_IDS, ...GRID_SKIN_IDS] as const;

export type FlagSkinId = (typeof FLAG_SKIN_IDS)[number];
export type GridSkinId = (typeof GRID_SKIN_IDS)[number];
export type SkinId = (typeof SKIN_IDS)[number];
export type SkinSlot = 'flag' | 'grid';

export const DEFAULT_FLAG_SKIN: FlagSkinId = 'flag-red';
export const DEFAULT_GRID_SKIN: GridSkinId = 'grid-gray';
export const DEFAULT_OWNED_SKINS: readonly SkinId[] = [DEFAULT_FLAG_SKIN, DEFAULT_GRID_SKIN];

export interface SkinDef {
  id: SkinId;
  name: string;
  flavor: string;
  slot: SkinSlot;
  defaultOwned: boolean;
}

export const SKINS: Record<SkinId, SkinDef> = {
  'flag-red': {
    id: 'flag-red',
    name: 'Red flag',
    flavor: 'A scrap of crimson on a bone pole.',
    slot: 'flag',
    defaultOwned: true,
  },
  'flag-golden': {
    id: 'flag-golden',
    name: 'Golden flag',
    flavor: 'Warm cloth that still remembers a king\'s tent.',
    slot: 'flag',
    defaultOwned: false,
  },
  'flag-pirate': {
    id: 'flag-pirate',
    name: 'Pirate flag',
    flavor: 'Black rag with a skull that reads at a glance.',
    slot: 'flag',
    defaultOwned: false,
  },
  'grid-gray': {
    id: 'grid-gray',
    name: 'Gray grid',
    flavor: 'Cave stone. The floor you already know.',
    slot: 'grid',
    defaultOwned: true,
  },
  'grid-classic': {
    id: 'grid-classic',
    name: 'Classic grid',
    flavor: 'Lighter tiles. Closed and open argue like the old game.',
    slot: 'grid',
    defaultOwned: false,
  },
  'grid-vintage': {
    id: 'grid-vintage',
    name: 'Vintage grid',
    flavor: 'Sepia stone worn smooth by older boots.',
    slot: 'grid',
    defaultOwned: false,
  },
};

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && (SKIN_IDS as readonly string[]).includes(value);
}

export function isFlagSkinId(value: unknown): value is FlagSkinId {
  return typeof value === 'string' && (FLAG_SKIN_IDS as readonly string[]).includes(value);
}

export function isGridSkinId(value: unknown): value is GridSkinId {
  return typeof value === 'string' && (GRID_SKIN_IDS as readonly string[]).includes(value);
}

export function isDefaultSkin(id: SkinId): boolean {
  return SKINS[id].defaultOwned;
}

export function defaultOwnedSkins(): SkinId[] {
  return [...DEFAULT_OWNED_SKINS];
}

export function normalizeOwnedSkins(raw: unknown): SkinId[] {
  const owned = new Set<SkinId>(DEFAULT_OWNED_SKINS);
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (isSkinId(value)) owned.add(value);
    }
  }
  return SKIN_IDS.filter((id) => owned.has(id));
}

export function isSkinOwned(
  state: { ownedSkins?: readonly string[] } | null | undefined,
  id: SkinId,
): boolean {
  if (isDefaultSkin(id)) return true;
  return (state?.ownedSkins ?? []).some((value) => value === id);
}

export function selectedFlagSkin(
  state: { selectedFlagSkin?: unknown; ownedSkins?: readonly string[] } | null | undefined,
): FlagSkinId {
  const id = state?.selectedFlagSkin;
  if (isFlagSkinId(id) && isSkinOwned(state, id)) return id;
  return DEFAULT_FLAG_SKIN;
}

export function selectedGridSkin(
  state: { selectedGridSkin?: unknown; ownedSkins?: readonly string[] } | null | undefined,
): GridSkinId {
  const id = state?.selectedGridSkin;
  if (isGridSkinId(id) && isSkinOwned(state, id)) return id;
  return DEFAULT_GRID_SKIN;
}

export interface FlagSkinPaint {
  pole: string;
  cloth: string;
  shine: string;
  mark: 'none' | 'skull';
}

export const FLAG_SKIN_PAINT: Record<FlagSkinId, FlagSkinPaint> = {
  'flag-red': { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a', mark: 'none' },
  'flag-golden': { pole: '#5a3a18', cloth: '#d4a017', shine: '#f3d27a', mark: 'none' },
  'flag-pirate': { pole: '#6b5340', cloth: '#1c1614', shine: '#3a322e', mark: 'skull' },
};

export function flagSkinPaint(id: FlagSkinId): FlagSkinPaint {
  return FLAG_SKIN_PAINT[isFlagSkinId(id) ? id : DEFAULT_FLAG_SKIN];
}

export interface GridSkinPaint {
  hidden: string;
  revealed: string;
  chest: string;
  wrecked: string;
  exploded: string;
}

/** Cave-stone defaults plus locked #49 classic / vintage contrast. */
export const GRID_SKIN_PAINT: Record<GridSkinId, GridSkinPaint> = {
  'grid-gray': {
    hidden: '#2c2520',
    revealed: '#1a1512',
    chest: '#2a2214',
    wrecked: '#161210',
    exploded: '#2a140c',
  },
  'grid-classic': {
    hidden: '#c8c8cc',
    revealed: '#8f8f94',
    chest: '#c4b48a',
    wrecked: '#6a6a70',
    exploded: '#b07060',
  },
  'grid-vintage': {
    hidden: '#8a6e4e',
    revealed: '#5c4634',
    chest: '#7a5a30',
    wrecked: '#3a2a1c',
    exploded: '#5a2a18',
  },
};

export function gridSkinPaint(id: GridSkinId): GridSkinPaint {
  return GRID_SKIN_PAINT[isGridSkinId(id) ? id : DEFAULT_GRID_SKIN];
}

export function skinEntries(slot: SkinSlot): SkinDef[] {
  return SKIN_IDS.filter((id) => SKINS[id].slot === slot).map((id) => SKINS[id]);
}
