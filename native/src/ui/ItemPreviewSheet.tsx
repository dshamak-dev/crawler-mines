import { StyleSheet, Text, View } from 'react-native';
import {
  ITEMS,
  THEMES,
  canUseFromPreview,
  type ChestTier,
  type ItemId,
  type ThemeId,
} from '../../../src/engine';
import { fonts, useTheme } from '../theme';
import { ChestIcon, ItemIcon, ThemeIcon } from './icons';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export type ItemPreviewIcon =
  | { kind: 'item'; itemId: ItemId }
  | { kind: 'theme'; themeId: ThemeId }
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
    icon: itemId === 'secret-chest' ? { kind: 'chest', tier: 'secret' } : { kind: 'item', itemId },
    qty: have > 0 ? have : undefined,
    canUse: allowUse && canUseFromPreview(itemId, have, inRun),
  };
}

export function previewForTheme(
  themeId: ThemeId,
  owned: boolean,
  selected: boolean,
  allowSelect: boolean,
): ItemPreviewModel {
  const theme = THEMES[themeId];
  return {
    title: theme.name,
    flavor: theme.flavor,
    icon: { kind: 'theme', themeId },
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
  const t = useTheme();

  return (
    <Overlay
      onBackdrop={() => {
        cue();
        onClose();
      }}
    >
      <Tablet>
        <View
          style={[styles.ico, { borderColor: t.accentBorder, backgroundColor: t.stoneLo }]}
          accessibilityLabel={`${preview.title} icon`}
        >
          <PreviewGlyph icon={preview.icon} />
        </View>
        <DisplayText style={[styles.title, { color: t.ink }]}>{preview.title}</DisplayText>
        <MutedText style={styles.flavor}>{preview.flavor}</MutedText>
        {preview.qty != null ? <Text style={[styles.qty, { color: t.gold2 }]}>×{preview.qty}</Text> : null}
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
  if (icon.kind === 'theme') return <ThemeIcon id={icon.themeId} size={72} />;
  if (icon.kind === 'gold-bag') return <ItemIcon id="gold-pouch" size={72} />;
  return <ChestIcon wrecked={icon.wrecked} tier={icon.tier} size={72} />;
}

const styles = StyleSheet.create({
  ico: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { letterSpacing: 0.6 },
  flavor: { fontSize: 14, marginTop: 10, marginBottom: 6 },
  qty: {
    fontFamily: fonts.uiBold,
    fontSize: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  col: { gap: 8, marginTop: 14 },
  centerBtn: { justifyContent: 'center' },
});
