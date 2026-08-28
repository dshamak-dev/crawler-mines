import { useCallback, useEffect, useState } from 'react';
import type { AppScreen, DifficultyMode } from './cues';
import { desiredBgm } from './cues';
import { getAudio } from './player';
import { loadMuted } from './settings';
import type { SfxId } from './urls';

export function useGameAudio(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null,
) {
  const [muted, setMutedState] = useState(() => loadMuted());

  useEffect(() => {
    const audio = getAudio();
    const onGesture = () => {
      void audio.unlock();
    };
    window.addEventListener('pointerdown', onGesture, { capture: true });
    window.addEventListener('keydown', onGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, []);

  useEffect(() => {
    getAudio().setBgm(desiredBgm(screen, mode, collectionFrom));
  }, [screen, mode, collectionFrom]);

  const setMuted = useCallback((next: boolean) => {
    getAudio().setMuted(next);
    setMutedState(next);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(!getAudio().isMuted());
  }, [setMuted]);

  const playSfx = useCallback((id: SfxId) => {
    getAudio().playSfx(id);
  }, []);

  return { muted, setMuted, toggleMuted, playSfx };
}
