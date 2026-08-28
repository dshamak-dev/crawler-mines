import type { GameEvent } from '../engine';
import type { BgmId, SfxId } from './urls';

export type AppScreen = 'menu' | 'play' | 'collection';

export type DifficultyMode = 'easy' | 'medium' | 'hard' | 'campaign';

/**
 * Campaign BGM only while a campaign floor is actually up (in-run or pack
 * opened from that floor). Title / Easy / Medium / Hard stay on cozy.
 */
export function campaignFloorActive(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
): boolean {
  if (mode !== 'campaign') return false;
  if (screen === 'play') return true;
  return screen === 'collection' && collectionFrom === 'play';
}

export function desiredBgm(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
): BgmId {
  return campaignFloorActive(screen, mode, collectionFrom) ? 'campaign' : 'cozy';
}

/** Map a dig's engine events to one-shot SFX ids (order is play order). */
export function sfxFromEvents(events: ReadonlyArray<GameEvent>): SfxId[] {
  let revealed = false;
  let blasted = false;
  let wrecked = false;
  let chest = false;
  let cleared = false;
  for (const e of events) {
    if (e.type === 'reveal') revealed = true;
    else if (e.type === 'explode') {
      blasted = true;
      if (e.wrecked.length > 0) wrecked = true;
    } else if (e.type === 'chest') chest = true;
    else if (e.type === 'cleared') cleared = true;
  }
  const out: SfxId[] = [];
  if (revealed) out.push('dig');
  if (blasted) out.push('blast');
  if (wrecked) out.push('wreck');
  if (chest) out.push('chest');
  if (cleared) out.push('clear');
  return out;
}
