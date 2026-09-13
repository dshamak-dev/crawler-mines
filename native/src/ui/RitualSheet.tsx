import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  RITUAL_COPY,
  emptyRitual,
  ritualCaption,
  ritualCombo,
  ritualPickerRows,
  type CollectionState,
  type ItemId,
  type RitualSlots,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { ItemIcon } from './icons';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export default function RitualSheet({
  meta,
  onUse,
  onClose,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onUse: (slots: RitualSlots) => boolean;
  onClose: () => void;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [slots, setSlots] = useState<RitualSlots>(emptyRitual);
  const [pickingSlot, setPickingSlot] = useState<0 | 1 | 2 | null>(null);
  const combo = ritualCombo(slots);

  const socket = (slot: 0 | 1 | 2, id: ItemId) => {
    onUi();
    const next: RitualSlots = [...slots];
    next[slot] = id;
    setSlots(next);
    setPickingSlot(null);
  };

  const clearSlot = (slot: 0 | 1 | 2) => {
    onUi();
    const next: RitualSlots = [...slots];
    next[slot] = null;
    setSlots(next);
  };

  const confirm = () => {
    if (!combo.ok) {
      onDeny();
      return;
    }
    onUi();
    if (!onUse(slots)) onDeny();
  };

  return (
    <>
      <Overlay
        onBackdrop={() => {
          if (pickingSlot != null) {
            setPickingSlot(null);
            return;
          }
          onClose();
        }}
      >
        <Tablet>
          <DisplayText style={styles.title}>Witchcraft bag</DisplayText>
          <MutedText style={styles.copy}>{RITUAL_COPY}</MutedText>
          <View style={styles.wells}>
            <RitualWell
              itemId={slots[0]}
              onOpen={() => {
                onUi();
                setPickingSlot(0);
              }}
              onClear={() => clearSlot(0)}
            />
            <RitualWell
              itemId={slots[1]}
              onOpen={() => {
                onUi();
                setPickingSlot(1);
              }}
              onClear={() => clearSlot(1)}
            />
            <RitualWell
              itemId={slots[2]}
              onOpen={() => {
                onUi();
                setPickingSlot(2);
              }}
              onClear={() => clearSlot(2)}
            />
          </View>
          <Text style={styles.status}>{ritualCaption(slots)}</Text>
          <View style={styles.col}>
            <StoneButton gold locked={!combo.ok} onPress={confirm} style={styles.centerBtn}>
              Use
            </StoneButton>
            <StoneButton
              onPress={() => {
                onUi();
                onClose();
              }}
              style={styles.centerBtn}
            >
              Close
            </StoneButton>
          </View>
        </Tablet>
      </Overlay>
      {pickingSlot != null ? (
        <RitualPicker
          meta={meta}
          slots={slots}
          fillingSlot={pickingSlot}
          onPick={(id) => socket(pickingSlot, id)}
          onCancel={() => {
            onUi();
            setPickingSlot(null);
          }}
          onDeny={onDeny}
        />
      ) : null}
    </>
  );
}

function RitualWell({
  itemId,
  onOpen,
  onClear,
}: {
  itemId: ItemId | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  const filled = itemId != null;
  return (
    <View style={styles.wellWrap}>
      <View style={styles.wellFrame}>
        {filled ? (
          <View style={[styles.well, styles.wellFilled]}>
            <ItemIcon id={itemId} size={44} />
          </View>
        ) : (
          <Pressable style={styles.well} onPress={onOpen} accessibilityLabel="Empty ritual slot" />
        )}
        {filled ? (
          <Pressable
            style={styles.clear}
            onPress={onClear}
            accessibilityLabel={`Remove ${ITEMS[itemId].name}`}
          >
            <Text style={styles.clearX}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.wellLabel}>{filled ? ITEMS[itemId].name : ' '}</Text>
    </View>
  );
}

function RitualPicker({
  meta,
  slots,
  fillingSlot,
  onPick,
  onCancel,
  onDeny,
}: {
  meta: CollectionState;
  slots: RitualSlots;
  fillingSlot: 0 | 1 | 2;
  onPick: (id: ItemId) => void;
  onCancel: () => void;
  onDeny: () => void;
}) {
  const rows = ritualPickerRows(meta, slots, fillingSlot);
  return (
    <Overlay onBackdrop={onCancel}>
      <Tablet>
        <DisplayText>Offerings</DisplayText>
        <View style={styles.ruleLine} />
        <MutedText>Pick one from your pack.</MutedText>
        {rows.length === 0 ? (
          <MutedText>Nothing to socket.</MutedText>
        ) : (
          <View style={styles.offerList}>
            {rows.map((row) => (
              <Pressable
                key={row.id}
                style={[styles.offerRow, row.disabled && styles.offerLocked]}
                onPress={() => {
                  if (row.disabled) {
                    onDeny();
                    return;
                  }
                  onPick(row.id);
                }}
              >
                <ItemIcon id={row.id} size={32} />
                <Text style={styles.offerName}>{row.name}</Text>
                <Text style={styles.offerCount}>×{row.count}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <StoneButton onPress={onCancel} style={styles.centerBtn}>
          Cancel
        </StoneButton>
      </Tablet>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, textTransform: 'uppercase' },
  copy: { fontSize: 13, marginVertical: 10 },
  wells: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  wellWrap: { alignItems: 'center', width: 88 },
  wellFrame: { width: 76, height: 76 },
  well: {
    width: 76,
    height: 76,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: 'rgba(8,6,5,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellFilled: {},
  clear: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#6b5340',
    backgroundColor: '#2a2320',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearX: { color: colors.muted, fontSize: 14, lineHeight: 16 },
  wellLabel: { color: colors.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  status: {
    fontFamily: fonts.display,
    color: colors.gold2,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginVertical: 8,
  },
  col: { gap: 8, marginTop: 8 },
  centerBtn: { justifyContent: 'center', marginTop: 8 },
  ruleLine: {
    height: 1,
    marginVertical: 10,
    backgroundColor: 'rgba(224, 180, 74, 0.45)',
  },
  offerList: { gap: 8, marginVertical: 8 },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.18)',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  offerLocked: { opacity: 0.45 },
  offerName: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 15 },
  offerCount: { fontFamily: fonts.display, color: colors.gold2, fontSize: 15 },
});
