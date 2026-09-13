import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import {
  BOSS_COPY,
  CAMPAIGN_FLOORS,
  ITEMS,
  chestNotices,
  isTicketKey,
  stackedEntries,
  type GameEvent,
} from '../../../src/engine';
import { sfxFromEvents } from '../audio';
import { getAudio } from '../audio/player';
import { keyStore } from '../storage';
import { floorReport, useGameStore, type FloorReport, type Run } from '../store';
import { colors, fonts } from '../theme';
import Board, { chainDuration, collectFx, type BlastFx } from './Board';
import { clampBoardSlot, fitBoardCellPx } from './fitBoardCell';
import { BagIcon, BossIcon, ChestIcon, FlagIcon, GoldIcon, ItemIcon, MenuIcon, ShovelIcon } from './icons';
import LootQueue, { type LootToastItem } from './LootToast';
import MuteButton from './MuteButton';
import { DisplayText, GhostButton, MutedText, Overlay, StoneButton, Tablet } from './primitives';

const TUTORIAL_KEY = 'crawler-mines-tutorial';

function reportFor(run: Run): FloorReport | null {
  if (run.game.status === 'cleared' || run.game.status === 'lost') return floorReport(run);
  return null;
}

export default function PlayScreen({
  muted,
  onToggleMute,
  onCollection,
  onExitRun,
}: {
  muted: boolean;
  onToggleMute: () => void;
  onCollection: () => void;
  onExitRun: () => void;
}) {
  const run = useGameStore((s) => s.run);
  const applyDig = useGameStore((s) => s.applyDig);
  const applyFlag = useGameStore((s) => s.applyFlag);
  const applyExtract = useGameStore((s) => s.applyExtract);
  const nextFloorAction = useGameStore((s) => s.nextFloor);
  const retryFloorAction = useGameStore((s) => s.retryFloor);
  const dismissBossReveal = useGameStore((s) => s.dismissBossReveal);

  const [flagMode, setFlagMode] = useState(false);
  const [tutorial, setTutorial] = useState(() => {
    if (!run) return false;
    return keyStore.getItem(TUTORIAL_KEY) !== '1';
  });
  const [report, setReport] = useState<FloorReport | null>(() => (run ? reportFor(run) : null));
  const [blasts, setBlasts] = useState<BlastFx[]>([]);
  const [sparkles, setSparkles] = useState<Array<{ id: number; index: number }>>([]);
  const [shaking, setShaking] = useState(false);
  const [lootQueue, setLootQueue] = useState<LootToastItem[]>([]);
  const [extractPrompt, setExtractPrompt] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [slot, setSlot] = useState({ w: 0, h: 0 });
  const fxId = useRef(1);
  const toastId = useRef(1);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  const cueUi = () => getAudio().playSfx('ui');

  const applyFx = useCallback(
    (events: GameEvent[], after?: () => void) => {
      const packed = collectFx(events, fxId.current);
      fxId.current = packed.nextId;
      if (packed.blasts.length) setBlasts(packed.blasts);
      if (packed.sparkles.length) setSparkles(packed.sparkles);
      if (packed.wrecked && !reduceMotion) {
        setShaking(true);
        setTimeout(() => setShaking(false), 520);
      }
      const maxWave = packed.blasts.reduce((m, b) => Math.max(m, b.wave), 0);
      if (after) {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(after, chainDuration(maxWave, reduceMotion));
      }
    },
    [reduceMotion],
  );

  const queueChestToasts = useCallback((events: GameEvent[], cells: NonNullable<typeof run>['game']['cells']) => {
    const notices = chestNotices(events, cells);
    if (notices.length === 0) return;
    setLootQueue((prev) => [
      ...prev,
      ...notices.map((n) => ({
        id: toastId.current++,
        kind: n.kind,
        tier: n.tier,
      })),
    ]);
  }, []);

  const finishIfEnded = useCallback(
    (events: GameEvent[]) => {
      const ended = events.some((e) => e.type === 'cleared' || e.type === 'lost');
      applyFx(
        events,
        ended
          ? () => {
              const next = useGameStore.getState().run;
              if (!next) return;
              setLootQueue([]);
              setReport(floorReport(next));
            }
          : undefined,
      );
    },
    [applyFx],
  );

  const onDig = useCallback(
    (index: number) => {
      const events = applyDig(index);
      const cur = useGameStore.getState().run;
      if (!cur || events.length === 0) return;
      if (events.some((e) => e.type === 'extract-prompt')) setExtractPrompt(true);
      for (const id of sfxFromEvents(events)) getAudio().playSfx(id);
      queueChestToasts(events, cur.game.cells);
      finishIfEnded(events);
    },
    [applyDig, finishIfEnded, queueChestToasts],
  );

  const onExtract = useCallback(() => {
    setExtractPrompt(false);
    const events = applyExtract();
    const cur = useGameStore.getState().run;
    if (!cur || events.length === 0) return;
    for (const id of sfxFromEvents(events)) getAudio().playSfx(id);
    finishIfEnded(events);
  }, [applyExtract, finishIfEnded]);

  const onFlag = useCallback(
    (index: number) => {
      const cell = useGameStore.getState().run?.game.cells[index];
      if (!cell || cell.state === 'revealed') return;
      const events = applyFlag(index);
      getAudio().playSfx('flag');
      for (const id of sfxFromEvents(events)) getAudio().playSfx(id);
    },
    [applyFlag],
  );

  const clearFx = () => {
    setBlasts([]);
    setSparkles([]);
    setLootQueue([]);
    setShaking(false);
    setReport(null);
    setFlagMode(false);
    setExtractPrompt(false);
    setMenuOpen(false);
  };

  const nextFloor = () => {
    nextFloorAction();
    const next = useGameStore.getState().run;
    clearFx();
    if (!next) onExitRun();
  };

  const retryFloor = () => {
    retryFloorAction();
    clearFx();
  };

  const dismissTutorial = () => {
    keyStore.setItem(TUTORIAL_KEY, '1');
    setTutorial(false);
  };

  const boardW = run?.game.width ?? 8;
  const boardH = run?.game.height ?? 8;
  const cellPx = useMemo(() => {
    if (slot.w <= 0 || slot.h <= 0) return 0;
    const capped = clampBoardSlot(
      slot.w,
      slot.h,
      win.width,
      win.height,
      insets.left,
      insets.right,
      insets.top,
      insets.bottom,
    );
    return fitBoardCellPx(capped.w, capped.h, boardW, boardH);
  }, [slot, win.width, win.height, insets.left, insets.right, insets.top, insets.bottom, boardW, boardH]);

  if (!run) return null;

  const { game, mode, floor } = run;
  const floorLabel = mode === 'campaign' ? `Floor ${floor + 1}/${CAMPAIGN_FLOORS.length}` : mode;
  const salvage = report ? stackedEntries(report.loot) : [];
  const boss = game.boss;
  const bossName = boss ? BOSS_COPY[boss.id].name : 'Boss';
  const showReplay = report && report.outcome !== 'lost' && report.outcome !== 'victory';
  const goldCopy =
    report?.outcome === 'stashed'
      ? 'Held until the boss falls.'
      : report?.outcome === 'victory'
        ? 'Stash dumped into your wallet.'
        : 'Pouched gold, now in your wallet.';
  const revealBoss = Boolean(run.bossRevealPending && boss && boss.lives > 0 && !report);

  return (
    <View style={styles.shell}>
      <View style={styles.hud}>
        <GhostButton
          onPress={() => {
            cueUi();
            setMenuOpen(true);
          }}
          accessibilityLabel="Game menu"
        >
          <MenuIcon size={20} />
        </GhostButton>
        <View style={styles.stats}>
          <View style={[styles.stat, styles.found]}>
            <Text style={[styles.statLabel, styles.foundLabel]}>Found</Text>
            <View style={styles.statRow}>
              <ChestIcon tier="wooden" size={16} />
              <Text style={styles.statN}>{game.chestsOpened}</Text>
            </View>
          </View>
          <View style={[styles.stat, styles.wreck]}>
            <Text style={[styles.statLabel, styles.wreckLabel]}>Broken</Text>
            <View style={styles.statRow}>
              <ChestIcon wrecked tier="wooden" size={16} />
              <Text style={styles.statN}>{game.chestsDestroyed}</Text>
            </View>
          </View>
          {boss ? (
            <View style={[styles.stat, styles.bossStat]}>
              <Text style={[styles.statLabel, styles.bossLabel]}>{bossName}</Text>
              <View style={styles.statRow}>
                <BossIcon id={boss.id} size={16} />
                <Text style={styles.statN}>{Math.max(0, boss.lives)}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <Text style={styles.pill}>{floorLabel}</Text>
      </View>

      <View
        style={styles.boardSlot}
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSlot((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        }}
      >
        <View style={styles.boardCanvas} pointerEvents="box-none">
          <Board
            game={game}
            cellPx={cellPx}
            flagMode={flagMode}
            blasts={blasts}
            sparkles={sparkles}
            shaking={shaking}
            reduceMotion={reduceMotion}
            onDig={onDig}
            onFlag={onFlag}
          />
        </View>
      </View>

      <LootQueue
        queue={lootQueue}
        onDismiss={(id) => setLootQueue((prev) => prev.filter((t) => t.id !== id))}
        reduceMotion={reduceMotion}
      />

      <View style={styles.dock}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, !flagMode && styles.toggleOn]}
            onPress={() => {
              cueUi();
              setFlagMode(false);
            }}
          >
            <ShovelIcon size={22} />
            <Text style={[styles.toggleText, !flagMode && styles.toggleOnText]}>Dig</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, flagMode && styles.toggleFlag]}
            onPress={() => {
              cueUi();
              setFlagMode(true);
            }}
          >
            <FlagIcon size={22} />
            <Text style={[styles.toggleText, flagMode && styles.toggleFlagText]}>Flag</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {boss
            ? boss.lives <= 0
              ? 'The boss is dead. Find the door and extract.'
              : boss.id === 'lust'
                ? 'Blast a mine next to him. Hearts hide numbers until a blast.'
                : 'Hit it with a blast. Eating a flag is not a loss.'
            : `Tap to ${flagMode ? 'flag' : 'dig'} · hold 400ms to flag`}
        </Text>
      </View>

      {menuOpen && !report ? (
        <Overlay
          onBackdrop={() => {
            cueUi();
            setMenuOpen(false);
          }}
        >
          <Tablet>
            <DisplayText>Menu</DisplayText>
            <View style={styles.menuNav}>
              <StoneButton
                gold
                onPress={() => {
                  cueUi();
                  setMenuOpen(false);
                }}
                style={styles.center}
              >
                Continue
              </StoneButton>
              <StoneButton
                onPress={() => {
                  cueUi();
                  setMenuOpen(false);
                  onCollection();
                }}
              >
                <View style={styles.rowMain}>
                  <BagIcon size={26} />
                  <Text style={styles.rowLabel}>Collection</Text>
                </View>
              </StoneButton>
              <MuteButton muted={muted} onToggle={onToggleMute} />
              <StoneButton
                onPress={() => {
                  cueUi();
                  setMenuOpen(false);
                  onExitRun();
                }}
                style={styles.center}
              >
                Exit run
              </StoneButton>
            </View>
          </Tablet>
        </Overlay>
      ) : null}

      {tutorial && !revealBoss && !menuOpen ? (
        <Overlay onBackdrop={dismissTutorial}>
          <Tablet>
            <DisplayText>First descent</DisplayText>
            <MutedText style={styles.pad}>Bombs don&apos;t kill you. They kill the loot next to them.</MutedText>
            <MutedText style={styles.pad}>Clear every safe tile. Blasts chain — a bomb sets off its neighbors.</MutedText>
            <StoneButton
              gold
              onPress={() => {
                cueUi();
                dismissTutorial();
              }}
              style={styles.center}
            >
              I understand
            </StoneButton>
          </Tablet>
        </Overlay>
      ) : null}

      {revealBoss && boss ? (
        <Overlay
          onBackdrop={() => {
            cueUi();
            dismissBossReveal();
          }}
        >
          <Tablet>
            <View style={styles.bossReveal}>
              <BossIcon id={boss.id} size={64} />
            </View>
            <DisplayText>{BOSS_COPY[boss.id].name}</DisplayText>
            <MutedText style={styles.pad}>{BOSS_COPY[boss.id].blurb}</MutedText>
            <StoneButton
              gold
              onPress={() => {
                cueUi();
                dismissBossReveal();
              }}
              style={styles.center}
            >
              Face it
            </StoneButton>
          </Tablet>
        </Overlay>
      ) : null}

      {extractPrompt && !report && !menuOpen ? (
        <Overlay>
          <Tablet>
            <DisplayText>Leave now?</DisplayText>
            <MutedText style={styles.pad}>
              Treasure still lies buried. Exit with what you have, or keep digging.
            </MutedText>
            <View style={styles.col}>
              <StoneButton
                gold
                onPress={() => {
                  cueUi();
                  setExtractPrompt(false);
                }}
                style={styles.center}
              >
                Keep digging
              </StoneButton>
              <StoneButton
                onPress={() => {
                  cueUi();
                  onExtract();
                }}
                style={styles.center}
              >
                Exit
              </StoneButton>
            </View>
          </Tablet>
        </Overlay>
      ) : null}

      {report ? (
        <Overlay>
          <Tablet>
            <DisplayText>
              {report.outcome === 'lost'
                ? 'Campaign failed'
                : report.outcome === 'victory'
                  ? `${bossName} defeated`
                  : report.lastFloor && mode === 'campaign'
                    ? 'Dungeon cleared'
                    : 'Floor cleared'}
            </DisplayText>
            {report.outcome === 'lost' ? (
              <MutedText style={styles.pad}>The boss kept the stash. Every coin and relic is gone.</MutedText>
            ) : (
              <>
                <View style={styles.tally}>
                  <View>
                    <Text style={styles.tallyEm}>Found</Text>
                    <Text style={styles.pos}>{report.opened}</Text>
                  </View>
                  <View>
                    <Text style={styles.tallyEm}>Broken</Text>
                    <Text style={styles.neg}>{report.wrecked}</Text>
                  </View>
                </View>
                {report.outcome === 'stashed' ? (
                  <MutedText>Loot is stashed until the boss falls.</MutedText>
                ) : null}
                {report.bossHead ? (
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonus}>Trophy</Text>
                    <ItemIcon id={report.bossHead} size={18} />
                    <Text style={styles.bonus}>{ITEMS[report.bossHead].name}</Text>
                  </View>
                ) : null}
                {report.goldCup ? (
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonus}>Trophy</Text>
                    <ItemIcon id={report.goldCup} size={18} />
                    <Text style={styles.bonus}>{ITEMS[report.goldCup].name}</Text>
                  </View>
                ) : null}
                {report.bonusKey ? (
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonus}>Bonus</Text>
                    <ItemIcon id={report.bonusKey} size={18} />
                    <Text style={styles.bonus}>{ITEMS[report.bonusKey].name}</Text>
                  </View>
                ) : null}
                {report.gold > 0 || salvage.length > 0 ? (
                  <ScrollView style={styles.lootScroll}>
                    {report.gold > 0 ? (
                      <View style={styles.lootCard}>
                        <View style={styles.lootIco}>
                          <GoldIcon size={28} />
                        </View>
                        <View style={styles.lootCopy}>
                          <Text style={styles.lootName}>Coins</Text>
                          <Text style={styles.lootEm}>{goldCopy}</Text>
                        </View>
                        <Text style={styles.lootN}>+{report.gold}</Text>
                      </View>
                    ) : null}
                    {salvage.map(({ item, count }) => (
                      <View
                        key={item.id}
                        style={[
                          styles.lootCard,
                          isTicketKey(item.id) && styles.ticket,
                          (report.bonusKey === item.id ||
                            report.bossHead === item.id ||
                            report.goldCup === item.id) &&
                            styles.bonusCard,
                        ]}
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
                ) : (
                  <MutedText>No loot survived.</MutedText>
                )}
              </>
            )}
            <View style={styles.col}>
              {mode === 'campaign' && report.outcome === 'stashed' ? (
                <StoneButton
                  gold
                  onPress={() => {
                    cueUi();
                    nextFloor();
                  }}
                  style={styles.center}
                >
                  Descend
                </StoneButton>
              ) : (
                <StoneButton
                  gold
                  onPress={() => {
                    cueUi();
                    nextFloor();
                  }}
                  style={styles.center}
                >
                  {mode === 'campaign' ? 'Return' : 'Menu'}
                </StoneButton>
              )}
              {showReplay ? (
                <StoneButton
                  onPress={() => {
                    cueUi();
                    retryFloor();
                  }}
                  style={styles.center}
                >
                  Replay floor
                </StoneButton>
              ) : null}
            </View>
          </Tablet>
        </Overlay>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', gap: 6 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  boardSlot: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  boardCanvas: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stats: { flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center' },
  stat: {
    flex: 1,
    maxWidth: 90,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  found: {},
  wreck: {},
  bossStat: { borderColor: 'rgba(180, 80, 200, 0.35)' },
  statLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  foundLabel: { color: colors.gold },
  wreckLabel: { color: colors.ash },
  bossLabel: { color: '#c9b4ff' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statN: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 14 },
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
  dock: { paddingBottom: 8, flexShrink: 0 },
  toggle: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
  },
  toggleOn: { backgroundColor: colors.stoneHi },
  toggleFlag: { backgroundColor: colors.stoneHi },
  toggleText: { fontFamily: fonts.display, color: colors.muted, letterSpacing: 1 },
  toggleOnText: { color: colors.gold2 },
  toggleFlagText: { color: '#ffb4b4' },
  hint: { marginTop: 6, textAlign: 'center', color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  menuNav: { gap: 12, marginTop: 12 },
  center: { justifyContent: 'center' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontFamily: fonts.display, color: colors.ink, fontSize: 17 },
  pad: { marginVertical: 8 },
  col: { gap: 8, marginTop: 8 },
  bossReveal: { alignItems: 'center', marginBottom: 8 },
  tally: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
  tallyEm: { fontFamily: fonts.ui, color: colors.muted, fontSize: 12, textAlign: 'center' },
  pos: { fontFamily: fonts.display, color: colors.gold, fontSize: 26, textAlign: 'center' },
  neg: { fontFamily: fonts.display, color: '#e07a6a', fontSize: 26, textAlign: 'center' },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bonus: { fontFamily: fonts.display, color: colors.gold2, fontSize: 15, textAlign: 'center' },
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
