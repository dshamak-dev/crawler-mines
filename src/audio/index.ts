import { getAudio } from './player';

export { AUDIO_KEY, loadMuted, saveMuted } from './settings';
export { campaignFloorActive, desiredBgm, sfxFromEvents } from './cues';
export type { AppScreen, DifficultyMode } from './cues';
export { audioUrl, bgmUrl, sfxUrl } from './urls';
export type { BgmId, SfxId } from './urls';
export { getAudio } from './player';
export { useGameAudio } from './useGameAudio';

/** Paid Hard/Campaign entry (other PR) should call this when gold/key is short. */
export function playDeny(): void {
  getAudio().playSfx('deny');
}
