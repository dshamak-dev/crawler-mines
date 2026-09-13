import { StyleSheet, Text, View } from 'react-native';
import { ITEMS, canUseFromPreview, type ChestTier, type ItemId } from '../../../src/engine';
import { colors, fonts } from '../theme';
import { ChestIcon, ItemIcon } from './icons';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export type ItemPreviewIcon =
  | { kind: 'item'; itemId: ItemId }
  | { kind: 'chest'; tier: ChestTier; wrecked?: boolean }
  | { kind: 'gold-bag' };

export interface ItemPreviewModel {
  title: string;
  flavor: string;
  icon: ItemPreviewIcon;
  qty?: number;
  canUse: boolean;
}

export function previewForItem(
  itemId: ItemId,
  owned: number,
  allowUse: boolean,
): ItemPreviewModel {
  const item = ITEMS[itemId];
  const have = Math.max(0, Math.floor(owned));
  return {
    title: item.name,
    flavor: item.flavor,
    icon: { kind: 'item', itemId },
    qty: have > 0 ? have : undefined,
    canUse: allowUse && canUseFromPreview(itemId, have),
  };
}

export default function ItemPreviewSheet({
  preview,
  onUse,
  onClose,
  onUi,
}: {
  preview: ItemPreviewModel;
  onUse?: () => void;
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
  title: { color: colors.ink, textTransform: 'uppercase' },
  flavor: { fontSize: 14, marginTop: 10, marginBottom: 6 },
  qty: {
    fontFamily: fonts.display,
    color: colors.gold2,
    fontSize: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  col: { gap: 8, marginTop: 14 },
  centerBtn: { justifyContent: 'center' },
});
