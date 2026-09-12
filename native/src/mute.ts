import { create } from 'zustand';
import { getAudio } from './audio/player';
import { loadMuted } from './audio/settings';

export const useMuteStore = create<{ muted: boolean; toggle: () => void }>((set, get) => ({
  muted: loadMuted(),
  toggle: () => {
    const next = !get().muted;
    getAudio().setMuted(next);
    set({ muted: next });
  },
}));
