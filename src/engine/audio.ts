import { defaultStore, type KeyStore } from './collection';
import { isCampaignFinale, type BossId, type Difficulty, type GameEvent } from './types';

export const BGM_FILES = {
  cozy: 'cozy-descent.mp3',
  campaign: 'campaign-depths.mp3',
  boss: 'flag-eater-boss.mp3',
  wrath: 'wrath-boss.mp3',
  lust: 'lust-boss.mp3',
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
export type AppScreen = 'menu' | 'play' | 'collection' | 'shop';
export type DifficultyMode = Difficulty;

export const AUDIO_KEY = 'crawler-mines-audio';
export const LEGACY_SOUND_KEY = 'crawler-mines-sound';

export function campaignFloorActive(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
): boolean {
  if (mode !== 'campaign') return false;
  if (screen === 'play') return true;
  return screen === 'collection' && collectionFrom === 'play';
}

export function bossFloorActive(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
  floor = 0,
): boolean {
  return (
    campaignFloorActive(screen, mode, collectionFrom) &&
    mode === 'campaign' &&
    isCampaignFinale(mode, floor)
  );
}

export function finaleBgm(bossId: BossId | null | undefined): BgmId {
  if (bossId === 'wrath') return 'wrath';
  if (bossId === 'lust') return 'lust';
  return 'boss';
}

export function desiredBgm(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
  floor = 0,
  bossId: BossId | null = null,
): BgmId {
  if (bossFloorActive(screen, mode, collectionFrom, floor)) return finaleBgm(bossId);
  if (campaignFloorActive(screen, mode, collectionFrom)) return 'campaign';
  return 'cozy';
}

export function sfxFromEvents(events: ReadonlyArray<GameEvent>): SfxId[] {
  let revealed = false;
  let blasted = false;
  let wrecked = false;
  let chest = false;
  let cleared = false;
  let lost = false;
  let bossMove = false;
  let bossEat = false;
  let bossHit = false;
  let bossDeath = false;
  let deny = false;
  for (const e of events) {
    if (e.type === 'reveal') revealed = true;
    else if (e.type === 'explode') {
      blasted = true;
      if (e.wrecked.length > 0) wrecked = true;
    } else if (e.type === 'chest') chest = true;
    else if (e.type === 'cleared') cleared = true;
    else if (e.type === 'lost') lost = true;
    else if (e.type === 'boss-move') bossMove = true;
    else if (e.type === 'boss-eat-flag') bossEat = true;
    else if (e.type === 'boss-smash-chest') wrecked = true;
    else if (e.type === 'boss-hit') bossHit = true;
    else if (e.type === 'boss-death') bossDeath = true;
    else if (e.type === 'deny') deny = true;
  }
  const out: SfxId[] = [];
  if (revealed) out.push('dig');
  if (blasted) out.push('blast');
  if (wrecked) out.push('wreck');
  if (chest) out.push('chest');
  if (bossHit) out.push('boss-hit');
  if (bossDeath) out.push('boss-death');
  if (bossMove) out.push('boss-move');
  if (bossEat) out.push('boss-eat-flag');
  if (cleared) out.push('clear');
  if (lost) out.push('campaign-lose');
  if (deny) out.push('deny');
  return out;
}

export function loadMuted(store: KeyStore = defaultStore()): boolean {
  const raw = store.getItem(AUDIO_KEY);
  if (!raw) {
    const legacy = store.getItem(LEGACY_SOUND_KEY);
    return legacy === '0';
  }
  try {
    const parsed = JSON.parse(raw) as { muted?: unknown };
    if (parsed && typeof parsed === 'object') return parsed.muted === true;
  } catch {
    /* plain "1" / "true" from an older write */
  }
  return raw === '1' || raw === 'true';
}

export function saveMuted(muted: boolean, store: KeyStore = defaultStore()): void {
  store.setItem(AUDIO_KEY, JSON.stringify({ v: 1, muted }));
}
