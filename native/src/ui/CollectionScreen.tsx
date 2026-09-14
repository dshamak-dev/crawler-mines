import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  FLAG_SKIN_IDS,
  GRID_SKIN_IDS,
  SKINS,
  emptyInventory,
  inventoryTotal,
  isSkinOwned,
  isTicketKey,
  runKitEntries,
  sealedRowLabel,
  sealedRunRows,
  selectedFlagSkin,
  selectedGridSkin,
  stackedEntries,
  type CollectionState,
  type FlagSkinId,
  type Game,
  type GridSkinId,
  type Inventory,
  type RitualSlots,
  type SkinId,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { BagIcon, ChestIcon, GoldIcon, ItemIcon, SkinIcon } from './icons';
import ItemPreviewSheet, {
  previewForItem,
  previewForSkin,
  type ItemPreviewModel,
} from './ItemPreviewSheet';
import RitualSheet from './RitualSheet';
import { GhostButton, StoneButton } from './primitives';

const EMPTY_COPY = 'Chests stay sealed until you clear the floor. Bombs can still smash them.';

export default function CollectionScreen({
  meta,
  runLoot,
  kit,
  game,
  stashGold = 0,
  sealed = false,
  onBack,
  onStartRite,
  onSelectFlag,
  onSelectGrid,
  onUi,
  onDeny,
  onUseTorch,
}: {
  meta: CollectionState;
  runLoot: Inventory;
  /** Offered this-run kit. Never the leftover bank pack. */
  kit?: Inventory;
  game?: Game;
  stashGold?: number;
  sealed?: boolean;
  onBack: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
  onSelectFlag?: (skinId: FlagSkinId) => boolean;
  onSelectGrid?: (skinId: GridSkinId) => boolean;
  onUi?: () => void;
  onDeny?: () => void;
  onUseTorch?: () => boolean;
}) {
  if (sealed && game) {
    return (
      <SealedCollection
        game={game}
        runLoot={runLoot}
        stashGold={stashGold}
        kit={kit}
        onBack={onBack}
        onUi={onUi}
        onDeny={onDeny}
        onUseTorch={onUseTorch}
      />
    );
  }

  return (
    <TitleCollection
      meta={meta}
      onBack={onBack}
      onStartRite={onStartRite}
      onSelectFlag={onSelectFlag}
      onSelectGrid={onSelectGrid}
      onUi={onUi}
      onDeny={onDeny}
    />
  );
}

function TitleCollection({
  meta,
  onBack,
  onStartRite,
  onSelectFlag,
  onSelectGrid,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onBack: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
  onSelectFlag?: (skinId: FlagSkinId) => boolean;
  onSelectGrid?: (skinId: GridSkinId) => boolean;
  onUi?: () => void;
  onDeny?: () => void;
}) {
  const [tab, setTab] = useState<'items' | 'skins'>('items');
  const [preview, setPreview] = useState<ItemPreviewModel | null>(null);
  const [previewSkin, setPreviewSkin] = useState<SkinId | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const rows = stackedEntries(meta.items);
  const total = inventoryTotal(meta.items);
  const ownedSkinCount = [...FLAG_SKIN_IDS, ...GRID_SKIN_IDS].filter((id) =>
    isSkinOwned(meta, id),
  ).length;
  const cue = onUi ?? (() => {});
  const deny = onDeny ?? (() => {});
  const allowUse = tab === 'items' && Boolean(onStartRite);
  const flagId = selectedFlagSkin(meta);
  const gridId = selectedGridSkin(meta);
  const pill = tab === 'items' ? `${total} held` : `${ownedSkinCount} owned`;

  const openSkin = (id: SkinId) => {
    cue();
    const owned = isSkinOwned(meta, id);
    const selected = SKINS[id].slot === 'flag' ? flagId === id : gridId === id;
    setPreviewSkin(id);
    setPreview(previewForSkin(id, owned, selected, owned));
  };

  return (
    <View style={styles.shell}>
      <Header title="Collection" pill={pill} onBack={onBack} />
      <View style={styles.wallet} accessibilityLabel={`${meta.gold} coins in wallet`}>
        <GoldIcon size={28} />
        <View style={styles.walletCopy}>
          <Text style={styles.walletN}>{meta.gold}</Text>
          <Text style={styles.walletEm}>wallet</Text>
        </View>
      </View>
      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, tab === 'items' && styles.chipOn]}
          onPress={() => setTab('items')}
          accessibilityLabel="Items"
        >
          <Text style={[styles.chipText, tab === 'items' && styles.chipTextOn]}>Items</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === 'skins' && styles.chipOn]}
          onPress={() => setTab('skins')}
          accessibilityLabel="Skins"
        >
          <Text style={[styles.chipText, tab === 'skins' && styles.chipTextOn]}>Skins</Text>
        </Pressable>
      </View>
      {tab === 'items' ? (
        rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyCopy}>{EMPTY_COPY}</Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
            {rows.map(({ item, count }) => (
              <Pressable
                key={item.id}
                style={[styles.card, isTicketKey(item.id) && styles.ticket]}
                onPress={() => {
                  cue();
                  setPreviewSkin(null);
                  setPreview(previewForItem(item.id, count, allowUse));
                }}
                accessibilityLabel={`${item.name}, ${count} owned`}
              >
                <View style={styles.ico}>
                  <ItemIcon id={item.id} size={34} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.flavor}>{item.flavor}</Text>
                </View>
                <Text style={styles.count}>×{count}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
          <Text style={styles.section}>Flag</Text>
          {FLAG_SKIN_IDS.map((id) => (
            <SkinRow
              key={id}
              id={id}
              owned={isSkinOwned(meta, id)}
              selected={flagId === id}
              onPress={() => openSkin(id)}
            />
          ))}
          <Text style={[styles.section, styles.sectionGap]}>Grid</Text>
          {GRID_SKIN_IDS.map((id) => (
            <SkinRow
              key={id}
              id={id}
              owned={isSkinOwned(meta, id)}
              selected={gridId === id}
              onPress={() => openSkin(id)}
            />
          ))}
        </ScrollView>
      )}
      <StoneButton onPress={onBack} style={styles.back}>
        Back
      </StoneButton>
      {preview ? (
        <ItemPreviewSheet
          preview={preview}
          onUse={() => {
            setPreview(null);
            setPreviewSkin(null);
            setRitualOpen(true);
          }}
          onSelect={() => {
            if (!previewSkin) return;
            const skin = SKINS[previewSkin];
            const ok =
              skin.slot === 'flag'
                ? onSelectFlag?.(previewSkin as FlagSkinId)
                : onSelectGrid?.(previewSkin as GridSkinId);
            if (!ok) {
              deny();
              return;
            }
            setPreview(null);
            setPreviewSkin(null);
          }}
          onClose={() => {
            setPreview(null);
            setPreviewSkin(null);
          }}
          onUi={cue}
        />
      ) : null}
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

function SkinRow({
  id,
  owned,
  selected,
  onPress,
}: {
  id: SkinId;
  owned: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const skin = SKINS[id];
  return (
    <Pressable
      style={[styles.card, !owned && styles.locked]}
      onPress={onPress}
      accessibilityLabel={
        selected
          ? `${skin.name}, selected`
          : owned
            ? `${skin.name}, owned`
            : `${skin.name}, locked`
      }
    >
      <View style={styles.ico}>
        <SkinIcon id={id} size={34} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{skin.name}</Text>
        <Text style={styles.flavor}>{skin.flavor}</Text>
      </View>
      <Text style={selected ? styles.active : styles.owned}>
        {selected ? 'Active' : owned ? 'Owned' : 'Locked'}
      </Text>
    </Pressable>
  );
}

function SealedCollection({
  game,
  runLoot,
  stashGold,
  kit = emptyInventory(),
  onBack,
  onUi,
  onDeny,
  onUseTorch,
}: {
  game: Game;
  runLoot: Inventory;
  stashGold: number;
  kit?: Inventory;
  onBack: () => void;
  onUi?: () => void;
  onDeny?: () => void;
  onUseTorch?: () => boolean;
}) {
  const [preview, setPreview] = useState<ItemPreviewModel | null>(null);
  const kitRows = runKitEntries(kit);
  const sealedRows = sealedRunRows(game, runLoot, stashGold);
  const kitTotal = kitRows.reduce((sum, row) => sum + row.count, 0);
  const sealedTotal = sealedRows.reduce((sum, row) => sum + row.count, 0);
  const total = kitTotal + sealedTotal;
  const cue = onUi ?? (() => {});
  const deny = onDeny ?? (() => {});
  const empty = kitRows.length === 0 && sealedRows.length === 0;
  const pill = kitTotal > 0 ? `${total} held` : `${sealedTotal} sealed`;
  const allowUse = Boolean(onUseTorch);

  return (
    <View style={styles.shell}>
      <Header title="Collection" pill={pill} onBack={onBack} />
      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyCopy}>{EMPTY_COPY}</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
          {kitRows.map(({ item, count }) => (
            <Pressable
              key={item.id}
              style={[styles.card, isTicketKey(item.id) && styles.ticket]}
              onPress={() => {
                cue();
                setPreview(previewForItem(item.id, count, allowUse, true));
              }}
              accessibilityLabel={`${item.name}, ${count} in kit`}
            >
              <View style={styles.ico}>
                <ItemIcon id={item.id} size={34} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.flavor}>{item.flavor}</Text>
              </View>
              <Text style={styles.count}>×{count}</Text>
            </Pressable>
          ))}
          {sealedRows.map((row) => {
            const { title, subtitle } = sealedRowLabel(row);
            const key = `${row.kind}:${row.tier ?? 'gold'}:${row.wrecked ? 'wreck' : 'ok'}`;
            return (
              <Pressable
                key={key}
                style={styles.card}
                onPress={() => {
                  cue();
                  setPreview({
                    title,
                    flavor: subtitle,
                    icon:
                      row.kind === 'gold-bag'
                        ? { kind: 'gold-bag' }
                        : { kind: 'chest', tier: row.tier ?? 'wooden', wrecked: row.wrecked },
                    qty: row.count,
                    canUse: false,
                  });
                }}
                accessibilityLabel={`${title}, ${row.count} sealed`}
              >
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
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <StoneButton onPress={onBack} style={styles.back}>
        Back
      </StoneButton>
      {preview ? (
        <ItemPreviewSheet
          preview={preview}
          onUse={() => {
            const ok = onUseTorch?.() ?? false;
            if (!ok) {
              deny();
              return;
            }
            setPreview(null);
            onBack();
          }}
          onClose={() => setPreview(null)}
          onUi={cue}
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
  section: {
    fontFamily: fonts.display,
    color: colors.gold2,
    letterSpacing: 0.8,
    fontSize: 14,
    marginTop: 4,
  },
  sectionGap: { marginTop: 12 },
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
  locked: { opacity: 0.62 },
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
  count: { fontFamily: fonts.display, color: colors.gold, fontSize: 17 },
  active: { fontFamily: fonts.display, color: colors.gold2, fontSize: 13, letterSpacing: 0.6 },
  owned: { fontFamily: fonts.display, color: colors.muted, fontSize: 12, letterSpacing: 0.4 },
  back: { justifyContent: 'center' },
});
