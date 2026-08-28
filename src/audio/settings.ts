import { defaultStore, type KeyStore } from '../engine';

export const AUDIO_KEY = 'crawler-mines-audio';

export function loadMuted(store: KeyStore = defaultStore()): boolean {
  const raw = store.getItem(AUDIO_KEY);
  if (!raw) return false;
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
