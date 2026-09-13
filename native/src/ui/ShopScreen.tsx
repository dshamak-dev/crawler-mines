import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  clampSellQty,
  ITEMS,
  sellableEntries,
  sellGold,
  type CollectionState,
  type ItemId,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { GoldIcon, ItemIcon } from './icons';
import { DisplayText, GhostButton, StoneButton } from './primitives';

export default function ShopScreen({
  meta,
  onBack,
  onSell,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onBack: () => void;
  onSell: (itemId: ItemId, qty: number) => boolean;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [slotted, setSlotted] = useState<ItemId | null>(null);
  const [qty, setQty] = useState(0);
  const rows = sellableEntries(meta.items);
  const owned = slotted ? Math.max(0, meta.items[slotted] ?? 0) : 0;
  const empty = !slotted || owned < 1;
  const liveQty = empty ? 0 : clampSellQty(owned, qty);
  const total = empty || !slotted ? 0 : sellGold(slotted) * liveQty;

  const caption = useMemo(() => {
    if (empty || !slotted) return 'Tap an item to sell.';
    return `${ITEMS[slotted].name} · ${owned} owned`;
  }, [empty, slotted, owned]);

  const slotItem = (id: ItemId) => {
    onUi();
    setSlotted(id);
    setQty(1);
  };

  const bump = (delta: number) => {
    if (empty) return;
    onUi();
    setQty(clampSellQty(owned, liveQty + delta));
  };

  const confirmSell = () => {
    if (empty || !slotted || liveQty < 1) {
      onDeny();
      return;
    }
    onUi();
    const ok = onSell(slotted, liveQty);
    if (!ok) {
      onDeny();
      return;
    }
    const remain = owned - liveQty;
    if (remain < 1) {
      setSlotted(null);
      setQty(0);
      return;
    }
    setQty(clampSellQty(remain, liveQty));
  };

  return (
    <View style={styles.shell}>
      <View style={styles.tablet}>
        <View style={styles.head}>
          <GhostButton
            onPress={() => {
              onUi();
              onBack();
            }}
            accessibilityLabel="Back"
            style={styles.backThumb}
          >
            <Text style={styles.chev}>‹</Text>
          </GhostButton>
          <DisplayText style={styles.h1}>Shop</DisplayText>
          <View style={styles.wallet}>
            <GoldIcon size={18} />
            <Text style={styles.walletN}>{meta.gold}</Text>
          </View>
        </View>

        <View style={[styles.slot, empty && styles.slotEmpty]}>
          {!empty && slotted ? <ItemIcon id={slotted} size={64} /> : null}
        </View>
        <Text style={styles.caption}>{caption}</Text>

        <View style={styles.qty}>
          <StoneButton disabled={empty} onPress={() => bump(-1)} style={styles.step} accessibilityLabel="Decrease quantity">
            −
          </StoneButton>
          <Text style={styles.qtyN}>{liveQty}</Text>
          <StoneButton disabled={empty} onPress={() => bump(1)} style={styles.step} accessibilityLabel="Increase quantity">
            +
          </StoneButton>
        </View>
        {!empty ? <Text style={styles.qtyLabel}>Qty</Text> : null}

        <StoneButton
          gold={!empty}
          locked={empty}
          onPress={confirmSell}
          style={styles.sell}
        >
          {empty ? (
            'Sell for —'
          ) : (
            <View style={styles.sellRow}>
              <Text style={styles.sellText}>Sell for {total}</Text>
              <GoldIcon size={20} />
            </View>
          )}
        </StoneButton>

        <View style={styles.rule} />
        <Text style={styles.stashLabel}>Your stash</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>Nothing sellable yet.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {rows.map(({ item, count }) => (
              <Pressable
                key={item.id}
                style={[styles.cell, slotted === item.id && styles.cellOn]}
                onPress={() => slotItem(item.id)}
                accessibilityLabel={`${item.name}, ${count} owned`}
              >
                <ItemIcon id={item.id} size={36} />
                <Text style={styles.cellQty}>x{count}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Text style={styles.foot}>Sell only.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tablet: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '92%',
    backgroundColor: '#241e1a',
    borderWidth: 1,
    borderColor: '#6b5340',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  backThumb: { width: 48, height: 48 },
  chev: { color: colors.ink, fontSize: 28, lineHeight: 32 },
  h1: { flex: 1, textTransform: 'uppercase', letterSpacing: 2, fontSize: 19 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 48, justifyContent: 'flex-end' },
  walletN: { fontFamily: fonts.uiBold, color: colors.gold2, fontSize: 16 },
  slot: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  slotEmpty: { borderStyle: 'dashed', borderColor: 'rgba(224, 180, 74, 0.55)' },
  caption: { fontFamily: fonts.ui, color: colors.gold2, fontSize: 15, textAlign: 'center' },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: 220,
    maxWidth: '100%',
    gap: 10,
  },
  step: { width: 52, minHeight: 48, justifyContent: 'center', paddingVertical: 0 },
  qtyN: { flex: 1, textAlign: 'center', fontFamily: fonts.display, color: colors.gold2, fontSize: 22 },
  qtyLabel: { fontFamily: fonts.ui, color: colors.muted, fontSize: 12, textAlign: 'center' },
  sell: { justifyContent: 'center', minHeight: 52 },
  sellRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sellText: { fontFamily: fonts.display, color: colors.gold2, fontSize: 17 },
  rule: { height: 1, marginHorizontal: 12, backgroundColor: 'rgba(224, 180, 74, 0.45)' },
  stashLabel: { fontFamily: fonts.display, color: colors.gold2, letterSpacing: 0.8, fontSize: 14, textAlign: 'center' },
  empty: { fontFamily: fonts.ui, color: colors.muted, fontSize: 14, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  cell: {
    width: '22%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.32)',
    borderRadius: 12,
    backgroundColor: '#1a1512',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { borderWidth: 2, borderColor: colors.gold },
  cellQty: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    fontFamily: fonts.display,
    color: colors.gold2,
    fontSize: 11,
  },
  foot: { fontFamily: fonts.ui, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
