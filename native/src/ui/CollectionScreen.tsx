import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  THEME_IDS,
  THEMES,
  emptyInventory,
  inventoryTotal,
  isThemeOwned,
  isTicketKey,
  runKitEntries,
  sealedRowLabel,
  sealedRunRows,
  selectedTheme,
  stackedEntries,
  type CollectionState,
  type Game,
  type Inventory,
  type ItemId,
  type LootGrant,
  type RitualSlots,
  type ThemeId,
} from '../../../src/engine';
import { colors, fonts, useTheme } from '../theme';
import { BagIcon, ChestIcon, GoldIcon, ItemIcon, ThemeIcon } from './icons';
import ItemPreviewSheet, {
  previewForItem,
  previewForTheme,
  type ItemPreviewModel,
} from './ItemPreviewSheet';
import RitualSheet from './RitualSheet';
import SecretChestSheet from './SecretChestSheet';
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
  onOpenSecret,
  onSelectTheme,
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
  onOpenSecret?: (socketed: ItemId | null) => LootGrant[] | null;
  onSelectTheme?: (themeId: ThemeId) => boolean;
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
      onOpenSecret={onOpenSecret}
      onSelectTheme={onSelectTheme}
      onUi={onUi}
      onDeny={onDeny}
    />
  );
}

function TitleCollection({
  meta,
  onBack,
  onStartRite,
  onOpenSecret,
  onSelectTheme,
  onUi,
  onDeny,
}: {
  meta: CollectionState;
  onBack: () => void;
  onStartRite?: (slots: RitualSlots) => boolean;
  onOpenSecret?: (socketed: ItemId | null) => LootGrant[] | null;
  onSelectTheme?: (themeId: ThemeId) => boolean;
  onUi?: () => void;
  onDeny?: () => void;
}) {
  const [tab, setTab] = useState<'items' | 'themes'>('items');
  const [preview, setPreview] = useState<ItemPreviewModel | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const [previewItem, setPreviewItem] = useState<ItemId | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const t = useTheme();
  const rows = stackedEntries(meta.items);
  const total = inventoryTotal(meta.items);
  const ownedThemeCount = THEME_IDS.filter((id) => isThemeOwned(meta, id)).length;
  const cue = onUi ?? (() => {});
  const deny = onDeny ?? (() => {});
  const allowUse = tab === 'items' && (Boolean(onStartRite) || Boolean(onOpenSecret));
  const activeTheme = selectedTheme(meta);
  const pill = tab === 'items' ? `${total} held` : `${ownedThemeCount} owned`;

  const openTheme = (id: ThemeId) => {
    cue();
    const owned = isThemeOwned(meta, id);
    const selected = activeTheme === id;
    setPreviewTheme(id);
    setPreview(previewForTheme(id, owned, selected, owned));
  };

  return (
    <View style={styles.shell}>
      <Header title="Collection" pill={pill} onBack={onBack} />
      <View style={[styles.wallet, { borderColor: t.accentBorder, backgroundColor: t.bg2 }]} accessibilityLabel={`${meta.gold} coins in wallet`}>
        <GoldIcon size={28} />
        <View style={styles.walletCopy}>
          <Text style={[styles.walletN, { color: t.gold2 }]}>{meta.gold}</Text>
          <Text style={[styles.walletEm, { color: t.muted }]}>wallet</Text>
        </View>
      </View>
      <View style={styles.filters}>
        <Pressable
          style={[styles.chip, tab === 'items' && styles.chipOn, tab === 'items' && { borderColor: t.goldBorder, backgroundColor: t.goldBtn }]}
          onPress={() => setTab('items')}
          accessibilityLabel="Items"
        >
          <Text style={[styles.chipText, { color: t.muted }, tab === 'items' && { color: t.gold2 }]}>Items</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === 'themes' && styles.chipOn, tab === 'themes' && { borderColor: t.goldBorder, backgroundColor: t.goldBtn }]}
          onPress={() => setTab('themes')}
          accessibilityLabel="Themes"
        >
          <Text style={[styles.chipText, { color: t.muted }, tab === 'themes' && { color: t.gold2 }]}>Themes</Text>
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
                  setPreviewTheme(null);
                  setPreviewItem(item.id);
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
          {THEME_IDS.map((id) => (
            <ThemeRow
              key={id}
              id={id}
              owned={isThemeOwned(meta, id)}
              selected={activeTheme === id}
              onPress={() => openTheme(id)}
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
            const id = previewItem;
            setPreview(null);
            setPreviewTheme(null);
            setPreviewItem(null);
            if (id === 'secret-chest') setSecretOpen(true);
            else setRitualOpen(true);
          }}
          onSelect={() => {
            if (!previewTheme) return;
            const ok = onSelectTheme?.(previewTheme);
            if (!ok) {
              deny();
              return;
            }
            setPreview(null);
            setPreviewTheme(null);
            setPreviewItem(null);
          }}
          onClose={() => {
            setPreview(null);
            setPreviewTheme(null);
            setPreviewItem(null);
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
      {secretOpen && onOpenSecret ? (
        <SecretChestSheet
          meta={meta}
          onOpen={(socketed) => onOpenSecret(socketed)}
          onClose={() => {
            cue();
            setSecretOpen(false);
          }}
          onUi={cue}
          onDeny={deny}
        />
      ) : null}
    </View>
  );
}

function ThemeRow({
  id,
  owned,
  selected,
  onPress,
}: {
  id: ThemeId;
  owned: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = THEMES[id];
  const t = useTheme();
  return (
    <Pressable
      style={[styles.card, { borderColor: t.accentSoft, backgroundColor: t.cardBg }, !owned && styles.locked]}
      onPress={onPress}
      accessibilityLabel={
        selected
          ? `${theme.name}, selected`
          : owned
            ? `${theme.name}, owned`
            : `${theme.name}, locked`
      }
    >
      <View style={styles.ico}>
        <ThemeIcon id={id} size={34} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: t.ink }]}>{theme.name}</Text>
        <Text style={[styles.flavor, { color: t.muted }]}>{theme.flavor}</Text>
      </View>
      <Text style={selected ? [styles.active, { color: t.gold2 }] : [styles.owned, { color: t.muted }]}>
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
  const t = useTheme();
  return (
    <View style={styles.head}>
      <GhostButton onPress={onBack} accessibilityLabel="Back" style={styles.backThumb}>
        <Text style={[styles.chev, { color: t.ink }]}>‹</Text>
      </GhostButton>
      <View style={styles.titleRow}>
        <BagIcon size={28} />
        <Text style={[styles.h1, { color: t.gold2 }]}>{title}</Text>
      </View>
      <Text style={[styles.pill, { color: t.muted, borderColor: t.hudPillBorder }]}>{pill}</Text>
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
