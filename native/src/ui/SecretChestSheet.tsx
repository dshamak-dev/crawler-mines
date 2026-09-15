import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  SECRET_CHEST,
  SECRET_CHEST_COPY,
  addItem,
  canOpenSecretChest,
  emptyInventory,
  secretChestCaption,
  secretKeyPickerRows,
  stackedEntries,
  type CollectionState,
  type ItemId,
  type LootGrant,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { ItemIcon } from './icons';
import LootGrantCards from './LootGrantCards';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export default function SecretChestSheet({
  meta,
  onOpen,
  onClose,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onOpen: (socketed: ItemId | null) => LootGrant[] | null;
  onClose: () => void;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [socketed, setSocketed] = useState<ItemId | null>(null);
  const [picking, setPicking] = useState(false);
  const [rewards, setRewards] = useState<LootGrant[] | null>(null);
  const ready = canOpenSecretChest(meta, socketed);

  const confirm = () => {
    if (!ready) {
      onDeny();
      return;
    }
    onUi();
    const granted = onOpen(socketed);
    if (!granted) {
      onDeny();
      return;
    }
    setRewards(granted);
  };

  if (rewards) {
    const gold = rewards.reduce((sum, r) => sum + (r.itemId === 'gold-pouch' ? r.gold : 0), 0);
    let items = emptyInventory();
    for (const r of rewards) {
      if (r.itemId !== 'gold-pouch') items = addItem(items, r.itemId);
    }
    const rows = stackedEntries(items);
    return (
      <Overlay
        onBackdrop={() => {
          onUi();
          onClose();
        }}
      >
        <Tablet>
          <DisplayText style={styles.title}>Secret chest</DisplayText>
          {gold > 0 || rows.length > 0 ? (
            <LootGrantCards
              gold={gold}
              goldCopy="Pouched gold, now in your wallet."
              rows={rows}
            />
          ) : (
            <MutedText style={styles.copy}>Nothing came out.</MutedText>
          )}
          <StoneButton
            gold
            onPress={() => {
              onUi();
              onClose();
            }}
            style={styles.centerBtn}
          >
            Close
          </StoneButton>
        </Tablet>
      </Overlay>
    );
  }

  return (
    <>
      <Overlay
        onBackdrop={() => {
          if (picking) {
            setPicking(false);
            return;
          }
          onClose();
        }}
      >
        <Tablet>
          <DisplayText style={styles.title}>{SECRET_CHEST.name}</DisplayText>
          <MutedText style={styles.copy}>{SECRET_CHEST_COPY}</MutedText>
          <View style={styles.wells}>
            <KeyWell
              itemId={socketed}
              onOpen={() => {
                onUi();
                setPicking(true);
              }}
              onClear={() => {
                onUi();
                setSocketed(null);
              }}
            />
          </View>
          <Text style={styles.status}>{secretChestCaption(socketed)}</Text>
          <View style={styles.col}>
            <StoneButton gold locked={!ready} onPress={confirm} style={styles.centerBtn}>
              Open
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
      {picking ? (
        <KeyPicker
          meta={meta}
          onPick={(id) => {
            onUi();
            setSocketed(id);
            setPicking(false);
          }}
          onCancel={() => {
            onUi();
            setPicking(false);
          }}
          onDeny={onDeny}
        />
      ) : null}
    </>
  );
}

function KeyWell({
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

function KeyPicker({
  meta,
  onPick,
  onCancel,
  onDeny,
}: {
  meta: CollectionState;
  onPick: (id: ItemId) => void;
  onCancel: () => void;
  onDeny: () => void;
}) {
  const rows = secretKeyPickerRows(meta);
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
