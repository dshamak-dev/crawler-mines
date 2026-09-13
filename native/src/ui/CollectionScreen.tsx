import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  inventoryTotal,
  isTicketKey,
  isUsable,
  sealedRowLabel,
  sealedRunRows,
  stackedEntries,
  type CollectionState,
  type Game,
  type Inventory,
  type RitualSlots,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { BagIcon, ChestIcon, GoldIcon, ItemIcon } from './icons';
import RitualSheet from './RitualSheet';
import { GhostButton, StoneButton } from './primitives';

const EMPTY_COPY = 'Chests stay sealed until you clear the floor. Bombs can still smash them.';

export default function CollectionScreen({
  meta,
  runLoot,
  game,
  stashGold = 0,
  sealed = false,
  onBack,
  onStartRite,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  runLoot: Inventory;
  game?: Game;
  stashGold?: number;
  sealed?: boolean;
  onBack: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
  onUi?: () => void;
  onDeny?: () => void;
}) {
  if (sealed && game) {
    const rows = sealedRunRows(game, runLoot, stashGold);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return (
      <View style={styles.shell}>
        <Header title="Collection" pill={`${total} sealed`} onBack={onBack} />
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyCopy}>{EMPTY_COPY}</Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
            {rows.map((row) => {
              const { title, subtitle } = sealedRowLabel(row);
              const key = `${row.kind}:${row.tier ?? 'gold'}:${row.wrecked ? 'wreck' : 'ok'}`;
              return (
                <View key={key} style={styles.card}>
                  <View style={styles.ico}>
                    {row.kind === 'gold-bag' ? (
                      <ItemIcon id="gold-pouch" size={34} />
                    ) : row.wrecked ? (
                      <ChestIcon wrecked tier={row.tier ?? 'wooden'} size={34} />
                    ) : (
                      <ChestIcon tier={row.tier ?? 'wooden'} size={34} />
                    )}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{title}</Text>
                    <Text style={styles.flavor}>{subtitle}</Text>
                  </View>
                  <Text style={styles.count}>×{row.count}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        <StoneButton onPress={onBack} style={styles.back}>
          Back
        </StoneButton>
      </View>
    );
  }

  return (
    <TitleCollection
      meta={meta}
      runLoot={runLoot}
      onBack={onBack}
      onStartRite={onStartRite}
      onUi={onUi}
      onDeny={onDeny}
    />
  );
}

function TitleCollection({
  meta,
  runLoot,
  onBack,
  onStartRite,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  runLoot: Inventory;
  onBack: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
  onUi?: () => void;
  onDeny?: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'run'>('all');
  const [ritualOpen, setRitualOpen] = useState(false);
  const inv = tab === 'all' ? meta.items : runLoot;
  const rows = stackedEntries(inv);
  const total = inventoryTotal(inv);
  const runCount = inventoryTotal(runLoot);
  const cue = onUi ?? (() => {});
  const deny = onDeny ?? (() => {});

  return (
    <View style={styles.shell}>
      <Header title="Collection" pill={`${total} held`} onBack={onBack} />
      <View style={styles.wallet} accessibilityLabel={`${meta.gold} coins in wallet`}>
        <GoldIcon size={28} />
        <View style={styles.walletCopy}>
          <Text style={styles.walletN}>{meta.gold}</Text>
          <Text style={styles.walletEm}>wallet</Text>
        </View>
      </View>
      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, tab === 'all' && styles.chipOn]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.chipText, tab === 'all' && styles.chipTextOn]}>All salvage</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === 'run' && styles.chipOn]}
          onPress={() => setTab('run')}
        >
          <Text style={[styles.chipText, tab === 'run' && styles.chipTextOn]}>
            This run{runCount > 0 ? ` · ${runCount}` : ''}
          </Text>
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyCopy}>{EMPTY_COPY}</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
          {rows.map(({ item, count }) => {
            const usable = tab === 'all' && isUsable(item.id) && Boolean(onStartRite);
            return (
              <Pressable
                key={item.id}
                style={[styles.card, isTicketKey(item.id) && styles.ticket]}
                onPress={() => {
                  if (!usable) return;
                  cue();
                  setRitualOpen(true);
                }}
                accessibilityLabel={usable ? `Use ${item.name}` : undefined}
              >
                <View style={styles.ico}>
                  <ItemIcon id={item.id} size={34} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.flavor}>{item.flavor}</Text>
                </View>
                {usable ? <Text style={styles.use}>Use</Text> : null}
                <Text style={styles.count}>×{count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <StoneButton onPress={onBack} style={styles.back}>
        Back
      </StoneButton>
      {ritualOpen && onStartRite ? (
        <RitualSheet
          meta={meta}
          onUse={(slots) => onStartRite(slots)}
          onClose={() => {
            cue();
            setRitualOpen(false);
          }}
          onUi={cue}
          onDeny={deny}
        />
      ) : null}
    </View>
  );
}

function Header({ title, pill, onBack }: { title: string; pill: string; onBack: () => void }) {
  return (
    <View style={styles.head}>
      <GhostButton onPress={onBack} accessibilityLabel="Back" style={styles.backThumb}>
        <Text style={styles.chev}>‹</Text>
      </GhostButton>
      <View style={styles.titleRow}>
        <BagIcon size={28} />
        <Text style={styles.h1}>{title}</Text>
      </View>
      <Text style={styles.pill}>{pill}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backThumb: { width: 48, height: 48 },
  chev: { color: colors.ink, fontSize: 28, lineHeight: 32 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontFamily: fonts.display, color: colors.gold2, fontSize: 18, letterSpacing: 0.8 },
  pill: {
    fontFamily: fonts.display,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 999,
  },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.35)',
    backgroundColor: '#231c16',
  },
  walletCopy: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  walletN: { fontFamily: fonts.display, color: colors.gold2, fontSize: 20 },
  walletEm: { fontFamily: fonts.ui, color: colors.muted, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipOn: { borderColor: colors.goldBorder, backgroundColor: '#6b4e1e' },
  chipText: { fontFamily: fonts.display, color: colors.muted, fontSize: 14 },
  chipTextOn: { color: colors.gold2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  emptyCopy: { fontFamily: fonts.ui, color: colors.muted, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  list: { flex: 1 },
  listInner: { gap: 8, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ticket: { borderColor: 'rgba(201, 180, 255, 0.35)' },
  ico: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1a1512',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, color: colors.ink, fontSize: 16 },
  flavor: { fontFamily: fonts.ui, color: colors.muted, fontSize: 13, marginTop: 2 },
  use: { fontFamily: fonts.display, color: colors.gold2, fontSize: 13, letterSpacing: 0.6 },
  count: { fontFamily: fonts.display, color: colors.gold, fontSize: 17 },
  back: { justifyContent: 'center' },
});
