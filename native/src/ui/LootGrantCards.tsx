import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { isTicketKey, type ItemDef } from '../../../src/engine';
import { colors, fonts } from '../theme';
import { GoldIcon, ItemIcon } from './icons';

export interface LootGrantRow {
  item: ItemDef;
  count: number;
  bonus?: boolean;
}

export default function LootGrantCards({
  gold,
  goldCopy,
  rows,
}: {
  gold: number;
  goldCopy: string;
  rows: LootGrantRow[];
}) {
  return (
    <ScrollView style={styles.lootScroll}>
      {gold > 0 ? (
        <View style={styles.lootCard}>
          <View style={styles.lootIco}>
            <GoldIcon size={28} />
          </View>
          <View style={styles.lootCopy}>
            <Text style={styles.lootName}>Coins</Text>
            <Text style={styles.lootEm}>{goldCopy}</Text>
          </View>
          <Text style={styles.lootN}>+{gold}</Text>
        </View>
      ) : null}
      {rows.map(({ item, count, bonus }) => (
        <View
          key={item.id}
          style={[styles.lootCard, isTicketKey(item.id) && styles.ticket, bonus && styles.bonusCard]}
        >
          <View style={styles.lootIco}>
            <ItemIcon id={item.id} size={28} />
          </View>
          <View style={styles.lootCopy}>
            <Text style={styles.lootName}>{item.name}</Text>
            <Text style={styles.lootEm}>{item.flavor}</Text>
          </View>
          <Text style={styles.lootN}>×{count}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lootScroll: { maxHeight: 168, marginBottom: 12 },
  lootCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.18)',
    borderRadius: 12,
  },
  ticket: { borderColor: 'rgba(201, 180, 255, 0.35)' },
  bonusCard: { borderColor: 'rgba(224, 180, 74, 0.55)' },
  lootIco: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1a1512',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootCopy: { flex: 1 },
  lootName: { fontFamily: fonts.display, color: colors.ink, fontSize: 15 },
  lootEm: { fontFamily: fonts.ui, color: colors.muted, fontSize: 12 },
  lootN: { fontFamily: fonts.display, color: colors.gold, fontSize: 16 },
});
