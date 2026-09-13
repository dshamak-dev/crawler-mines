import { getAudio } from './player';

export { AUDIO_KEY, LEGACY_SOUND_KEY, loadMuted, saveMuted } from './settings';
export { bossFloorActive, campaignFloorActive, desiredBgm, finaleBgm, sfxFromEvents } from './cues';
export type { AppScreen, DifficultyMode } from './cues';
export { stopOtherBgm } from './exclusive';
export type { BgmId, SfxId } from './urls';
export { BGM_FILES, SFX_FILES } from './urls';
export { GameAudio, getAudio } from './player';
export { useGameAudio } from './useGameAudio';

export function playDeny(): void {
  getAudio().playSfx('deny');
}
