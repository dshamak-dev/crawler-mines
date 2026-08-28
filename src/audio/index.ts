import { getAudio } from './player';

export { AUDIO_KEY, LEGACY_SOUND_KEY, loadMuted, saveMuted } from './settings';
export { bossFloorActive, campaignFloorActive, desiredBgm, sfxFromEvents } from './cues';
export type { AppScreen, DifficultyMode } from './cues';
export { audioUrl, bgmUrl, sfxUrl } from './urls';
export type { BgmId, SfxId } from './urls';
export { getAudio } from './player';
export { useGameAudio } from './useGameAudio';

/** Play when Hard/Campaign entry is blocked (short gold and no matching key). */
export function playDeny(): void {
  getAudio().playSfx('deny');
}
