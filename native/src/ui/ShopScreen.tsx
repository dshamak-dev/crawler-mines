import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  SHOP_BUY,
  SKINS,
  buyGold,
  buyableEntries,
  clampBuyQty,
  clampSellQty,
  isItemId,
  isSkinId,
  isSkinOwned,
  sellGold,
  sellableEntries,
  shopSelectionAfterModeChange,
  type CollectionState,
  type ItemId,
  type RitualSlots,
  type ShopGoodId,
  type ShopMode,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { GoldIcon, ItemIcon, SkinIcon } from './icons';
import ItemPreviewSheet, {
  previewForItem,
  previewForSkin,
  type ItemPreviewModel,
} from './ItemPreviewSheet';
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
  onBuy: (id: ShopGoodId, qty: number) => boolean;
  onUi: () => void;
  onDeny: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
}) {
  const [mode, setMode] = useState<ShopMode>('sell');
  const [slotted, setSlotted] = useState<ShopGoodId | null>(null);
  const [qty, setQty] = useState(0);
  const [preview, setPreview] = useState<ItemPreviewModel | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);

  const sellRows = sellableEntries(meta.items);
  const buyRows = useMemo(() => buyableEntries(SHOP_BUY, meta), [meta]);
  const rows = mode === 'sell' ? sellRows : buyRows;
  const ownedItem = slotted && isItemId(slotted) ? Math.max(0, meta.items[slotted] ?? 0) : 0;
  const skinOwned = slotted && isSkinId(slotted) ? isSkinOwned(meta, slotted) : false;
  const skinForSale = Boolean(slotted && isSkinId(slotted) && buyGold(slotted) > 0 && !skinOwned);
  const empty =
    mode === 'sell'
      ? !slotted || !isItemId(slotted) || ownedItem < 1
      : !slotted || (isSkinId(slotted) && !skinForSale);
  const liveQty =
    empty || !slotted
      ? 0
      : mode === 'sell'
        ? clampSellQty(ownedItem, qty)
        : clampBuyQty(qty, isSkinId(slotted) ? 1 : 99);
  const unit = !slotted ? 0 : mode === 'sell' && isItemId(slotted) ? sellGold(slotted) : buyGold(slotted);
  const total = empty || !slotted ? 0 : unit * liveQty;
  const captionName = slotted
    ? isSkinId(slotted)
      ? SKINS[slotted].name
      : ITEMS[slotted].name
    : '';

  const caption = useMemo(() => {
    if (empty || !slotted) {
      if (mode === 'sell') return 'Tap an item to sell.';
      if (slotted && isSkinId(slotted) && skinOwned) return `${SKINS[slotted].name} · owned`;
      return 'Tap an item to buy.';
    }
    if (mode === 'sell' && isItemId(slotted)) return `${ITEMS[slotted].name} · ${ownedItem} owned`;
    return `${captionName} · ${unit} each`;
  }, [empty, slotted, ownedItem, mode, unit, skinOwned, captionName]);

  const changeMode = (next: ShopMode) => {
    const after = shopSelectionAfterModeChange(mode, next, slotted, qty);
    if (after.mode === mode && after.slotted === slotted) return;
    onUi();
    setMode(after.mode);
    setSlotted(after.slotted);
    setQty(after.qty);
  };

  const slotGood = (id: ShopGoodId) => {
    onUi();
    setSlotted(id);
    setQty(1);
  };

  const openPreview = (id: ShopGoodId) => {
    onUi();
    if (isSkinId(id)) {
      setPreview(previewForSkin(id, isSkinOwned(meta, id), false, false));
      return;
    }
    setPreview(previewForItem(id, meta.items[id] ?? 0, Boolean(onStartRite)));
  };

  const bump = (delta: number) => {
    if (empty) return;
    onUi();
    setQty(
      mode === 'sell'
        ? clampSellQty(ownedItem, liveQty + delta)
        : clampBuyQty(liveQty + delta, slotted && isSkinId(slotted) ? 1 : 99),
    );
  };

  const confirm = () => {
    if (empty || !slotted || liveQty < 1) {
      onDeny();
      return;
    }
    onUi();
    const ok =
      mode === 'sell' && isItemId(slotted)
        ? onSell(slotted, liveQty)
        : onBuy(slotted, liveQty);
    if (!ok) {
      onDeny();
      return;
    }
    if (mode === 'buy') {
      if (isSkinId(slotted)) {
        setSlotted(null);
        setQty(0);
      }
      return;
    }
    const remain = ownedItem - liveQty;
    if (remain < 1) {
      setSlotted(null);
      setQty(0);
      return;
    }
    setQty(clampSellQty(remain, liveQty));
  };

  const buyLocked = mode === 'buy' && Boolean(slotted && isSkinId(slotted) && skinOwned);

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
              const id = row.item.id;
              const ownedSkin = isSkinId(id) && isSkinOwned(meta, id);
              return (
                <Pressable
                  key={id}
                  style={[styles.cell, slotted === id && styles.cellOn]}
                  onPress={() => slotGood(id)}
                  onLongPress={() => {
                    setSlotted(id);
                    setQty(1);
                    openPreview(id);
                  }}
                  delayLongPress={400}
                  accessibilityLabel={
                    count != null
                      ? `${row.item.name}, ${count} owned`
                      : ownedSkin
                        ? `${row.item.name}, owned`
                        : `${row.item.name}, ${row.gold} gold`
                  }
                >
                  {isSkinId(id) ? <SkinIcon id={id} size={36} /> : <ItemIcon id={id} size={36} />}
                  <Text style={styles.cellQty}>
                    {count != null ? `x${count}` : ownedSkin ? 'own' : row.gold}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Pressable
          style={[styles.slot, empty && styles.slotEmpty]}
          disabled={!slotted}
          onPress={() => {
            if (slotted) openPreview(slotted);
          }}
          accessibilityLabel={slotted ? `${captionName} preview` : undefined}
        >
          {slotted ? (
            isSkinId(slotted) ? (
              <SkinIcon id={slotted} size={64} />
            ) : (
              <ItemIcon id={slotted} size={64} />
            )
          ) : null}
        </Pressable>
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

        <StoneButton gold={!empty && !buyLocked} locked={empty || buyLocked} onPress={confirm} style={styles.sell}>
          {buyLocked ? (
            'Owned'
          ) : empty ? (
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
