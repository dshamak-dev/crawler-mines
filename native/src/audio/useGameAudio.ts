import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { BossId } from '../../../src/engine';
import type { AppScreen, DifficultyMode } from './cues';
import { desiredBgm } from './cues';
import { getAudio } from './player';
import { loadMuted } from './settings';
import type { SfxId } from './urls';

export function useGameAudio(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null,
  floor = 0,
  bossId: BossId | null = null,
) {
  const [muted, setMutedState] = useState(() => loadMuted());

  useEffect(() => {
    const audio = getAudio();
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') audio.resumeFromHidden();
      else audio.suspendForHidden();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getAudio().setBgm(desiredBgm(screen, mode, collectionFrom, floor, bossId));
  }, [screen, mode, collectionFrom, floor, bossId]);

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

  const unlock = useCallback(() => {
    void getAudio().unlock();
  }, []);

  return { muted, setMuted, toggleMuted, playSfx, unlock };
}
