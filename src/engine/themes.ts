export const THEME_IDS = [
  'theme-classic-dark',
  'theme-vintage-stone',
  'theme-neon-cyber',
  'theme-woodland',
  'theme-ocean-breeze',
  'theme-forest-trail',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'theme-classic-dark';
export const DEFAULT_OWNED_THEMES: readonly ThemeId[] = [DEFAULT_THEME];
export const THEME_PRICE = 1000;
export const FLAG_SKIN_REFUND = 500;
export const LEGACY_PAID_FLAG_SKINS = ['flag-golden', 'flag-pirate'] as const;
export const LEGACY_GRID_VINTAGE = 'grid-vintage';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  flavor: string;
  defaultOwned: boolean;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  'theme-classic-dark': {
    id: 'theme-classic-dark',
    name: 'Classic Dark',
    flavor: 'Clean, premium and familiar. Keeps the original look with subtle contrast improvements.',
    defaultOwned: true,
  },
  'theme-vintage-stone': {
    id: 'theme-vintage-stone',
    name: 'Vintage Stone',
    flavor: 'Rugged stone tiles with subtle textures and earthy tones. Classic and timeless.',
    defaultOwned: false,
  },
  'theme-neon-cyber': {
    id: 'theme-neon-cyber',
    name: 'Neon Cyber',
    flavor: 'Dark grid with neon accents. Modern, clean and bold.',
    defaultOwned: false,
  },
  'theme-woodland': {
    id: 'theme-woodland',
    name: 'Woodland',
    flavor: 'Natural wood tiles with organic details. Warm, calm and cozy.',
    defaultOwned: false,
  },
  'theme-ocean-breeze': {
    id: 'theme-ocean-breeze',
    name: 'Ocean Breeze',
    flavor: 'Calm and clean. Light tiles with cool blue tones and fresh accent colors.',
    defaultOwned: false,
  },
  'theme-forest-trail': {
    id: 'theme-forest-trail',
    name: 'Forest Trail',
    flavor: 'Natural and immersive. Stone tiles with earthy colors and organic accents.',
    defaultOwned: false,
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function isDefaultTheme(id: ThemeId): boolean {
  return THEMES[id].defaultOwned;
}

export function defaultOwnedThemes(): ThemeId[] {
  return [...DEFAULT_OWNED_THEMES];
}

export function paidThemeIds(): ThemeId[] {
  return THEME_IDS.filter((id) => !isDefaultTheme(id));
}

export function normalizeOwnedThemes(raw: unknown): ThemeId[] {
  const owned = new Set<ThemeId>(DEFAULT_OWNED_THEMES);
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (isThemeId(value)) owned.add(value);
    }
  }
  return THEME_IDS.filter((id) => owned.has(id));
}

export function isThemeOwned(
  state: { ownedThemes?: readonly string[] } | null | undefined,
  id: ThemeId,
): boolean {
  if (isDefaultTheme(id)) return true;
  return (state?.ownedThemes ?? []).some((value) => value === id);
}

export function selectedTheme(
  state: { selectedTheme?: unknown; ownedThemes?: readonly string[] } | null | undefined,
): ThemeId {
  const id = state?.selectedTheme;
  if (isThemeId(id) && isThemeOwned(state, id)) return id;
  return DEFAULT_THEME;
}

export function themeEntries(): ThemeDef[] {
  return THEME_IDS.map((id) => THEMES[id]);
}

/** Index 0 unused; 1–8 are adjacent-mine colors for an open cell. */
export type GridNumberColors = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface FlagPaint {
  pole: string;
  cloth: string;
  shine: string;
}

export type DigGlyph = 'shovel' | 'leaf';
export type CellFace = 'flat' | 'stone' | 'neon' | 'wood' | 'moss' | 'cloud';

export interface ThemeTokens {
  id: ThemeId;
  bg: string;
  bg2: string;
  stage: string;
  stone: string;
  stoneHi: string;
  stoneLo: string;
  ink: string;
  muted: string;
  gold: string;
  gold2: string;
  ember: string;
  blood: string;
  ash: string;
  border: string;
  goldBorder: string;
  goldBtn: string;
  tabletBg: string;
  tabletBorder: string;
  overlay: string;
  accentBorder: string;
  accentSoft: string;
  cardBg: string;
  wellBg: string;
  hidden: string;
  revealed: string;
  chest: string;
  wrecked: string;
  exploded: string;
  cellBorder: string;
  cellBorderWidth: number;
  cellRadius: number;
  cellFace: CellFace;
  grain: string;
  numbers: GridNumberColors;
  flag: FlagPaint;
  digGlyph: DigGlyph;
  foundAccent: string;
  brokenAccent: string;
  flagAccent: string;
  hudPillBorder: string;
  mineHintBorder: string;
}

const CLASSIC_NUMBERS: GridNumberColors = [
  '',
  '#e0b44a',
  '#6ee7a8',
  '#ff6b6b',
  '#c9a0ff',
  '#ffb347',
  '#5eead4',
  '#f5e6c8',
  '#d4d4d4',
];

const VINTAGE_NUMBERS: GridNumberColors = [
  '',
  '#d4b06a',
  '#9ed27a',
  '#e07048',
  '#d4b06a',
  '#e8a04a',
  '#7cbcac',
  '#f3e0c0',
  '#d8c8b0',
];

const NEON_NUMBERS: GridNumberColors = [
  '',
  '#4df0ff',
  '#5dff9a',
  '#ff5ad6',
  '#c44dff',
  '#ffe066',
  '#5eead4',
  '#f5e6c8',
  '#9ad4ff',
];

const WOODLAND_NUMBERS: GridNumberColors = [
  '',
  '#e0c070',
  '#7cbf4a',
  '#e07048',
  '#c4a06a',
  '#e8a04a',
  '#7cbcac',
  '#f3e0c0',
  '#d8c8b0',
];

const OCEAN_NUMBERS: GridNumberColors = [
  '',
  '#e8c96a',
  '#5ee0c4',
  '#ff7a7a',
  '#9ad0ff',
  '#ffb347',
  '#5eead4',
  '#f5e6c8',
  '#c5d0dc',
];

const FOREST_NUMBERS: GridNumberColors = [
  '',
  '#d4c06a',
  '#7cbf4a',
  '#e07048',
  '#a8c878',
  '#e8a04a',
  '#7cbcac',
  '#f3e0c0',
  '#c8d4b0',
];

const DEFAULT_FLAG: FlagPaint = { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a' };

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  'theme-classic-dark': {
    id: 'theme-classic-dark',
    bg: '#120e0c',
    bg2: '#1a1410',
    stage: '#070504',
    stone: '#2c2520',
    stoneHi: '#3d342e',
    stoneLo: '#1c1714',
    ink: '#f3e6d0',
    muted: '#b5a48c',
    gold: '#e0b44a',
    gold2: '#f3d27a',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#6a5e56',
    border: '#5a4a38',
    goldBorder: '#a67c2d',
    goldBtn: '#6b4e1e',
    tabletBg: '#241e1a',
    tabletBorder: '#6b5340',
    overlay: 'rgba(8, 6, 5, 0.72)',
    accentBorder: 'rgba(224, 180, 74, 0.35)',
    accentSoft: 'rgba(224, 180, 74, 0.18)',
    cardBg: 'rgba(0,0,0,0.28)',
    wellBg: 'rgba(8,6,5,0.95)',
    hidden: '#2c2520',
    revealed: '#1a1512',
    chest: '#2a2214',
    wrecked: '#161210',
    exploded: '#2a140c',
    cellBorder: 'rgba(255,255,255,0.06)',
    cellBorderWidth: 1,
    cellRadius: 6,
    cellFace: 'flat',
    grain: 'rgba(0,0,0,0.18)',
    numbers: CLASSIC_NUMBERS,
    flag: DEFAULT_FLAG,
    digGlyph: 'shovel',
    foundAccent: '#e0b44a',
    brokenAccent: '#8a7a6a',
    flagAccent: '#ffb4b4',
    hudPillBorder: 'rgba(224, 180, 74, 0.25)',
    mineHintBorder: '#f3d27a',
  },
  'theme-vintage-stone': {
    id: 'theme-vintage-stone',
    bg: '#16110e',
    bg2: '#1e1814',
    stage: '#0c0908',
    stone: '#3a342e',
    stoneHi: '#4a4238',
    stoneLo: '#241e18',
    ink: '#f0e2c8',
    muted: '#b8a488',
    gold: '#d4a84a',
    gold2: '#e8c878',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#7a6e60',
    border: '#5a4a38',
    goldBorder: '#a67c2d',
    goldBtn: '#6b4e1e',
    tabletBg: '#241e1a',
    tabletBorder: '#6b5340',
    overlay: 'rgba(10, 8, 6, 0.78)',
    accentBorder: 'rgba(212, 168, 74, 0.4)',
    accentSoft: 'rgba(212, 168, 74, 0.2)',
    cardBg: 'rgba(0,0,0,0.32)',
    wellBg: 'rgba(12,10,8,0.95)',
    hidden: '#5c564e',
    revealed: '#3a342e',
    chest: '#4a3a24',
    wrecked: '#2a2218',
    exploded: '#3a2014',
    cellBorder: '#3a4a32',
    cellBorderWidth: 1,
    cellRadius: 8,
    cellFace: 'stone',
    grain: 'rgba(20, 28, 16, 0.28)',
    numbers: VINTAGE_NUMBERS,
    flag: { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a' },
    digGlyph: 'shovel',
    foundAccent: '#d4a84a',
    brokenAccent: '#8a7a6a',
    flagAccent: '#ffb4b4',
    hudPillBorder: 'rgba(212, 168, 74, 0.35)',
    mineHintBorder: '#e8c878',
  },
  'theme-neon-cyber': {
    id: 'theme-neon-cyber',
    bg: '#050814',
    bg2: '#08101c',
    stage: '#03050c',
    stone: '#0c1828',
    stoneHi: '#123048',
    stoneLo: '#061018',
    ink: '#d8f6ff',
    muted: '#7aa0b8',
    gold: '#4df0ff',
    gold2: '#7af0ff',
    ember: '#ff5ad6',
    blood: '#ff4d8a',
    ash: '#5a7088',
    border: '#1a5a80',
    goldBorder: '#00b8e0',
    goldBtn: '#0a3a50',
    tabletBg: '#07101c',
    tabletBorder: '#1a5a80',
    overlay: 'rgba(2, 6, 14, 0.8)',
    accentBorder: 'rgba(77, 240, 255, 0.45)',
    accentSoft: 'rgba(77, 240, 255, 0.18)',
    cardBg: 'rgba(0, 20, 40, 0.5)',
    wellBg: 'rgba(4, 10, 20, 0.96)',
    hidden: '#0a1628',
    revealed: '#071018',
    chest: '#0c2438',
    wrecked: '#081018',
    exploded: '#1a1020',
    cellBorder: '#2ad4ff',
    cellBorderWidth: 1.6,
    cellRadius: 6,
    cellFace: 'neon',
    grain: 'rgba(42, 212, 255, 0.18)',
    numbers: NEON_NUMBERS,
    flag: { pole: '#8ad4e8', cloth: '#c23b3b', shine: '#e25a5a' },
    digGlyph: 'shovel',
    foundAccent: '#4df0ff',
    brokenAccent: '#c44dff',
    flagAccent: '#ff8ad6',
    hudPillBorder: 'rgba(77, 240, 255, 0.45)',
    mineHintBorder: '#7af0ff',
  },
  'theme-woodland': {
    id: 'theme-woodland',
    bg: '#1a120c',
    bg2: '#22180e',
    stage: '#0e0a06',
    stone: '#4a3220',
    stoneHi: '#5a4030',
    stoneLo: '#2a1c12',
    ink: '#f3e6d0',
    muted: '#b8a07a',
    gold: '#d4a84a',
    gold2: '#e8c878',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#7a6a52',
    border: '#5a4030',
    goldBorder: '#8a6a30',
    goldBtn: '#5a3e18',
    tabletBg: '#2a1e14',
    tabletBorder: '#6b5340',
    overlay: 'rgba(12, 8, 4, 0.78)',
    accentBorder: 'rgba(124, 191, 74, 0.4)',
    accentSoft: 'rgba(212, 168, 74, 0.22)',
    cardBg: 'rgba(20, 12, 6, 0.4)',
    wellBg: 'rgba(16, 10, 6, 0.96)',
    hidden: '#6b4a28',
    revealed: '#4a3218',
    chest: '#5a3a18',
    wrecked: '#2e1c10',
    exploded: '#3a2010',
    cellBorder: '#3a2414',
    cellBorderWidth: 1,
    cellRadius: 7,
    cellFace: 'wood',
    grain: 'rgba(30, 16, 8, 0.35)',
    numbers: WOODLAND_NUMBERS,
    flag: { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a' },
    digGlyph: 'leaf',
    foundAccent: '#c4a06a',
    brokenAccent: '#8a7a62',
    flagAccent: '#ffb4b4',
    hudPillBorder: 'rgba(124, 191, 74, 0.35)',
    mineHintBorder: '#7cbf4a',
  },
  'theme-ocean-breeze': {
    id: 'theme-ocean-breeze',
    bg: '#0c1a28',
    bg2: '#122434',
    stage: '#061018',
    stone: '#1a3048',
    stoneHi: '#244860',
    stoneLo: '#0c1c28',
    ink: '#e8f0f8',
    muted: '#8aa8c0',
    gold: '#7ec8ff',
    gold2: '#b4e0ff',
    ember: '#ff8a5a',
    blood: '#e07070',
    ash: '#6a8498',
    border: '#3a6080',
    goldBorder: '#4aa0d0',
    goldBtn: '#1a4868',
    tabletBg: '#122434',
    tabletBorder: '#3a6080',
    overlay: 'rgba(6, 14, 24, 0.78)',
    accentBorder: 'rgba(126, 200, 255, 0.4)',
    accentSoft: 'rgba(126, 200, 255, 0.18)',
    cardBg: 'rgba(8, 20, 36, 0.45)',
    wellBg: 'rgba(8, 16, 28, 0.96)',
    hidden: '#9aafc0',
    revealed: '#3a5870',
    chest: '#4a6880',
    wrecked: '#2a3c4c',
    exploded: '#3a3040',
    cellBorder: '#7aa0b8',
    cellBorderWidth: 1,
    cellRadius: 8,
    cellFace: 'cloud',
    grain: 'rgba(255,255,255,0.18)',
    numbers: OCEAN_NUMBERS,
    flag: { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a' },
    digGlyph: 'shovel',
    foundAccent: '#7ec8ff',
    brokenAccent: '#8aa8c0',
    flagAccent: '#ffb4b4',
    hudPillBorder: 'rgba(126, 200, 255, 0.4)',
    mineHintBorder: '#b4e0ff',
  },
  'theme-forest-trail': {
    id: 'theme-forest-trail',
    bg: '#0c1610',
    bg2: '#142018',
    stage: '#060c08',
    stone: '#243428',
    stoneHi: '#304838',
    stoneLo: '#121c14',
    ink: '#e8f0d8',
    muted: '#8aaa7a',
    gold: '#c4b06a',
    gold2: '#dcc888',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#6a7a62',
    border: '#3a5040',
    goldBorder: '#6a8a48',
    goldBtn: '#2a4a28',
    tabletBg: '#142018',
    tabletBorder: '#3a5040',
    overlay: 'rgba(6, 12, 8, 0.78)',
    accentBorder: 'rgba(124, 191, 74, 0.4)',
    accentSoft: 'rgba(168, 200, 120, 0.2)',
    cardBg: 'rgba(8, 16, 10, 0.45)',
    wellBg: 'rgba(8, 14, 10, 0.96)',
    hidden: '#2a3a28',
    revealed: '#1a2418',
    chest: '#2a3420',
    wrecked: '#141c12',
    exploded: '#241810',
    cellBorder: '#3a4a32',
    cellBorderWidth: 1,
    cellRadius: 8,
    cellFace: 'moss',
    grain: 'rgba(20, 40, 16, 0.35)',
    numbers: FOREST_NUMBERS,
    flag: { pole: '#c9b59a', cloth: '#c23b3b', shine: '#e25a5a' },
    digGlyph: 'leaf',
    foundAccent: '#8bc46a',
    brokenAccent: '#7a8a72',
    flagAccent: '#ffb4b4',
    hudPillBorder: 'rgba(139, 196, 106, 0.4)',
    mineHintBorder: '#8bc46a',
  },
};

export function themeTokens(id: ThemeId): ThemeTokens {
  return THEME_TOKENS[isThemeId(id) ? id : DEFAULT_THEME];
}

export function gridNumberColor(idOrTokens: ThemeId | ThemeTokens, n: number): string {
  const paint = typeof idOrTokens === 'string' ? themeTokens(idOrTokens) : idOrTokens;
  if (!Number.isInteger(n) || n < 1 || n > 8) return paint.numbers[1];
  return paint.numbers[n];
}

export interface LegacySkinSave {
  gold?: unknown;
  ownedSkins?: unknown;
  selectedFlagSkin?: unknown;
  selectedGridSkin?: unknown;
  ownedThemes?: unknown;
  selectedTheme?: unknown;
}

export interface ThemeMigration {
  goldBonus: number;
  ownedThemes: ThemeId[];
  selectedTheme: ThemeId;
  /** True when old flag/grid fields were present and must be rewritten off disk. */
  dirty: boolean;
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string');
}

/**
 * Map a v1 flag/grid save onto full-app themes.
 * Refunds 500g per owned paid flag skin. `grid-vintage` grants Vintage Stone.
 * `grid-classic` is a no-op (Classic Dark is already the free default).
 */
export function migrateLegacySkins(parsed: LegacySkinSave): ThemeMigration {
  const hasNew = parsed.ownedThemes != null || parsed.selectedTheme != null;
  if (hasNew) {
    const ownedThemes = normalizeOwnedThemes(parsed.ownedThemes);
    return {
      goldBonus: 0,
      ownedThemes,
      selectedTheme: selectedTheme({ ...parsed, ownedThemes }),
      dirty: false,
    };
  }

  const oldSkins = asStringArray(parsed.ownedSkins);
  const hasOld =
    parsed.ownedSkins != null || parsed.selectedFlagSkin != null || parsed.selectedGridSkin != null;
  if (!hasOld) {
    return {
      goldBonus: 0,
      ownedThemes: defaultOwnedThemes(),
      selectedTheme: DEFAULT_THEME,
      dirty: false,
    };
  }

  const owned = new Set<ThemeId>(DEFAULT_OWNED_THEMES);
  let goldBonus = 0;
  for (const id of oldSkins) {
    if ((LEGACY_PAID_FLAG_SKINS as readonly string[]).includes(id)) {
      goldBonus += FLAG_SKIN_REFUND;
    }
    if (id === LEGACY_GRID_VINTAGE) owned.add('theme-vintage-stone');
  }
  const ownedThemes = THEME_IDS.filter((id) => owned.has(id));
  const selected =
    parsed.selectedGridSkin === LEGACY_GRID_VINTAGE && owned.has('theme-vintage-stone')
      ? 'theme-vintage-stone'
      : DEFAULT_THEME;
  return { goldBonus, ownedThemes, selectedTheme: selected, dirty: true };
}
