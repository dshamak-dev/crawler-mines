import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_KEY,
  LEGACY_SOUND_KEY,
  audioUrl,
  bgmUrl,
  bossFloorActive,
  campaignFloorActive,
  desiredBgm,
  finaleBgm,
  getAudio,
  loadMuted,
  saveMuted,
  sfxFromEvents,
  sfxUrl,
} from '../src/audio';
import type { KeyStore } from '../src/engine';

function memoryStore(seed: Record<string, string> = {}): KeyStore {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('audio URLs', () => {
  it('prefixes public audio with the Vite Pages base', () => {
    expect(audioUrl('cozy-descent.mp3')).toBe('/crawler-mines/audio/cozy-descent.mp3');
    expect(bgmUrl('cozy')).toBe('/crawler-mines/audio/cozy-descent.mp3');
    expect(bgmUrl('campaign')).toBe('/crawler-mines/audio/campaign-depths.mp3');
    expect(bgmUrl('boss')).toBe('/crawler-mines/audio/flag-eater-boss.mp3');
    expect(bgmUrl('wrath')).toBe('/crawler-mines/audio/wrath-boss.mp3');
    // Presence only — do not decode mp3 bytes.
    expect(existsSync(resolve('public/audio/cozy-descent.mp3'))).toBe(true);
    expect(existsSync(resolve('public/audio/campaign-depths.mp3'))).toBe(true);
    expect(existsSync(resolve('public/audio/flag-eater-boss.mp3'))).toBe(true);
    expect(sfxUrl('deny')).toBe('/crawler-mines/audio/sfx-deny.wav');
    expect(sfxUrl('boss-move')).toBe('/crawler-mines/audio/sfx-boss-move.wav');
    expect(sfxUrl('campaign-lose')).toBe('/crawler-mines/audio/sfx-campaign-lose.wav');
  });
});

describe('BGM routing', () => {
  it('keeps cozy on the title, Easy, Medium, and Hard', () => {
    expect(desiredBgm('menu', null)).toBe('cozy');
    expect(desiredBgm('menu', 'campaign')).toBe('cozy');
    expect(desiredBgm('play', 'easy')).toBe('cozy');
    expect(desiredBgm('play', 'medium')).toBe('cozy');
    expect(desiredBgm('play', 'hard')).toBe('cozy');
    expect(desiredBgm('collection', 'easy', 'play')).toBe('cozy');
    expect(desiredBgm('collection', 'campaign', 'menu')).toBe('cozy');
    expect(desiredBgm('shop', null)).toBe('cozy');
    expect(desiredBgm('shop', 'campaign')).toBe('cozy');
  });

  it('uses campaign-depths on campaign floors before the finale', () => {
    expect(desiredBgm('play', 'campaign')).toBe('campaign');
    expect(desiredBgm('play', 'campaign', null, 0)).toBe('campaign');
    expect(desiredBgm('play', 'campaign', null, 3)).toBe('campaign');
    expect(desiredBgm('collection', 'campaign', 'play', 2)).toBe('campaign');
    expect(campaignFloorActive('play', 'campaign')).toBe(true);
    expect(campaignFloorActive('menu', 'campaign')).toBe(false);
    expect(campaignFloorActive('collection', 'campaign', 'menu')).toBe(false);
    expect(bossFloorActive('play', 'campaign', null, 3)).toBe(false);
  });

  it('uses Gluttony BGM on the last campaign floor when that sin is rolled', () => {
    expect(desiredBgm('play', 'campaign', null, 4)).toBe('boss');
    expect(desiredBgm('play', 'campaign', null, 4, 'gluttony')).toBe('boss');
    expect(desiredBgm('collection', 'campaign', 'play', 4, 'gluttony')).toBe('boss');
    expect(desiredBgm('menu', 'campaign', null, 4, 'gluttony')).toBe('cozy');
    expect(desiredBgm('collection', 'campaign', 'menu', 4, 'gluttony')).toBe('cozy');
    expect(bossFloorActive('play', 'campaign', null, 4)).toBe(true);
    expect(bossFloorActive('collection', 'campaign', 'play', 4)).toBe(true);
    expect(bossFloorActive('menu', 'campaign', null, 4)).toBe(false);
    expect(bossFloorActive('play', 'hard', null, 4)).toBe(false);
    expect(finaleBgm('gluttony')).toBe('boss');
    expect(finaleBgm(null)).toBe('boss');
  });

  it('uses Wrath BGM on the last campaign floor when that sin is rolled', () => {
    expect(desiredBgm('play', 'campaign', null, 4, 'wrath')).toBe('wrath');
    expect(desiredBgm('collection', 'campaign', 'play', 4, 'wrath')).toBe('wrath');
    expect(desiredBgm('menu', 'campaign', null, 4, 'wrath')).toBe('cozy');
    expect(desiredBgm('collection', 'campaign', 'menu', 4, 'wrath')).toBe('cozy');
    expect(desiredBgm('play', 'campaign', null, 3, 'wrath')).toBe('campaign');
    expect(desiredBgm('play', 'hard', null, 0, 'wrath')).toBe('cozy');
    expect(finaleBgm('wrath')).toBe('wrath');
  });
});

describe('SFX from engine events', () => {
  it('plays dig on reveal, not on a blast', () => {
    expect(sfxFromEvents([{ type: 'reveal', indices: [0, 1] }])).toEqual(['dig']);
    expect(
      sfxFromEvents([{ type: 'explode', index: 3, wrecked: [], wave: 0 }]),
    ).toEqual(['blast']);
  });

  it('plays chest, wreck, and clear alongside the tap', () => {
    expect(
      sfxFromEvents([
        { type: 'chest', index: 1, tier: 'wooden' },
        { type: 'reveal', indices: [1] },
      ]),
    ).toEqual(['dig', 'chest']);
    expect(
      sfxFromEvents([{ type: 'explode', index: 2, wrecked: [4, 5], wave: 0 }]),
    ).toEqual(['blast', 'wreck']);
    expect(
      sfxFromEvents([
        { type: 'reveal', indices: [0] },
        { type: 'cleared', rewards: [] },
      ]),
    ).toEqual(['dig', 'clear']);
  });

  it('maps Gluttony cues without treating a campaign loss as a clear', () => {
    expect(sfxFromEvents([{ type: 'boss-move', index: 2 }])).toEqual(['boss-move']);
    expect(sfxFromEvents([{ type: 'boss-eat-flag', index: 4 }])).toEqual(['boss-eat-flag']);
    expect(
      sfxFromEvents([
        { type: 'explode', index: 1, wrecked: [], wave: 0 },
        { type: 'boss-hit', lives: 1 },
      ]),
    ).toEqual(['blast', 'boss-hit']);
    expect(
      sfxFromEvents([
        { type: 'boss-hit', lives: 0 },
        { type: 'boss-death' },
        { type: 'cleared', rewards: [] },
      ]),
    ).toEqual(['boss-hit', 'boss-death', 'clear']);
    expect(sfxFromEvents([{ type: 'lost' }])).toEqual(['campaign-lose']);
    expect(
      sfxFromEvents([{ type: 'boss-smash-chest', index: 2, tier: 'iron' }]),
    ).toEqual(['wreck']);
  });
});

describe('tab visibility', () => {
  it('suspends audio when hidden and resumes without unmuting', () => {
    const audio = getAudio();
    audio.setMuted(false);
    const before = audio.isMuted();
    audio.suspendForHidden();
    expect(audio.isHiddenSuspended()).toBe(true);
    expect(audio.isMuted()).toBe(before);
    audio.resumeFromHidden();
    expect(audio.isHiddenSuspended()).toBe(false);
    expect(audio.isMuted()).toBe(before);
  });

  it('does not resume BGM after hidden when muted', () => {
    const audio = getAudio();
    audio.setMuted(true);
    audio.suspendForHidden();
    audio.resumeFromHidden();
    expect(audio.isMuted()).toBe(true);
  });
});

describe('mute persist', () => {
  it('writes muted into the audio localStorage key and reloads it', () => {
    const store = memoryStore();
    expect(loadMuted(store)).toBe(false);
    saveMuted(true, store);
    expect(store.getItem(AUDIO_KEY)).toContain('"muted":true');
    expect(loadMuted(store)).toBe(true);
    saveMuted(false, store);
    expect(loadMuted(store)).toBe(false);
  });

  it('honors the paid-entry stub Sound key when audio has not written yet', () => {
    const off = memoryStore({ [LEGACY_SOUND_KEY]: '0' });
    expect(loadMuted(off)).toBe(true);
    const on = memoryStore({ [LEGACY_SOUND_KEY]: '1' });
    expect(loadMuted(on)).toBe(false);
  });
});
