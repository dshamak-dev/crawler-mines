import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  BOSS_COPY,
  activeTorchHintIndices,
  cellVisual,
  gridNumberColor,
  gridSkinPaint,
  type BossId,
  type Cell,
  type FlagSkinId,
  type Game,
  type GameEvent,
  type GridSkinId,
  type GridSkinPaint,
} from '../../../src/engine';
import { colors, fonts } from '../theme';
import { BOARD_GAP } from './fitBoardCell';
import { BombIcon, BossIcon, ChestIcon, DoorIcon, FlagIcon, HeartIcon } from './icons';

const LONG_MS = 400;
const GAP = BOARD_GAP;
export const BLAST_STAGGER_MS = 95;

export interface BlastFx {
  id: number;
  index: number;
  wrecked: number[];
  wave: number;
}

export function collectFx(
  events: GameEvent[],
  id0: number,
): {
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  wrecked: boolean;
  nextId: number;
} {
  let id = id0;
  const blasts: BlastFx[] = [];
  const sparkles: Array<{ id: number; index: number }> = [];
  let wrecked = false;
  for (const e of events) {
    if (e.type === 'explode') {
      blasts.push({ id: id++, index: e.index, wrecked: e.wrecked, wave: e.wave });
      if (e.wrecked.length > 0) wrecked = true;
    } else if (e.type === 'chest') {
      sparkles.push({ id: id++, index: e.index });
    }
  }
  return { blasts, sparkles, wrecked, nextId: id };
}

export function chainDuration(maxWave: number, reduce: boolean): number {
  if (reduce) return 0;
  return maxWave * BLAST_STAGGER_MS + 420;
}

interface BoardProps {
  game: Game;
  cellPx: number;
  flagMode: boolean;
  flagSkin?: FlagSkinId;
  gridSkin?: GridSkinId;
  blasts: BlastFx[];
  sparkles: Array<{ id: number; index: number }>;
  shaking: boolean;
  reduceMotion: boolean;
  onDig: (index: number) => void;
  onFlag: (index: number) => void;
}

export default function Board({
  game,
  cellPx,
  flagMode,
  flagSkin = 'flag-red',
  gridSkin = 'grid-gray',
  blasts,
  sparkles,
  shaking,
  reduceMotion,
  onDig,
  onFlag,
}: BoardProps) {
  const rows = useMemo(() => {
    const out: number[][] = [];
    for (let y = 0; y < game.height; y += 1) {
      const start = y * game.width;
      out.push(Array.from({ length: game.width }, (_, x) => start + x));
    }
    return out;
  }, [game.height, game.width]);
  const waveOf = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of blasts) map.set(b.index, b.wave);
    return map;
  }, [blasts]);
  const wreckWave = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of blasts) {
      for (const w of b.wrecked) map.set(w, b.wave);
    }
    return map;
  }, [blasts]);

  const [hintTick, setHintTick] = useState(0);
  const hinted = useMemo(
    () => new Set(activeTorchHintIndices(game)),
    [game, hintTick],
  );

  useEffect(() => {
    const remain = (game.torchHint?.until ?? 0) - Date.now();
    if (remain <= 0) return;
    const timer = setTimeout(() => setHintTick((n) => n + 1), remain);
    return () => clearTimeout(timer);
  }, [game.torchHint]);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    if (!shaking || reduceMotion) return;
    shakeX.value = withSequence(
      withTiming(-4, { duration: 90 }),
      withTiming(4, { duration: 90 }),
      withTiming(-2, { duration: 90 }),
      withTiming(2, { duration: 90 }),
      withTiming(0, { duration: 90 }),
    );
  }, [shaking, reduceMotion, shakeX]);

  if (cellPx < 1) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.stage, shakeStyle]}>
        <View style={styles.board} accessibilityRole="none" accessibilityLabel="Dungeon floor">
          {rows.map((indexes, y) => (
            <View key={y} style={styles.row}>
              {indexes.map((i) => {
                const cell = game.cells[i];
                return (
                  <DungeonCell
                    key={i}
                    index={i}
                    cell={cell}
                    size={cellPx}
                    flagMode={flagMode}
                    flagSkin={flagSkin}
                    gridPaint={gridSkinPaint(gridSkin)}
                    wave={waveOf.get(i)}
                    wreckedWave={wreckWave.get(i)}
                    reduce={reduceMotion}
                    bossHere={game.boss != null && game.boss.index === i && game.status === 'playing'}
                    bossId={game.boss?.id ?? 'gluttony'}
                    bossDead={game.boss != null && game.boss.lives <= 0}
                    hearted={cell.hearted === true}
                    hinted={hinted.has(i)}
                    door={
                      game.doorIndex === i && (cell.state === 'revealed' || cell.wrecked)
                    }
                    onDig={onDig}
                    onFlag={onFlag}
                  />
                );
              })}
            </View>
          ))}
        </View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill as object}>
          {blasts.map((b) => (
            <Burst
              key={b.id}
              index={b.index}
              width={game.width}
              cellPx={cellPx}
              delay={reduceMotion ? 0 : b.wave * BLAST_STAGGER_MS}
              kind="bomb"
            />
          ))}
          {sparkles.map((s) => (
            <Burst key={s.id} index={s.index} width={game.width} cellPx={cellPx} delay={0} kind="gold" />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const DungeonCell = memo(function DungeonCell({
  index,
  cell,
  size,
  flagMode,
  flagSkin,
  gridPaint,
  wave,
  wreckedWave,
  reduce,
  bossHere,
  bossId,
  bossDead,
  hearted,
  hinted,
  door,
  onDig,
  onFlag,
}: {
  index: number;
  cell: Cell;
  size: number;
  flagMode: boolean;
  flagSkin: FlagSkinId;
  gridPaint: GridSkinPaint;
  wave?: number;
  wreckedWave?: number;
  reduce: boolean;
  bossHere: boolean;
  bossId: BossId;
  bossDead: boolean;
  hearted: boolean;
  hinted: boolean;
  door: boolean;
  onDig: (i: number) => void;
  onFlag: (i: number) => void;
}) {
  const visual = cellVisual(cell);
  const icon = Math.round(size * 0.72);
  const mineHint = hinted && visual !== 'exploded';

  const longPress = Gesture.LongPress()
    .minDuration(LONG_MS)
    .maxDistance(14)
    .onStart(() => {
      onFlag(index);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .runOnJS(true);

  const tap = Gesture.Tap()
    .onEnd(() => {
      if (flagMode) onFlag(index);
      else onDig(index);
    })
    .runOnJS(true);

  const gesture = useMemo(() => Gesture.Exclusive(longPress, tap), [longPress, tap]);

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const playedWave = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduce || wave == null || playedWave.current === wave) return;
    playedWave.current = wave;
    pop.value = withSequence(
      withTiming(0.55, { duration: 1 }),
      withTiming(1.08, { duration: 180 }),
      withTiming(1, { duration: 240 }),
    );
  }, [reduce, wave, pop]);

  const bossName = BOSS_COPY[bossId].name;
  const label = bossHere
    ? `${bossDead ? `Fallen ${bossName}` : bossName}${hearted ? ', heart covering the number' : ''}`
    : hearted
      ? `Heart covering ${cell.adjacentMines} adjacent bombs`
      : mineHint
        ? 'Mine hint'
        : door && cell.wrecked
        ? 'Wrecked exit door'
        : door
          ? 'Exit door'
          : ariaFor(visual, cell.adjacentMines, cell.tier);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.cell,
          cellStyle(visual, bossHere, bossId, door, gridPaint, mineHint),
          { width: size, height: size },
          popStyle,
        ]}
      >
        {mineHint ? (
          <BombIcon size={icon} />
        ) : visual === 'flagged' || visual === 'bomb-flagged' ? (
          <FlagIcon ember={visual === 'bomb-flagged'} skin={flagSkin} size={icon} />
        ) : hearted ? (
          <HeartIcon size={Math.round(size * 0.78)} />
        ) : visual === 'exploded' ? (
          <BombIcon cracked size={icon} />
        ) : visual === 'chest' ? (
          <ChestIcon tier={cell.tier ?? 'wooden'} size={icon} />
        ) : visual === 'wrecked' && door ? (
          <DoorIcon size={Math.round(size * 0.78)} />
        ) : visual === 'wrecked' ? (
          <ChestIcon wrecked tier={cell.tier ?? 'wooden'} size={icon} />
        ) : door ? (
          <DoorIcon size={Math.round(size * 0.78)} />
        ) : visual === 'number' && !bossHere ? (
          <Text
            style={[
              styles.rune,
              { color: gridNumberColor(gridPaint, cell.adjacentMines), fontSize: size * 0.46 },
            ]}
          >
            {cell.adjacentMines}
          </Text>
        ) : visual === 'number' && bossHere ? (
          <Text
            style={[
              styles.rune,
              { color: gridNumberColor(gridPaint, cell.adjacentMines), fontSize: size * 0.32, opacity: 0.35 },
            ]}
          >
            {cell.adjacentMines}
          </Text>
        ) : null}
        {bossHere ? (
          <View style={[styles.bossGlyph, bossDead && styles.bossDead]}>
            <BossIcon id={bossId} size={Math.round(size * 0.86)} />
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
});

function Burst({
  index,
  width,
  cellPx,
  delay,
  kind,
}: {
  index: number;
  width: number;
  cellPx: number;
  delay: number;
  kind: 'bomb' | 'gold';
}) {
  const col = index % width;
  const row = Math.floor(index / width);
  const x = col * (cellPx + GAP) + cellPx / 2;
  const y = row * (cellPx + GAP) + cellPx / 2;
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    left: x,
    top: y,
    transform: [{ scale: scale.value }, { translateY: kind === 'gold' ? -10 * (1 - opacity.value) : 0 }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    scale.value = withTiming(kind === 'bomb' ? 9 : 6, { duration: 520 + delay });
    opacity.value = withTiming(0, { duration: 520 + delay });
  }, [delay, kind, opacity, scale]);

  return <Animated.View pointerEvents="none" style={[styles.burst, kind === 'bomb' ? styles.burstBomb : styles.burstGold, style]} />;
}

function cellStyle(
  visual: string,
  bossHere: boolean,
  bossId: BossId,
  door: boolean,
  paint: GridSkinPaint,
  hinted = false,
) {
  const revealed =
    visual === 'empty' ||
    visual === 'number' ||
    visual === 'chest' ||
    visual === 'wrecked' ||
    visual === 'exploded';
  const fill =
    hinted
      ? paint.exploded
      : visual === 'chest'
      ? paint.chest
      : visual === 'wrecked'
        ? paint.wrecked
        : visual === 'exploded'
          ? paint.exploded
          : revealed
            ? paint.revealed
            : paint.hidden;
  return [
    { backgroundColor: fill },
    bossHere && (bossId === 'lust' ? styles.bossLust : styles.boss),
    door && styles.door,
    hinted && styles.mineHint,
  ];
}

function ariaFor(visual: string, n: number, tier: Cell['tier']): string {
  switch (visual) {
    case 'hidden':
      return 'Hidden stone';
    case 'flagged':
    case 'bomb-flagged':
      return 'Flagged';
    case 'empty':
      return 'Clear floor';
    case 'number':
      return `${n} adjacent bombs`;
    case 'chest':
      return tier ? `${tier} chest` : 'Chest';
    case 'wrecked':
      return tier ? `Broken ${tier} chest` : 'Broken chest';
    case 'exploded':
      return 'Detonated bomb';
    default:
      return 'Cell';
  }
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  stage: { position: 'relative' },
  board: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  cell: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boss: { backgroundColor: '#2a1830' },
  bossLust: { backgroundColor: '#2a1218' },
  door: {},
  mineHint: {
    borderWidth: 2,
    borderColor: colors.gold2,
  },
  rune: { fontFamily: fonts.display, fontWeight: '700' },
  bossGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossDead: { transform: [{ rotate: '90deg' }], opacity: 0.88 },
  burst: {
    position: 'absolute',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 4,
  },
  burstBomb: { backgroundColor: '#ffd166' },
  burstGold: { backgroundColor: colors.gold2 },
});
