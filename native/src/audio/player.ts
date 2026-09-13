import { loadMuted, saveMuted } from './settings';
import { BGM_ASSETS, SFX_ASSETS, type BgmId, type SfxId } from './urls';

type Clip = {
  volume: number;
  loop: boolean;
  paused: boolean;
  playing: boolean;
  isLoaded: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<unknown>;
};

const BGM_VOL: Record<BgmId, number> = {
  cozy: 0.2,
  campaign: 0.2,
  boss: 0.24,
  wrath: 0.24,
  lust: 0.24,
};
const FADE_IN_MS = 700;
const SFX_VOL: Record<SfxId, number> = {
  dig: 0.44,
  flag: 0.48,
  chest: 0.52,
  blast: 0.6,
  wreck: 0.52,
  clear: 0.5,
  ui: 0.38,
  deny: 0.5,
  'boss-move': 0.5,
  'boss-eat-flag': 0.56,
  'boss-hit': 0.62,
  'boss-death': 0.58,
  'campaign-lose': 0.55,
};

const BGM_IDS = Object.keys(BGM_ASSETS) as BgmId[];
const SFX_IDS = Object.keys(SFX_ASSETS) as SfxId[];

function emptyClips<T extends string>(ids: readonly T[]): Record<T, Clip | null> {
  return Object.fromEntries(ids.map((id) => [id, null])) as Record<T, Clip | null>;
}

function silence(clip: Clip | null): void {
  if (!clip) return;
  try {
    clip.volume = 0;
    if (!clip.paused) clip.pause();
  } catch {
    /* ignore */
  }
}

type ExpoAudio = typeof import('expo-audio');

export class GameAudio {
  private muted = loadMuted();
  private unlocked = false;
  private hiddenSuspended = false;
  private current: BgmId | null = null;
  private pending: BgmId = 'cozy';
  private fadeGen = 0;
  private loading: Promise<void> | null = null;
  private audioApi: ExpoAudio | null = null;
  private resumeRetry: ReturnType<typeof setTimeout> | null = null;
  private sessionGen = 0;
  private readonly bgm: Record<BgmId, Clip | null> = emptyClips(BGM_IDS);
  private readonly sfx: Record<SfxId, Clip | null> = emptyClips(SFX_IDS);

  async unlock(): Promise<void> {
    if (this.unlocked) {
      this.syncBgm();
      return;
    }
    if (!this.loading) this.loading = this.loadAll();
    try {
      await this.loading;
    } catch {
      this.loading = null;
      return;
    }
    this.unlocked = true;
    this.syncBgm();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.fadeGen += 1;
      this.stopOtherBgm(null);
      return;
    }
    if (this.unlocked) this.syncBgm(true);
  }

  setBgm(id: BgmId): void {
    this.pending = id;
    if (this.unlocked && !this.muted) this.syncBgm();
  }

  playSfx = (id: SfxId): void => {
    if (!this.unlocked || this.muted || this.hiddenSuspended) return;
    const el = this.sfx[id];
    if (!el) return;
    void (async () => {
      try {
        el.pause();
        await el.seekTo(0);
        el.volume = SFX_VOL[id];
        el.play();
      } catch {
        /* ignore */
      }
    })();
  };

  suspendForHidden(): void {
    this.hiddenSuspended = true;
    this.fadeGen += 1;
    if (this.resumeRetry) {
      clearTimeout(this.resumeRetry);
      this.resumeRetry = null;
    }
    this.stopOtherBgm(null);
    for (const id of SFX_IDS) {
      const el = this.sfx[id];
      if (!el) continue;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    this.sessionGen += 1;
  }

  /** Resume from the pause point when the app is active again. */
  resumeFromHidden(): void {
    void this.resumeFromHiddenAsync();
  }

  private async resumeFromHiddenAsync(): Promise<void> {
    this.hiddenSuspended = false;
    if (this.muted || !this.unlocked) return;
    await this.reactivateSession();
    if (this.hiddenSuspended || this.muted) return;
    this.syncBgm(true);
    // iOS often finishes session activation a beat after AppState 'active'.
    if (this.resumeRetry) clearTimeout(this.resumeRetry);
    this.resumeRetry = setTimeout(() => {
      this.resumeRetry = null;
      if (this.hiddenSuspended || this.muted || !this.unlocked) return;
      this.playCurrentBgm();
    }, 200);
  }

  private async reactivateSession(): Promise<void> {
    const audio = this.audioApi;
    if (!audio) return;
    const gen = ++this.sessionGen;
    try {
      await audio.setIsAudioActiveAsync(true);
      if (gen !== this.sessionGen) return;
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
    } catch {
      /* session is best-effort */
    }
  }

  private playCurrentBgm(): void {
    const next = this.pending;
    const incoming = this.bgm[next];
    this.stopOtherBgm(next);
    this.current = next;
    if (!incoming) return;
    try {
      incoming.volume = BGM_VOL[next];
      incoming.play();
    } catch {
      /* ignore — do not lock the player */
    }
  }

  isHiddenSuspended(): boolean {
    return this.hiddenSuspended;
  }

  /** Pause + silence every BGM clip except `except`. Position stays. */
  stopOtherBgm(except: BgmId | null): void {
    for (const id of BGM_IDS) {
      if (except != null && id === except) continue;
      silence(this.bgm[id]);
    }
  }

  private async loadAll(): Promise<void> {
    // expo-av's ExponentAV is not in Expo Go. Load expo-audio only here so a
    // missing native module cannot crash layout / Metro on import.
    const audio = await import('expo-audio').catch(() => null);
    if (!audio) return;
    this.audioApi = audio;

    try {
      await audio.setIsAudioActiveAsync(true);
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
    } catch {
      /* session mode is best-effort */
    }

    const opts = { keepAudioSessionActive: true, updateInterval: 1000 };
    for (const id of BGM_IDS) {
      try {
        const clip = audio.createAudioPlayer(BGM_ASSETS[id], opts);
        clip.loop = true;
        clip.volume = 0;
        this.bgm[id] = clip;
      } catch {
        this.bgm[id] = null;
      }
    }
    for (const id of SFX_IDS) {
      try {
        const clip = audio.createAudioPlayer(SFX_ASSETS[id], opts);
        clip.loop = false;
        clip.volume = SFX_VOL[id];
        this.sfx[id] = clip;
      } catch {
        this.sfx[id] = null;
      }
    }
  }

  private syncBgm(fromMute = false): void {
    if (!this.unlocked || this.muted || this.hiddenSuspended) return;
    const next = this.pending;
    const incoming = this.bgm[next];
    const switching = this.current !== next;
    this.stopOtherBgm(next);
    if (!switching) {
      if (incoming) {
        try {
          incoming.volume = BGM_VOL[next];
          incoming.play();
        } catch {
          /* ignore — do not lock the player */
        }
      }
      return;
    }
    const hadCurrent = this.current != null;
    this.current = next;
    if (!incoming) return;
    const gen = ++this.fadeGen;
    try {
      incoming.volume = 0;
      incoming.play();
    } catch {
      return;
    }
    const fadeMs = fromMute || !hadCurrent ? 180 : FADE_IN_MS;
    this.ramp(incoming, 0, BGM_VOL[next], fadeMs, gen);
  }

  private ramp(el: Clip, from: number, to: number, ms: number, gen: number): void {
    const start = Date.now();
    const tick = () => {
      if (gen !== this.fadeGen || this.muted || this.hiddenSuspended) return;
      const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - start) / ms);
      try {
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      } catch {
        return;
      }
      if (k < 1) setTimeout(tick, 32);
    };
    tick();
  }
}

let singleton: GameAudio | null = null;

export function getAudio(): GameAudio {
  singleton ??= new GameAudio();
  return singleton;
}
