import { loadMuted, saveMuted } from './settings';
import { bgmUrl, sfxUrl, type BgmId, type SfxId } from './urls';

const BGM_VOL: Record<BgmId, number> = {
  cozy: 0.2,
  campaign: 0.2,
  boss: 0.24,
  wrath: 0.24,
  lust: 0.24,
};
/** Incoming-only fade. Outgoing BGM is hard-stopped — never a dual-loop crossfade. */
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

function canUseAudio(): boolean {
  return typeof Audio !== 'undefined';
}

function makeTrack(src: string, loop: boolean): HTMLAudioElement | null {
  if (!canUseAudio()) return null;
  const el = new Audio(src);
  el.preload = 'auto';
  el.loop = loop;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.volume = 0;
  return el;
}

type StoppableBgm = {
  volume: number;
  paused: boolean;
  pause: () => void;
};

/** Pause + silence every BGM clip except `except`. Position may stay. */
export function stopOtherBgm(
  tracks: Record<BgmId, StoppableBgm | null>,
  except: BgmId | null,
): void {
  for (const id of Object.keys(tracks) as BgmId[]) {
    if (except != null && id === except) continue;
    const el = tracks[id];
    if (!el) continue;
    el.volume = 0;
    if (!el.paused) el.pause();
  }
}

function silenceBgm(el: HTMLAudioElement | null): void {
  if (!el) return;
  el.volume = 0;
  if (!el.paused) el.pause();
}

export class GameAudio {
  private muted = loadMuted();
  private unlocked = false;
  private hiddenSuspended = false;
  private current: BgmId | null = null;
  private pending: BgmId = 'cozy';
  private fadeGen = 0;
  private readonly bgm: Record<BgmId, HTMLAudioElement | null>;
  private readonly sfx: Record<SfxId, HTMLAudioElement | null>;

  constructor() {
    this.bgm = {
      cozy: makeTrack(bgmUrl('cozy'), true),
      campaign: makeTrack(bgmUrl('campaign'), true),
      boss: makeTrack(bgmUrl('boss'), true),
      wrath: makeTrack(bgmUrl('wrath'), true),
      lust: makeTrack(bgmUrl('lust'), true),
    };
    this.sfx = {
      dig: makeTrack(sfxUrl('dig'), false),
      flag: makeTrack(sfxUrl('flag'), false),
      chest: makeTrack(sfxUrl('chest'), false),
      blast: makeTrack(sfxUrl('blast'), false),
      wreck: makeTrack(sfxUrl('wreck'), false),
      clear: makeTrack(sfxUrl('clear'), false),
      ui: makeTrack(sfxUrl('ui'), false),
      deny: makeTrack(sfxUrl('deny'), false),
      'boss-move': makeTrack(sfxUrl('boss-move'), false),
      'boss-eat-flag': makeTrack(sfxUrl('boss-eat-flag'), false),
      'boss-death': makeTrack(sfxUrl('boss-death'), false),
      'boss-hit': makeTrack(sfxUrl('boss-hit'), false),
      'campaign-lose': makeTrack(sfxUrl('campaign-lose'), false),
    };
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** First user tap: unlock HTMLAudio (iOS) then start pending BGM if unmuted. */
  async unlock(): Promise<void> {
    if (!canUseAudio()) return;
    if (this.unlocked) {
      this.syncBgm();
      return;
    }
    const nodes = [...Object.values(this.bgm), ...Object.values(this.sfx)].filter(
      (el): el is HTMLAudioElement => !!el,
    );
    let primed = 0;
    await Promise.all(
      nodes.map(async (el) => {
        try {
          el.muted = true;
          await el.play();
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          primed += 1;
        } catch {
          try {
            el.muted = false;
          } catch {
            /* ignore */
          }
        }
      }),
    );
    if (primed === 0) return;
    this.unlocked = true;
    this.syncBgm();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.fadeGen += 1;
      for (const el of Object.values(this.bgm)) silenceBgm(el);
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
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = SFX_VOL[id];
      void el.play();
    } catch {
      /* ignore */
    }
  };

  /** Pause BGM/SFX when the tab is hidden; resume point is kept. Does not change mute. */
  suspendForHidden(): void {
    this.hiddenSuspended = true;
    this.fadeGen += 1;
    for (const el of Object.values(this.bgm)) silenceBgm(el);
    for (const el of Object.values(this.sfx)) {
      if (!el || el.paused) continue;
      el.pause();
    }
  }

  /** Resume from the pause point when visible again, only if Sound is still on. */
  resumeFromHidden(): void {
    if (!this.hiddenSuspended) return;
    this.hiddenSuspended = false;
    if (this.muted || !this.unlocked) return;
    this.syncBgm();
  }

  isHiddenSuspended(): boolean {
    return this.hiddenSuspended;
  }

  private syncBgm(fromMute = false): void {
    if (!this.unlocked || this.muted || this.hiddenSuspended) return;
    const next = this.pending;
    const incoming = this.bgm[next];
    const switching = this.current !== next;
    // Hard-stop every other loop before the incoming clip starts (or resumes).
    stopOtherBgm(this.bgm, next);
    if (!switching) {
      if (incoming && incoming.paused) {
        incoming.volume = BGM_VOL[next];
        void incoming.play().catch(() => {
          this.unlocked = false;
        });
      }
      return;
    }
    const hadCurrent = this.current != null;
    this.current = next;
    if (!incoming) return;

    const gen = ++this.fadeGen;
    incoming.volume = 0;
    void incoming.play().catch(() => {
      this.unlocked = false;
    });

    const fadeMs = fromMute || !hadCurrent ? 180 : FADE_IN_MS;
    this.ramp(incoming, 0, BGM_VOL[next], fadeMs, gen);
  }

  private ramp(el: HTMLAudioElement, from: number, to: number, ms: number, gen: number): void {
    const start = performance.now();
    const tick = (now: number) => {
      if (gen !== this.fadeGen || this.muted || this.hiddenSuspended) return;
      const k = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

let singleton: GameAudio | null = null;

export function getAudio(): GameAudio {
  singleton ??= new GameAudio();
  return singleton;
}
