import type { KeyStore } from '../../../src/engine';
import { keyStore as defaultNativeStore } from '../storage';

export const AUDIO_KEY = 'crawler-mines-audio';
export const LEGACY_SOUND_KEY = 'crawler-mines-sound';

export function loadMuted(store: KeyStore = defaultNativeStore): boolean {
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

export function saveMuted(muted: boolean, store: KeyStore = defaultNativeStore): void {
  store.setItem(AUDIO_KEY, JSON.stringify({ v: 1, muted }));
}
