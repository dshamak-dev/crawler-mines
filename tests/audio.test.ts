import { describe, expect, it } from 'vitest';
import {
  AUDIO_KEY,
  audioUrl,
  bgmUrl,
  campaignFloorActive,
  desiredBgm,
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
    expect(sfxUrl('deny')).toBe('/crawler-mines/audio/sfx-deny.wav');
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
  });

  it('uses campaign-depths only while a Campaign floor is up', () => {
    expect(desiredBgm('play', 'campaign')).toBe('campaign');
    expect(desiredBgm('collection', 'campaign', 'play')).toBe('campaign');
    expect(campaignFloorActive('play', 'campaign')).toBe(true);
    expect(campaignFloorActive('menu', 'campaign')).toBe(false);
    expect(campaignFloorActive('collection', 'campaign', 'menu')).toBe(false);
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
});
