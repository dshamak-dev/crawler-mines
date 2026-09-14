import {
  addItem,
  goldForLoot,
  rollSecretChestLoot,
  type ItemId,
} from './loot';
import type { Cell, ChestReward, Game, Rng } from './types';

export function isSecretChestCell(c: Cell): boolean {
  return c.kind === 'chest' && c.tier === 'secret';
}

/** Revealed, intact, and still waiting for a rusty key. */
export function isLockedSecretChest(c: Cell): boolean {
  return isSecretChestCell(c) && !c.wrecked && c.state === 'revealed' && c.loot == null;
}

export function isUnlockedSecretChest(c: Cell): boolean {
  return isSecretChestCell(c) && !c.wrecked && c.state === 'revealed' && c.loot != null;
}

export function stampSecretLoot(cell: Cell, rng: Rng, drops = rollSecretChestLoot(rng)): ItemId[] {
  cell.loot = drops[0] ?? null;
  cell.lootExtra = drops[1] ?? null;
  let gold = 0;
  for (const id of drops) gold += goldForLoot(id, rng);
  cell.gold = gold;
  return drops;
}

/** Stamp one locked secret. Caller spends the rusty key. */
export function unlockSecretChestCell(cell: Cell, rustyKeys: number, rng: Rng): boolean {
  if (!isLockedSecretChest(cell) || rustyKeys < 1) return false;
  stampSecretLoot(cell, rng);
  return true;
}

/** Stamp remaining locked secrets, one rusty key each. Returns how many keys to spend. */
export function unlockRemainingSecretChests(game: Game, rustyKeys: number, rng: Rng): number {
  let keys = Math.max(0, Math.floor(rustyKeys));
  let consumed = 0;
  for (const cell of game.cells) {
    if (!isLockedSecretChest(cell) || keys < 1) continue;
    stampSecretLoot(cell, rng);
    keys -= 1;
    consumed += 1;
  }
  return consumed;
}

/** Grant stamped secret loot into floor inventory. Call once on a successful clear. */
export function grantSecretChests(game: Game): ChestReward[] {
  const rewards: ChestReward[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const c = game.cells[i];
    if (!isUnlockedSecretChest(c) || !c.loot) continue;
    const drops: ItemId[] = [c.loot];
    if (c.lootExtra) drops.push(c.lootExtra);
    let goldLeft = c.gold;
    for (const itemId of drops) {
      const gold = itemId === 'gold-pouch' ? goldLeft : 0;
      if (itemId === 'gold-pouch') goldLeft = 0;
      game.gold += gold;
      if (itemId !== 'gold-pouch') {
        game.inventory = addItem(game.inventory, itemId);
      }
      rewards.push({ index: i, itemId, gold });
    }
  }
  return rewards;
}
