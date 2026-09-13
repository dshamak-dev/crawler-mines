export type StoppableBgm = {
  volume: number;
  paused: boolean;
  pause: () => void;
};

/** Pause + silence every BGM clip except `except`. Position may stay. */
export function stopOtherBgm<T extends string>(
  tracks: Record<T, StoppableBgm | null>,
  except: T | null,
): void {
  for (const id of Object.keys(tracks) as T[]) {
    if (except != null && id === except) continue;
    const el = tracks[id];
    if (!el) continue;
    try {
      el.volume = 0;
      if (!el.paused) el.pause();
    } catch {
      /* ignore */
    }
  }
}
