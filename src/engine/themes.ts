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
export type ThemeBackdrop = 'none' | 'neon' | 'woodland';

/** Board, HUD, and dock dressing beyond the base palette. */
export interface ThemeChrome {
  /** Edge of revealed (sunken) cells; hidden cells use `cellBorder`. */
  revealedBorder: string;
  explodedBorder: string;
  /** Raised-tile bevel: lit top-left edge and shaded bottom-right edge. */
  bevelHi: string;
  bevelLo: string;
  moss: string;
  /** Outer glow on hidden cells (neon); null for none. */
  cellGlow: string | null;
  /** Flagged cells sink like revealed cells instead of staying raised. */
  flaggedSunken: boolean;
  /** 0–1 blend of the number color into a revealed cell showing 2 or more. */
  numberTint: number;
  /** Text-shadow radius in the number's own color; 0 for an engraved shadow. */
  numberGlow: number;
  boardBg: string;
  boardBorder: string;
  boardPad: number;
  hudBar: string | null;
  hudBarBorder: string;
  hudBg: string;
  foundBorder: string;
  brokenBorder: string;
  pillBg: string;
  pillText: string;
  menuBg: string;
  menuBorder: string;
  menuInk: string;
  dockBg: string;
  dockBorder: string;
  toggleActiveBg: string;
  toggleIdleBg: string;
  digBorder: string;
  flagBorder: string;
  digText: string;
  flagText: string;
  digIcon: string | null;
  /** Idle Dig/Flag label falls back to `muted` instead of keeping its accent. */
  dimIdleLabel: boolean;
  /** Cut-corner frames on menu and Dig/Flag buttons. */
  chamfer: boolean;
  backdrop: ThemeBackdrop;
}

export interface ThemeTokens extends ThemeChrome {
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
  '#efd9b8',
  '#9fd884',
  '#e07a52',
  '#d4b06a',
  '#e8a04a',
  '#7cbcac',
  '#c9a8e0',
  '#b8a890',
];

const NEON_NUMBERS: GridNumberColors = [
  '',
  '#4fd8ff',
  '#4dfcc0',
  '#c99cff',
  '#ff5ad6',
  '#ffe066',
  '#ff9a4d',
  '#f5e6c8',
  '#9ad4ff',
];

const WOODLAND_NUMBERS: GridNumberColors = [
  '',
  '#f6e0b4',
  '#b6d466',
  '#e8805a',
  '#d4a84a',
  '#e8a04a',
  '#7cbcac',
  '#c8a0e0',
  '#b8a07a',
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

type BaseTokens = Omit<ThemeTokens, keyof ThemeChrome>;

/** Chrome that reproduces the pre-board-A look: flat HUD, unframed board, muted idle labels. */
function withPlainChrome(base: BaseTokens): ThemeTokens {
  return {
    ...base,
    revealedBorder: base.cellBorder,
    explodedBorder: base.cellBorder,
    bevelHi: 'transparent',
    bevelLo: 'transparent',
    moss: base.grain,
    cellGlow: null,
    flaggedSunken: false,
    numberTint: 0,
    numberGlow: 0,
    boardBg: 'transparent',
    boardBorder: 'transparent',
    boardPad: 0,
    hudBar: null,
    hudBarBorder: 'transparent',
    hudBg: 'rgba(0,0,0,0.3)',
    foundBorder: base.accentSoft,
    brokenBorder: base.accentSoft,
    pillBg: 'transparent',
    pillText: base.muted,
    menuBg: 'rgba(0,0,0,0.25)',
    menuBorder: 'transparent',
    menuInk: base.ink,
    dockBg: base.cardBg,
    dockBorder: base.accentSoft,
    toggleActiveBg: base.stoneHi,
    toggleIdleBg: 'transparent',
    digBorder: 'transparent',
    flagBorder: 'transparent',
    digText: base.gold2,
    flagText: base.flagAccent,
    digIcon: null,
    dimIdleLabel: true,
    chamfer: false,
    backdrop: 'none',
  };
}

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  'theme-classic-dark': withPlainChrome({
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
  }),
  'theme-vintage-stone': {
    id: 'theme-vintage-stone',
    bg: '#1c1712',
    bg2: '#231d16',
    stage: '#0c0908',
    stone: '#3a332a',
    stoneHi: '#433a30',
    stoneLo: '#16120d',
    ink: '#f0e2c8',
    muted: '#a89a86',
    gold: '#e0b44a',
    gold2: '#ecd9b6',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#7a6e60',
    border: '#4a3e30',
    goldBorder: '#a67c2d',
    goldBtn: '#4a3a1e',
    tabletBg: '#1f1a14',
    tabletBorder: '#5a4a38',
    overlay: 'rgba(10, 8, 6, 0.78)',
    accentBorder: 'rgba(166, 124, 45, 0.55)',
    accentSoft: 'rgba(166, 124, 45, 0.3)',
    cardBg: 'rgba(0,0,0,0.32)',
    wellBg: 'rgba(12,10,8,0.95)',
    hidden: '#433a30',
    revealed: '#211d17',
    chest: '#332c1e',
    wrecked: '#231e18',
    exploded: '#3a1a12',
    cellBorder: '#14110c',
    cellBorderWidth: 1,
    cellRadius: 7,
    cellFace: 'stone',
    grain: 'rgba(14, 11, 7, 0.7)',
    numbers: VINTAGE_NUMBERS,
    flag: { pole: '#e8d6b0', cloth: '#c8302a', shine: '#e04a3a' },
    digGlyph: 'shovel',
    foundAccent: '#e0b44a',
    brokenAccent: '#cfc2ae',
    flagAccent: '#e0a848',
    hudPillBorder: '#a67c2d',
    mineHintBorder: '#e8c878',
    revealedBorder: '#100d09',
    explodedBorder: '#6a2a1c',
    bevelHi: 'rgba(160, 145, 120, 0.5)',
    bevelLo: 'rgba(0, 0, 0, 0.55)',
    moss: 'rgba(92, 120, 44, 0.55)',
    cellGlow: null,
    flaggedSunken: true,
    numberTint: 0,
    numberGlow: 0,
    boardBg: '#0e0b06',
    boardBorder: '#2a2219',
    boardPad: 5,
    hudBar: null,
    hudBarBorder: 'transparent',
    hudBg: '#120f0a',
    foundBorder: 'rgba(166, 124, 45, 0.55)',
    brokenBorder: 'rgba(166, 124, 45, 0.4)',
    pillBg: '#1c160f',
    pillText: '#e0b44a',
    menuBg: '#1b1811',
    menuBorder: '#4a3e30',
    menuInk: '#ecd9b6',
    dockBg: 'rgba(0, 0, 0, 0.22)',
    dockBorder: 'rgba(90, 74, 56, 0.4)',
    toggleActiveBg: '#3a332a',
    toggleIdleBg: '#120f0a',
    digBorder: '#5a4e40',
    flagBorder: '#3a3028',
    digText: '#ecd9b6',
    flagText: '#e0a848',
    digIcon: null,
    dimIdleLabel: false,
    chamfer: false,
    backdrop: 'none',
  },
  'theme-neon-cyber': {
    id: 'theme-neon-cyber',
    bg: '#020c22',
    bg2: '#04122c',
    stage: '#01050f',
    stone: '#0a1c33',
    stoneHi: '#04225c',
    stoneLo: '#010a1c',
    ink: '#d8f6ff',
    muted: '#5a8ab8',
    gold: '#4fd8ff',
    gold2: '#7af0ff',
    ember: '#ff5ad6',
    blood: '#ff4d6a',
    ash: '#5a7088',
    border: '#1a5a9a',
    goldBorder: '#2ac8ff',
    goldBtn: '#04225c',
    tabletBg: '#04122c',
    tabletBorder: '#1a5a9a',
    overlay: 'rgba(1, 6, 18, 0.82)',
    accentBorder: 'rgba(42, 200, 255, 0.55)',
    accentSoft: 'rgba(42, 200, 255, 0.25)',
    cardBg: 'rgba(0, 20, 50, 0.5)',
    wellBg: 'rgba(2, 10, 28, 0.96)',
    hidden: '#0a1c33',
    revealed: '#061629',
    chest: '#18233a',
    wrecked: '#0b1830',
    exploded: '#140c2a',
    cellBorder: '#1f6fd6',
    cellBorderWidth: 1.2,
    cellRadius: 6,
    cellFace: 'neon',
    grain: 'rgba(42, 140, 255, 0.18)',
    numbers: NEON_NUMBERS,
    flag: { pole: '#f0c890', cloth: '#e8303e', shine: '#ff4a58' },
    digGlyph: 'shovel',
    foundAccent: '#4fd8ff',
    brokenAccent: '#c99cff',
    flagAccent: '#ff5a78',
    hudPillBorder: '#2ac8ff',
    mineHintBorder: '#7af0ff',
    revealedBorder: '#103a6a',
    explodedBorder: '#9a3ad8',
    bevelHi: 'transparent',
    bevelLo: 'transparent',
    moss: 'transparent',
    cellGlow: 'rgba(42, 140, 255, 0.35)',
    flaggedSunken: true,
    numberTint: 0,
    numberGlow: 11,
    boardBg: '#020a20',
    boardBorder: '#1a4a8a',
    boardPad: 5,
    hudBar: null,
    hudBarBorder: 'transparent',
    hudBg: '#03102a',
    foundBorder: '#1f8ad8',
    brokenBorder: '#6a4ae0',
    pillBg: 'rgba(10, 60, 110, 0.35)',
    pillText: '#7af0ff',
    menuBg: '#04122c',
    menuBorder: '#1a5a9a',
    menuInk: '#c8f0ff',
    dockBg: 'transparent',
    dockBorder: 'transparent',
    toggleActiveBg: '#04225c',
    toggleIdleBg: '#050f26',
    digBorder: '#2ad4ff',
    flagBorder: '#5a2ab0',
    digText: '#7af0ff',
    flagText: '#ff5a78',
    digIcon: '#3ad8ff',
    dimIdleLabel: false,
    chamfer: true,
    backdrop: 'neon',
  },
  'theme-woodland': {
    id: 'theme-woodland',
    bg: '#3a2616',
    bg2: '#2a1a0e',
    stage: '#120a05',
    stone: '#4a3220',
    stoneHi: '#6a4426',
    stoneLo: '#21150a',
    ink: '#f6e6c8',
    muted: '#d8c0a0',
    gold: '#d4a84a',
    gold2: '#f0dcc0',
    ember: '#ff6b35',
    blood: '#c23b3b',
    ash: '#7a6a52',
    border: '#2a1a0c',
    goldBorder: '#a07848',
    goldBtn: '#5a3a20',
    tabletBg: '#3a2616',
    tabletBorder: '#a07848',
    overlay: 'rgba(12, 8, 4, 0.78)',
    accentBorder: 'rgba(160, 120, 72, 0.6)',
    accentSoft: 'rgba(160, 120, 72, 0.35)',
    cardBg: 'rgba(20, 12, 6, 0.4)',
    wellBg: 'rgba(16, 10, 6, 0.96)',
    hidden: '#76502d',
    revealed: '#40291a',
    chest: '#3e3418',
    wrecked: '#2e2216',
    exploded: '#3a1a10',
    cellBorder: '#21150a',
    cellBorderWidth: 1,
    cellRadius: 7,
    cellFace: 'wood',
    grain: 'rgba(40, 22, 10, 0.3)',
    numbers: WOODLAND_NUMBERS,
    flag: { pole: '#e8d6b0', cloth: '#d0302a', shine: '#e84a3a' },
    digGlyph: 'leaf',
    foundAccent: '#b8d070',
    brokenAccent: '#e0a888',
    flagAccent: '#f08a64',
    hudPillBorder: '#a07848',
    mineHintBorder: '#7cbf4a',
    revealedBorder: '#24180c',
    explodedBorder: '#5a2a18',
    bevelHi: 'rgba(200, 150, 95, 0.55)',
    bevelLo: 'rgba(20, 10, 4, 0.6)',
    moss: 'rgba(96, 124, 40, 0.5)',
    cellGlow: null,
    flaggedSunken: true,
    numberTint: 0.06,
    numberGlow: 0,
    boardBg: '#573b20',
    boardBorder: '#2a1a0c',
    boardPad: 5,
    hudBar: '#5a3a20',
    hudBarBorder: '#2a1a0c',
    hudBg: '#22170c',
    foundBorder: '#6a4a2a',
    brokenBorder: '#6a4a2a',
    pillBg: '#4a2e18',
    pillText: '#f0dcc0',
    menuBg: '#5a3a20',
    menuBorder: '#a07848',
    menuInk: '#f6e6c8',
    dockBg: 'transparent',
    dockBorder: 'transparent',
    toggleActiveBg: '#6a4426',
    toggleIdleBg: '#3a2212',
    digBorder: '#2a1a0c',
    flagBorder: '#2a1a0c',
    digText: '#b8d870',
    flagText: '#f08a64',
    digIcon: '#7cbf4a',
    dimIdleLabel: false,
    chamfer: false,
    backdrop: 'woodland',
  },
  'theme-ocean-breeze': withPlainChrome({
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
  }),
  'theme-forest-trail': withPlainChrome({
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
  }),
};

export function themeTokens(id: ThemeId): ThemeTokens {
  return THEME_TOKENS[isThemeId(id) ? id : DEFAULT_THEME];
}

export function gridNumberColor(idOrTokens: ThemeId | ThemeTokens, n: number): string {
  const paint = typeof idOrTokens === 'string' ? themeTokens(idOrTokens) : idOrTokens;
  if (!Number.isInteger(n) || n < 1 || n > 8) return paint.numbers[1];
  return paint.numbers[n];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Revealed fill for a numbered cell. 2+ tint toward their number color; 1s stay plain. */
export function numberCellFill(paint: ThemeTokens, n: number): string {
  if (paint.numberTint <= 0 || n < 2) return paint.revealed;
  return mixHex(paint.revealed, gridNumberColor(paint, n), paint.numberTint);
}

/** Pixels the board frame eats on each side (padding + border). */
export function boardFrameInset(paint: ThemeTokens): number {
  return paint.boardPad > 0 ? paint.boardPad + 1 : 0;
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
