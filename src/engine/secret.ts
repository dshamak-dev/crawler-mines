import { ITEMS, SECRET_CHEST_ID, type Inventory, type ItemId } from './loot';
import type { Cell } from './types';

export function isSecretChestCell(c: Cell): boolean {
  return c.kind === 'chest' && c.tier === 'secret';
}

/** Revealed and still intact. Banked as a Collection stack after a successful clear. */
export function isIntactSecretChest(c: Cell): boolean {
  return isSecretChestCell(c) && !c.wrecked && c.state === 'revealed';
}

export interface SecretKeyPickerRow {
  id: ItemId;
  name: string;
  count: number;
  disabled: boolean;
}

/** Title Collection well: only a rusty key sockets. Empty pack → nothing to pick. */
export function secretKeyPickerRows(meta: { items: Inventory }): SecretKeyPickerRow[] {
  const count = Math.max(0, Math.floor(meta.items['rusty-key'] ?? 0));
  if (count < 1) return [];
  return [{ id: 'rusty-key', name: ITEMS['rusty-key'].name, count, disabled: false }];
}

export function secretChestCaption(socketed: ItemId | null): string {
  if (socketed === 'rusty-key') return 'Ready to open';
  return 'Need a rusty key';
}

export function canOpenSecretChest(meta: { items: Inventory }, socketed: ItemId | null): boolean {
  if (socketed !== 'rusty-key') return false;
  const chests = Math.max(0, Math.floor(meta.items[SECRET_CHEST_ID] ?? 0));
  const keys = Math.max(0, Math.floor(meta.items['rusty-key'] ?? 0));
  return chests >= 1 && keys >= 1;
}
