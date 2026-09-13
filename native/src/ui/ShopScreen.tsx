import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  buyGold,
  buyableEntries,
  clampBuyQty,
  clampSellQty,
  sellGold,
  sellableEntries,
  shopSelectionAfterModeChange,
  type CollectionState,
  type ItemId,
  type RitualSlots,
  type ShopMode,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { GoldIcon, ItemIcon } from './icons';
import ItemPreviewSheet, { previewForItem, type ItemPreviewModel } from './ItemPreviewSheet';
import RitualSheet from './RitualSheet';
import { DisplayText, GhostButton, StoneButton } from './primitives';

export default function ShopScreen({
  meta,
  onBack,
  onSell,
  onBuy,
  onUi,
  onDeny,
  onStartRite,
}: {
  meta: CollectionState;
  onBack: () => void;
  onSell: (itemId: ItemId, qty: number) => boolean;
  onBuy: (itemId: ItemId, qty: number) => boolean;
  onUi: () => void;
  onDeny: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
}) {
  const [mode, setMode] = useState<ShopMode>('sell');
  const [slotted, setSlotted] = useState<ItemId | null>(null);
  const [qty, setQty] = useState(0);
  const [preview, setPreview] = useState<ItemPreviewModel | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);

  const sellRows = sellableEntries(meta.items);
  const buyRows = buyableEntries();
  const rows = mode === 'sell' ? sellRows : buyRows;
  const owned = slotted ? Math.max(0, meta.items[slotted] ?? 0) : 0;
  const empty = mode === 'sell' ? !slotted || owned < 1 : !slotted;
  const liveQty =
    empty || !slotted ? 0 : mode === 'sell' ? clampSellQty(owned, qty) : clampBuyQty(qty);
  const unit = !slotted ? 0 : mode === 'sell' ? sellGold(slotted) : buyGold(slotted);
  const total = empty || !slotted ? 0 : unit * liveQty;

  const caption = useMemo(() => {
    if (empty || !slotted) return mode === 'sell' ? 'Tap an item to sell.' : 'Tap an item to buy.';
    if (mode === 'sell') return `${ITEMS[slotted].name} · ${owned} owned`;
    return `${ITEMS[slotted].name} · ${unit} each`;
  }, [empty, slotted, owned, mode, unit]);

  const changeMode = (next: ShopMode) => {
    const after = shopSelectionAfterModeChange(mode, next, slotted, qty);
    if (after.mode === mode && after.slotted === slotted) return;
    onUi();
    setMode(after.mode);
    setSlotted(after.slotted);
    setQty(after.qty);
  };

  const slotItem = (id: ItemId) => {
    onUi();
    setSlotted(id);
    setQty(1);
    setPreview(previewForItem(id, meta.items[id] ?? 0, Boolean(onStartRite)));
  };

  const bump = (delta: number) => {
    if (empty) return;
    onUi();
    setQty(mode === 'sell' ? clampSellQty(owned, liveQty + delta) : clampBuyQty(liveQty + delta));
  };

  const confirm = () => {
    if (empty || !slotted || liveQty < 1) {
      onDeny();
      return;
    }
    onUi();
    const ok = mode === 'sell' ? onSell(slotted, liveQty) : onBuy(slotted, liveQty);
    if (!ok) {
      onDeny();
      return;
    }
    if (mode === 'buy') return;
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
      <View style={styles.stage}>
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

        <View style={styles.modes}>
          <StoneButton
            gold={mode === 'sell'}
            onPress={() => changeMode('sell')}
            style={styles.modePill}
            accessibilityLabel="Sell"
          >
            Sell
          </StoneButton>
          <StoneButton
            gold={mode === 'buy'}
            onPress={() => changeMode('buy')}
            style={styles.modePill}
            accessibilityLabel="Buy"
          >
            Buy
          </StoneButton>
        </View>

        <Text style={styles.stashLabel}>{mode === 'sell' ? 'Your stash' : 'For sale'}</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {mode === 'sell' ? 'Nothing sellable yet.' : 'Nothing for sale yet.'}
          </Text>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.grid}>
            {rows.map((row) => {
              const count = 'count' in row ? row.count : undefined;
              return (
                <Pressable
                  key={row.item.id}
                  style={[styles.cell, slotted === row.item.id && styles.cellOn]}
                  onPress={() => slotItem(row.item.id)}
                  accessibilityLabel={
                    count != null
                      ? `${row.item.name}, ${count} owned`
                      : `${row.item.name}, ${row.gold} gold`
                  }
                >
                  <ItemIcon id={row.item.id} size={36} />
                  <Text style={styles.cellQty}>{count != null ? `x${count}` : row.gold}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

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

        <StoneButton gold={!empty} locked={empty} onPress={confirm} style={styles.sell}>
          {empty ? (
            mode === 'sell' ? (
              'Sell for —'
            ) : (
              'Buy for —'
            )
          ) : (
            <View style={styles.sellRow}>
              <Text style={styles.sellText}>
                {mode === 'sell' ? `Sell for ${total}` : `Buy for ${total}`}
              </Text>
              <GoldIcon size={20} />
            </View>
          )}
        </StoneButton>
      </View>
      </View>
      {preview ? (
        <ItemPreviewSheet
          preview={preview}
          onUse={() => {
            setPreview(null);
            setRitualOpen(true);
          }}
          onClose={() => setPreview(null)}
          onUi={onUi}
        />
      ) : null}
      {ritualOpen && onStartRite ? (
        <RitualSheet
          meta={meta}
          onUse={(slots) => onStartRite(slots)}
          onClose={() => {
            onUi();
            setRitualOpen(false);
          }}
          onUi={onUi}
          onDeny={onDeny}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, position: 'relative' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  modes: { flexDirection: 'row', gap: 8 },
  modePill: { flex: 1, justifyContent: 'center', minHeight: 44, paddingVertical: 8 },
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
  stashLabel: { fontFamily: fonts.display, color: colors.gold2, letterSpacing: 0.8, fontSize: 14, textAlign: 'center' },
  list: { maxHeight: 148, flexGrow: 0 },
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
});
