import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CAMPAIGN_OFFERING_COPY,
  ITEMS,
  canSocket,
  confirmCopy,
  confirmLabel,
  emptyOfferings,
  offeringCaptionParts,
  offeringPickerRows,
  quoteEntry,
  type CollectionState,
  type Difficulty,
  type ItemId,
  type OfferingSlots,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { BagIcon, GoldIcon, ItemIcon, ScalesIcon, TorchIcon } from './icons';
import MuteButton from './MuteButton';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export default function TitleMenu({
  onStart,
  onResume,
  resumeCopy,
  onCollection,
  onShop,
  gold,
  meta,
  muted,
  onToggleMute,
  onUi,
  onDeny,
}: {
  onStart: (mode: Difficulty, offerings?: OfferingSlots) => void;
  onResume?: () => void;
  resumeCopy: string | null;
  onCollection: () => void;
  onShop: () => void;
  gold: number;
  meta: CollectionState;
  muted: boolean;
  onToggleMute: () => void;
  onUi: () => void;
  onDeny: () => void;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [pending, setPending] = useState<Difficulty | null>(null);
  const [offerings, setOfferings] = useState<OfferingSlots>(emptyOfferings);
  const [pickingSlot, setPickingSlot] = useState<0 | 1 | null>(null);
  const quote = pending
    ? quoteEntry(pending, meta, pending === 'campaign' ? offerings : undefined)
    : null;

  const closeStart = () => {
    onUi();
    setStartOpen(false);
    setPending(null);
    setOfferings(emptyOfferings());
    setPickingSlot(null);
  };

  const pick = (mode: Difficulty) => {
    if (mode === 'campaign') {
      onUi();
      setOfferings(emptyOfferings());
      setPickingSlot(null);
      setPending('campaign');
      return;
    }
    const next = quoteEntry(mode, meta);
    if (next.kind === 'free') {
      onUi();
      setStartOpen(false);
      setPending(null);
      onStart(mode);
      return;
    }
    if (next.kind === 'blocked') onDeny();
    else onUi();
    setPending(mode);
  };

  const confirm = () => {
    if (!pending || !quote) return;
    if (quote.kind === 'blocked') {
      onDeny();
      return;
    }
    const mode = pending;
    const slots = mode === 'campaign' ? offerings : undefined;
    onUi();
    setPending(null);
    setStartOpen(false);
    setOfferings(emptyOfferings());
    setPickingSlot(null);
    onStart(mode, slots);
  };

  const socket = (slot: 0 | 1, id: ItemId) => {
    if (!canSocket(id, meta, offerings, slot)) {
      onDeny();
      return;
    }
    onUi();
    const next: OfferingSlots = [...offerings];
    next[slot] = id;
    setOfferings(next);
    setPickingSlot(null);
  };

  const clearSlot = (slot: 0 | 1) => {
    onUi();
    const next: OfferingSlots = [...offerings];
    next[slot] = null;
    setOfferings(next);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.title}>
        <TorchIcon size={42} />
        <Text style={styles.h1}>Crawler Mines</Text>
        <Text style={styles.tagline}>Bombs don&apos;t kill you. They kill the loot.</Text>
      </View>
      <View style={styles.rules}>
        <Text style={styles.rule}>Clear every safe tile.</Text>
        <Text style={styles.rule}>Blasts chain into nearby bombs.</Text>
        <Text style={styles.rule}>Long-press to flag.</Text>
      </View>
      <View style={styles.nav}>
        {onResume && resumeCopy ? (
          <StoneButton
            onPress={() => {
              onUi();
              onResume();
            }}
          >
            <Text style={styles.rowLabel}>Resume</Text>
            <Text style={styles.meta}>{resumeCopy}</Text>
          </StoneButton>
        ) : null}
        <StoneButton
          gold
          onPress={() => {
            onUi();
            setStartOpen(true);
          }}
          style={styles.cta}
        >
          Start
        </StoneButton>
        <StoneButton
          onPress={() => {
            onUi();
            onCollection();
          }}
        >
          <View style={styles.rowMain}>
            <BagIcon size={26} />
            <Text style={styles.rowLabel}>Collection</Text>
          </View>
          <View style={styles.wallet}>
            <GoldIcon size={20} />
            <Text style={styles.walletN}>{gold}</Text>
          </View>
        </StoneButton>
        <StoneButton
          onPress={() => {
            onUi();
            onShop();
          }}
        >
          <View style={styles.rowMain}>
            <ScalesIcon size={26} />
            <Text style={styles.rowLabel}>Shop</Text>
          </View>
        </StoneButton>
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </View>

      {startOpen && !pending ? (
        <Overlay onBackdrop={closeStart}>
          <Tablet>
            <DisplayText>Start</DisplayText>
            <View style={styles.modes}>
              <ModeButton mode="easy" label="Easy" size="8x8" meta={meta} onPick={pick} />
              <ModeButton mode="medium" label="Medium" size="9x12" meta={meta} onPick={pick} />
              <ModeButton mode="hard" label="Hard" size="12x16" meta={meta} onPick={pick} />
              <ModeButton mode="campaign" label="Campaign" size="5 floors" gold meta={meta} onPick={pick} />
            </View>
            <StoneButton onPress={closeStart} style={styles.centerBtn}>
              Cancel
            </StoneButton>
          </Tablet>
        </Overlay>
      ) : null}

      {quote && pending === 'hard' ? (
        <Overlay onBackdrop={() => setPending(null)}>
          <Tablet>
            <DisplayText>{quote.kind === 'blocked' ? "Can't enter Hard" : 'Enter Hard?'}</DisplayText>
            <MutedText style={styles.pad}>{confirmCopy(quote)}</MutedText>
            {quote.kind === 'blocked' ? (
              <StoneButton gold onPress={() => setPending(null)} style={styles.centerBtn}>
                Got it
              </StoneButton>
            ) : (
              <View style={styles.col}>
                <StoneButton gold onPress={confirm} style={styles.centerBtn}>
                  {confirmLabel(quote)}
                </StoneButton>
                <StoneButton onPress={() => setPending(null)} style={styles.centerBtn}>
                  Cancel
                </StoneButton>
              </View>
            )}
          </Tablet>
        </Overlay>
      ) : null}

      {quote && pending === 'campaign' ? (
        <Overlay
          onBackdrop={() => {
            if (pickingSlot != null) {
              setPickingSlot(null);
              return;
            }
            setPending(null);
            setOfferings(emptyOfferings());
          }}
        >
          <Tablet>
            <DisplayText style={styles.entryTitle}>Enter Campaign?</DisplayText>
            <MutedText style={styles.entryCopy}>{CAMPAIGN_OFFERING_COPY}</MutedText>
            <View style={styles.wells}>
              <OfferingWell
                itemId={offerings[0]}
                onOpen={() => {
                  onUi();
                  setPickingSlot(0);
                }}
                onClear={() => clearSlot(0)}
              />
              <OfferingWell
                itemId={offerings[1]}
                onOpen={() => {
                  onUi();
                  setPickingSlot(1);
                }}
                onClear={() => clearSlot(1)}
              />
            </View>
            <Text style={styles.status}>
              {offeringCaptionParts(offerings, quote).map((part, i) => (
                <Text key={`${part.text}-${i}`}>
                  {i > 0 ? <Text style={styles.dot}> · </Text> : null}
                  <Text style={part.gold ? styles.goldPart : undefined}>{part.text}</Text>
                </Text>
              ))}
            </Text>
            <View style={styles.col}>
              <StoneButton
                gold
                locked={quote.kind === 'blocked'}
                onPress={confirm}
                style={styles.centerBtn}
              >
                {quote.kind === 'blocked' ? 'Spend 100 gold' : confirmLabel(quote)}
              </StoneButton>
              <StoneButton
                onPress={() => {
                  onUi();
                  setPending(null);
                  setOfferings(emptyOfferings());
                  setPickingSlot(null);
                }}
                style={styles.centerBtn}
              >
                Cancel
              </StoneButton>
            </View>
          </Tablet>
        </Overlay>
      ) : null}

      {pending === 'campaign' && pickingSlot != null ? (
        <OfferingsPicker
          meta={meta}
          slots={offerings}
          fillingSlot={pickingSlot}
          onPick={(id) => socket(pickingSlot, id)}
          onCancel={() => {
            onUi();
            setPickingSlot(null);
          }}
          onDeny={onDeny}
        />
      ) : null}
    </View>
  );
}

function OfferingWell({
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
            <ItemIcon id={itemId} size={58} />
          </View>
        ) : (
          <Pressable style={styles.well} onPress={onOpen} accessibilityLabel="Empty offering slot" />
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

function OfferingsPicker({
  meta,
  slots,
  fillingSlot,
  onPick,
  onCancel,
  onDeny,
}: {
  meta: CollectionState;
  slots: OfferingSlots;
  fillingSlot: 0 | 1;
  onPick: (id: ItemId) => void;
  onCancel: () => void;
  onDeny: () => void;
}) {
  const rows = offeringPickerRows(meta, slots, fillingSlot);
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

function ModeButton({
  mode,
  label,
  size,
  gold,
  meta,
  onPick,
}: {
  mode: Difficulty;
  label: string;
  size: string;
  gold?: boolean;
  meta: CollectionState;
  onPick: (mode: Difficulty) => void;
}) {
  const quote = quoteEntry(mode, meta);
  const free = quote.kind === 'free';
  const locked =
    mode === 'campaign'
      ? quote.kind === 'blocked' && (meta.items['campaign-key'] ?? 0) < 1
      : quote.kind === 'blocked';
  return (
    <StoneButton gold={gold} locked={locked} onPress={() => onPick(mode)}>
      <Text style={[styles.rowLabel, gold && { color: colors.gold2 }]}>{label}</Text>
      <View style={styles.modeMeta}>
        <Text style={styles.meta}>{size}</Text>
        {free ? (
          <Text style={styles.ticket}>free</Text>
        ) : (
          <View style={styles.ticketRow}>
            <View style={styles.price}>
              <GoldIcon size={16} />
              <Text style={styles.ticket}>{quote.cost}</Text>
            </View>
            {mode !== 'campaign' && quote.keyCount > 0 && quote.keyId ? (
              <View style={styles.price}>
                <ItemIcon id={quote.keyId} size={16} />
                <Text style={styles.ticket}>×{quote.keyCount}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </StoneButton>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, justifyContent: 'center', gap: 22 },
  title: { alignItems: 'center' },
  h1: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    letterSpacing: 1.4,
    color: colors.gold,
    marginTop: 8,
  },
  tagline: { fontFamily: fonts.ui, color: colors.muted, fontSize: 15, marginTop: 8 },
  rules: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(224, 180, 74, 0.2)',
  },
  rule: { fontFamily: fonts.ui, color: colors.muted, fontSize: 15, marginTop: 4 },
  nav: { gap: 16 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, letterSpacing: 0.8 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletN: { fontFamily: fonts.uiBold, color: colors.gold2, fontSize: 16 },
  meta: { fontFamily: fonts.ui, color: colors.muted, fontSize: 14 },
  cta: { justifyContent: 'center' },
  modes: { gap: 10, marginTop: 12, marginBottom: 8 },
  centerBtn: { justifyContent: 'center', marginTop: 8 },
  pad: { marginVertical: 10 },
  col: { gap: 8, marginTop: 8 },
  entryTitle: { color: colors.ink, textTransform: 'uppercase' },
  entryCopy: { fontSize: 13, marginVertical: 10 },
  wells: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginVertical: 8 },
  wellWrap: { alignItems: 'center', width: 110 },
  wellFrame: { width: 92, height: 92 },
  well: {
    width: 92,
    height: 92,
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
  wellLabel: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
  status: {
    fontFamily: fonts.display,
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginVertical: 8,
  },
  goldPart: { color: colors.gold2 },
  dot: { color: colors.muted },
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
  modeMeta: { alignItems: 'flex-end', gap: 4 },
  ticket: { fontFamily: fonts.uiBold, color: colors.gold2, fontSize: 13 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
