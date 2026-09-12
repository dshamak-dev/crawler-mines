import { Audio, InterruptionModeAndroid, InterruptionModeIOS, type AVPlaybackStatus } from 'expo-av';
import { loadMuted, saveMuted } from './settings';
import { BGM_ASSETS, SFX_ASSETS, type BgmId, type SfxId } from './urls';

type Sound = Audio.Sound;

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

async function silence(sound: Sound | null): Promise<void> {
  if (!sound) return;
  try {
    await sound.setVolumeAsync(0);
    const status = await sound.getStatusAsync();
    if (status.isLoaded && status.isPlaying) await sound.pauseAsync();
  } catch {
    /* ignore */
  }
}

export class GameAudio {
  private muted = loadMuted();
  private unlocked = false;
  private hiddenSuspended = false;
  private current: BgmId | null = null;
  private pending: BgmId = 'cozy';
  private fadeGen = 0;
  private loading: Promise<void> | null = null;
  private readonly bgm: Record<BgmId, Sound | null> = {
    cozy: null,
    campaign: null,
    boss: null,
    wrath: null,
    lust: null,
  };
  private readonly sfx: Record<SfxId, Sound | null> = {
    dig: null,
    flag: null,
    chest: null,
    blast: null,
    wreck: null,
    clear: null,
    ui: null,
    deny: null,
    'boss-move': null,
    'boss-eat-flag': null,
    'boss-hit': null,
    'boss-death': null,
    'campaign-lose': null,
  };

  async unlock(): Promise<void> {
    if (this.unlocked) {
      await this.syncBgm();
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
    await this.syncBgm();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.fadeGen += 1;
      void this.stopOtherBgm(null);
      return;
    }
    if (this.unlocked) void this.syncBgm(true);
  }

  setBgm(id: BgmId): void {
    this.pending = id;
    if (this.unlocked && !this.muted) void this.syncBgm();
  }

  playSfx = (id: SfxId): void => {
    if (!this.unlocked || this.muted || this.hiddenSuspended) return;
    const el = this.sfx[id];
    if (!el) return;
    void (async () => {
      try {
        const status = await el.getStatusAsync();
        if (!status.isLoaded) return;
        await el.setPositionAsync(0);
        await el.setVolumeAsync(SFX_VOL[id]);
        await el.playAsync();
      } catch {
        /* ignore */
      }
    })();
  };

  suspendForHidden(): void {
    this.hiddenSuspended = true;
    this.fadeGen += 1;
    void this.stopOtherBgm(null);
    for (const id of SFX_IDS) {
      const el = this.sfx[id];
      if (!el) continue;
      void el.getStatusAsync().then((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.isPlaying) void el.pauseAsync();
      });
    }
  }

  resumeFromHidden(): void {
    if (!this.hiddenSuspended) return;
    this.hiddenSuspended = false;
    if (this.muted || !this.unlocked) return;
    void this.syncBgm();
  }

  isHiddenSuspended(): boolean {
    return this.hiddenSuspended;
  }

  /** Pause + silence every BGM clip except `except`. Position stays. */
  async stopOtherBgm(except: BgmId | null): Promise<void> {
    await Promise.all(
      BGM_IDS.filter((id) => except == null || id !== except).map((id) => silence(this.bgm[id])),
    );
  }

  private async loadAll(): Promise<void> {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    });
    await Promise.all([
      ...BGM_IDS.map(async (id) => {
        const { sound } = await Audio.Sound.createAsync(
          BGM_ASSETS[id],
          { isLooping: true, volume: 0, shouldPlay: false },
        );
        this.bgm[id] = sound;
      }),
      ...SFX_IDS.map(async (id) => {
        const { sound } = await Audio.Sound.createAsync(
          SFX_ASSETS[id],
          { isLooping: false, volume: SFX_VOL[id], shouldPlay: false },
        );
        this.sfx[id] = sound;
      }),
    ]);
  }

  private async syncBgm(fromMute = false): Promise<void> {
    if (!this.unlocked || this.muted || this.hiddenSuspended) return;
    const next = this.pending;
    const incoming = this.bgm[next];
    const switching = this.current !== next;
    await this.stopOtherBgm(next);
    if (!switching) {
      if (incoming) {
        try {
          const status = await incoming.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            await incoming.setVolumeAsync(BGM_VOL[next]);
            await incoming.playAsync();
          }
        } catch {
          this.unlocked = false;
        }
      }
      return;
    }
    const hadCurrent = this.current != null;
    this.current = next;
    if (!incoming) return;
    const gen = ++this.fadeGen;
    try {
      await incoming.setVolumeAsync(0);
      await incoming.playAsync();
    } catch {
      this.unlocked = false;
      return;
    }
    const fadeMs = fromMute || !hadCurrent ? 180 : FADE_IN_MS;
    this.ramp(incoming, 0, BGM_VOL[next], fadeMs, gen);
  }

  private ramp(el: Sound, from: number, to: number, ms: number, gen: number): void {
    const start = Date.now();
    const tick = () => {
      if (gen !== this.fadeGen || this.muted || this.hiddenSuspended) return;
      const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - start) / ms);
      void el.setVolumeAsync(Math.max(0, Math.min(1, from + (to - from) * k)));
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
