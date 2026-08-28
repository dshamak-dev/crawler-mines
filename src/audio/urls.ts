export const BGM_FILES = {
  cozy: 'cozy-descent.mp3',
  campaign: 'campaign-depths.mp3',
  /** Approved Gluttony loop at public/audio/flag-eater-boss.mp3 — do not substitute or re-encode. */
  boss: 'flag-eater-boss.mp3',
} as const;

export const SFX_FILES = {
  dig: 'sfx-dig.wav',
  flag: 'sfx-flag.wav',
  chest: 'sfx-chest.wav',
  blast: 'sfx-blast.wav',
  wreck: 'sfx-wreck.wav',
  clear: 'sfx-clear.wav',
  ui: 'sfx-ui.wav',
  deny: 'sfx-deny.wav',
  'boss-move': 'sfx-boss-move.wav',
  'boss-eat-flag': 'sfx-boss-eat-flag.wav',
  'boss-hit': 'sfx-boss-hit.wav',
  'boss-death': 'sfx-boss-death.wav',
  'campaign-lose': 'sfx-campaign-lose.wav',
} as const;

export type BgmId = keyof typeof BGM_FILES;
export type SfxId = keyof typeof SFX_FILES;

/** Vite Pages base is `/crawler-mines/` — always prefix public audio with BASE_URL. */
export function audioUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}audio/${file}`;
}

export function bgmUrl(id: BgmId): string {
  return audioUrl(BGM_FILES[id]);
}

export function sfxUrl(id: SfxId): string {
  return audioUrl(SFX_FILES[id]);
}
