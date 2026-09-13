import { loadMuted as loadMutedFrom, saveMuted as saveMutedFrom } from '../../../src/engine';
import { keyStore as defaultNativeStore } from '../storage';
import type { KeyStore } from '../../../src/engine';

export { AUDIO_KEY, LEGACY_SOUND_KEY } from '../../../src/engine';

export function loadMuted(store: KeyStore = defaultNativeStore): boolean {
  return loadMutedFrom(store);
}

export function saveMuted(muted: boolean, store: KeyStore = defaultNativeStore): void {
  saveMutedFrom(muted, store);
}
