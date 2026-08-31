import type { BossId, GameEvent } from '../engine';
import { isCampaignFinale, type Difficulty } from '../engine';
import type { BgmId, SfxId } from './urls';

export type AppScreen = 'menu' | 'play' | 'collection' | 'shop';

export type DifficultyMode = Difficulty;

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

/** Last campaign floor only — Gluttony or Wrath fight, including pack opened from it. */
export function bossFloorActive(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
  floor = 0,
): boolean {
  return (
    campaignFloorActive(screen, mode, collectionFrom) &&
    mode === 'campaign' &&
    isCampaignFinale(mode, floor)
  );
}

/** Live campaign-run boss — never a second roll. Lust reuses Gluttony's loop. */
export function finaleBgm(bossId: BossId | null | undefined): BgmId {
  return bossId === 'wrath' ? 'wrath' : 'boss';
}

export function desiredBgm(
  screen: AppScreen,
  mode: DifficultyMode | null,
  collectionFrom: AppScreen | null = null,
  floor = 0,
  bossId: BossId | null = null,
): BgmId {
  if (bossFloorActive(screen, mode, collectionFrom, floor)) return finaleBgm(bossId);
  if (campaignFloorActive(screen, mode, collectionFrom)) return 'campaign';
  return 'cozy';
}

/** Map a dig/flag engine events to one-shot SFX ids (order is play order). */
export function sfxFromEvents(events: ReadonlyArray<GameEvent>): SfxId[] {
  let revealed = false;
  let blasted = false;
  let wrecked = false;
  let chest = false;
  let cleared = false;
  let lost = false;
  let bossMove = false;
  let bossEat = false;
  let bossHit = false;
  let bossDeath = false;
  for (const e of events) {
    if (e.type === 'reveal') revealed = true;
    else if (e.type === 'explode') {
      blasted = true;
      if (e.wrecked.length > 0) wrecked = true;
    } else if (e.type === 'chest') chest = true;
    else if (e.type === 'cleared') cleared = true;
    else if (e.type === 'lost') lost = true;
    else if (e.type === 'boss-move') bossMove = true;
    else if (e.type === 'boss-eat-flag') bossEat = true;
    else if (e.type === 'boss-smash-chest') wrecked = true;
    else if (e.type === 'boss-hit') bossHit = true;
    else if (e.type === 'boss-death') bossDeath = true;
  }
  const out: SfxId[] = [];
  if (revealed) out.push('dig');
  if (blasted) out.push('blast');
  if (wrecked) out.push('wreck');
  if (chest) out.push('chest');
  if (bossHit) out.push('boss-hit');
  if (bossDeath) out.push('boss-death');
  if (bossMove) out.push('boss-move');
  if (bossEat) out.push('boss-eat-flag');
  if (cleared) out.push('clear');
  if (lost) out.push('campaign-lose');
  return out;
}
