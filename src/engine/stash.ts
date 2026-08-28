import { addItem, emptyInventory, isCollectible, type Inventory, type ItemId } from './loot';
import type { Rng } from './types';

export interface CampaignStash {
  gold: number;
  items: Inventory;
}

export function emptyStash(): CampaignStash {
  return { gold: 0, items: emptyInventory() };
}

export function mergeStash(
  stash: CampaignStash,
  rewards: ReadonlyArray<{ itemId: ItemId; gold: number }>,
): CampaignStash {
  let gold = Math.max(0, Math.floor(stash.gold));
  let items = { ...stash.items };
  for (const r of rewards) {
    if (r.itemId === 'gold-pouch') {
      gold += Math.max(0, Math.floor(r.gold));
    } else if (isCollectible(r.itemId)) {
      items = addItem(items, r.itemId);
    }
  }
  return { gold, items };
}

export function stashToRewards(
  stash: CampaignStash,
): Array<{ itemId: ItemId; gold: number }> {
  const out: Array<{ itemId: ItemId; gold: number }> = [];
  for (const id of Object.keys(stash.items) as ItemId[]) {
    if (!isCollectible(id)) continue;
    const n = stash.items[id] ?? 0;
    for (let i = 0; i < n; i++) out.push({ itemId: id, gold: 0 });
  }
  if (stash.gold > 0) out.push({ itemId: 'gold-pouch', gold: Math.floor(stash.gold) });
  return out;
}

export function rollBonusKey(rng: Rng): 'hard-key' | 'campaign-key' {
  return rng() < 0.5 ? 'hard-key' : 'campaign-key';
}
