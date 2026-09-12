import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TIER_COPY, type ChestTier } from '../../../src/engine';
import { colors, fonts } from '../theme';
import { ChestIcon } from './icons';

export interface LootToastItem {
  id: number;
  kind: 'found' | 'broken';
  tier: ChestTier;
}

export default function LootQueue({
  queue,
  onDismiss,
  reduceMotion,
}: {
  queue: LootToastItem[];
  onDismiss: (id: number) => void;
  reduceMotion: boolean;
}) {
  const current = queue[0];
  const last = queue.length === 1;

  useEffect(() => {
    if (!current) return;
    const ms = reduceMotion ? 900 : last ? 2400 : 1400;
    const t = setTimeout(() => onDismiss(current.id), ms);
    return () => clearTimeout(t);
  }, [current, last, onDismiss, reduceMotion]);

  if (!current) return null;
  const copy = TIER_COPY[current.tier];
  const smashed = current.kind === 'broken';

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Pressable
        style={[styles.toast, smashed && styles.broken]}
        onPress={() => onDismiss(current.id)}
        accessibilityLabel={`${copy.name}. ${smashed ? copy.broken : copy.found}`}
      >
        <View style={styles.ico}>
          <ChestIcon tier={current.tier} wrecked={smashed} size={32} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.name, smashed && styles.brokenName]}>{copy.name}</Text>
          <Text style={styles.sub}>{smashed ? copy.broken : copy.found}</Text>
        </View>
        {queue.length > 1 ? <Text style={styles.more}>+{queue.length - 1}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 86,
    zIndex: 6,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#6b5340',
    backgroundColor: '#241e1a',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  broken: { borderColor: '#6a5348' },
  ico: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, color: colors.gold2, fontSize: 16 },
  brokenName: { color: '#e07a6a' },
  sub: { fontFamily: fonts.ui, color: colors.muted, fontSize: 13, marginTop: 2 },
  more: { fontFamily: fonts.uiBold, color: colors.gold, fontSize: 14 },
});
