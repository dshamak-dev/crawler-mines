import { StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  SECRET_CHEST,
  SKINS,
  canUseFromPreview,
  type ChestTier,
  type ItemId,
  type SkinId,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { ChestIcon, ItemIcon, SkinIcon } from './icons';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export type ItemPreviewIcon =
  | { kind: 'item'; itemId: ItemId }
  | { kind: 'skin'; skinId: SkinId }
  | { kind: 'chest'; tier: ChestTier; wrecked?: boolean }
  | { kind: 'gold-bag' };

export interface ItemPreviewModel {
  title: string;
  flavor: string;
  icon: ItemPreviewIcon;
  qty?: number;
  canUse: boolean;
  canSelect?: boolean;
  selected?: boolean;
}

export function previewForItem(
  itemId: ItemId,
  owned: number,
  allowUse: boolean,
  inRun = false,
): ItemPreviewModel {
  const item = ITEMS[itemId];
  const have = Math.max(0, Math.floor(owned));
  return {
    title: item.name,
    flavor: item.flavor,
    icon: { kind: 'item', itemId },
    qty: have > 0 ? have : undefined,
    canUse: allowUse && canUseFromPreview(itemId, have, inRun),
  };
}

export function previewForSecretChest(): ItemPreviewModel {
  return {
    title: SECRET_CHEST.name,
    flavor: SECRET_CHEST.flavor,
    icon: { kind: 'chest', tier: 'secret' },
    canUse: false,
  };
}

export function previewForSkin(
  skinId: SkinId,
  owned: boolean,
  selected: boolean,
  allowSelect: boolean,
): ItemPreviewModel {
  const skin = SKINS[skinId];
  return {
    title: skin.name,
    flavor: skin.flavor,
    icon: { kind: 'skin', skinId },
    canUse: false,
    canSelect: allowSelect && owned && !selected,
    selected: allowSelect && owned && selected,
  };
}

export default function ItemPreviewSheet({
  preview,
  onUse,
  onSelect,
  onClose,
  onUi,
}: {
  preview: ItemPreviewModel;
  onUse?: () => void;
  onSelect?: () => void;
  onClose: () => void;
  onUi?: () => void;
}) {
  const cue = onUi ?? (() => {});

  return (
    <Overlay
      onBackdrop={() => {
        cue();
        onClose();
      }}
    >
      <Tablet>
        <View style={styles.ico} accessibilityLabel={`${preview.title} icon`}>
          <PreviewGlyph icon={preview.icon} />
        </View>
        <DisplayText style={styles.title}>{preview.title}</DisplayText>
        <MutedText style={styles.flavor}>{preview.flavor}</MutedText>
        {preview.qty != null ? <Text style={styles.qty}>×{preview.qty}</Text> : null}
        <View style={styles.col}>
          {preview.canUse ? (
            <StoneButton
              gold
              onPress={() => {
                cue();
                onUse?.();
              }}
              style={styles.centerBtn}
              accessibilityLabel={`Use ${preview.title}`}
            >
              Use
            </StoneButton>
          ) : null}
          {preview.canSelect ? (
            <StoneButton
              gold
              onPress={() => {
                cue();
                onSelect?.();
              }}
              style={styles.centerBtn}
              accessibilityLabel={`Select ${preview.title}`}
            >
              Select
            </StoneButton>
          ) : null}
          {preview.selected ? (
            <StoneButton
              locked
              disabled
              style={styles.centerBtn}
              accessibilityLabel={`${preview.title} selected`}
            >
              Selected
            </StoneButton>
          ) : null}
          <StoneButton
            onPress={() => {
              cue();
              onClose();
            }}
            style={styles.centerBtn}
            accessibilityLabel="Close"
          >
            Close
          </StoneButton>
        </View>
      </Tablet>
    </Overlay>
  );
}

function PreviewGlyph({ icon }: { icon: ItemPreviewIcon }) {
  if (icon.kind === 'item') return <ItemIcon id={icon.itemId} size={72} />;
  if (icon.kind === 'skin') return <SkinIcon id={icon.skinId} size={72} />;
  if (icon.kind === 'gold-bag') return <ItemIcon id="gold-pouch" size={72} />;
  return <ChestIcon wrecked={icon.wrecked} tier={icon.tier} size={72} />;
}

const styles = StyleSheet.create({
  ico: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.35)',
    backgroundColor: '#1a1512',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { color: colors.ink, letterSpacing: 0.6 },
  flavor: { fontSize: 14, marginTop: 10, marginBottom: 6 },
  qty: {
    fontFamily: fonts.uiBold,
    color: colors.gold2,
    fontSize: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  col: { gap: 8, marginTop: 14 },
  centerBtn: { justifyContent: 'center' },
});
