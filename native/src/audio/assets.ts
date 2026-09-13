import type { BgmId, SfxId } from './urls';

/** Same approved bytes as the former root `public/audio/*` — copied, not re-encoded. */
export const BGM_ASSETS: Record<BgmId, number> = {
  cozy: require('../../assets/audio/cozy-descent.mp3'),
  campaign: require('../../assets/audio/campaign-depths.mp3'),
  boss: require('../../assets/audio/flag-eater-boss.mp3'),
  wrath: require('../../assets/audio/wrath-boss.mp3'),
  lust: require('../../assets/audio/lust-boss.mp3'),
};

export const SFX_ASSETS: Record<SfxId, number> = {
  dig: require('../../assets/audio/sfx-dig.wav'),
  flag: require('../../assets/audio/sfx-flag.wav'),
  chest: require('../../assets/audio/sfx-chest.wav'),
  blast: require('../../assets/audio/sfx-blast.wav'),
  wreck: require('../../assets/audio/sfx-wreck.wav'),
  clear: require('../../assets/audio/sfx-clear.wav'),
  ui: require('../../assets/audio/sfx-ui.wav'),
  deny: require('../../assets/audio/sfx-deny.wav'),
  'boss-move': require('../../assets/audio/sfx-boss-move.wav'),
  'boss-eat-flag': require('../../assets/audio/sfx-boss-eat-flag.wav'),
  'boss-hit': require('../../assets/audio/sfx-boss-hit.wav'),
  'boss-death': require('../../assets/audio/sfx-boss-death.wav'),
  'campaign-lose': require('../../assets/audio/sfx-campaign-lose.wav'),
};
