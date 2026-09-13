import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts } from '../theme';

export function StoneButton({
  children,
  onPress,
  gold,
  locked,
  style,
  textStyle,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  gold?: boolean;
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        stone.btn,
        gold && stone.gold,
        (locked || disabled) && stone.locked,
        pressed && !locked && !disabled && stone.pressed,
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[stone.label, gold && stone.goldLabel, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function GhostButton({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[stone.ghost, style]}
    >
      {children}
    </Pressable>
  );
}

export function Overlay({
  children,
  onBackdrop,
}: {
  children: ReactNode;
  onBackdrop?: () => void;
}) {
  return (
    <View style={stone.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} />
      {children}
    </View>
  );
}

export function Tablet({
  children,
  style,
  wide,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  wide?: boolean;
}) {
  return (
    <View style={[stone.tablet, wide && stone.tabletWide, style]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={stone.tabletInner}
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function DisplayText({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[stone.display, style]}>{children}</Text>;
}

export function MutedText({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[stone.muted, style]}>{children}</Text>;
}

export const stone = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.stoneHi,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.stoneLo,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  gold: {
    borderColor: colors.goldBorder,
    backgroundColor: '#6b4e1e',
  },
  locked: { opacity: 0.58 },
  pressed: { transform: [{ translateY: 2 }] },
  label: {
    fontFamily: fonts.display,
    letterSpacing: 0.8,
    fontSize: 17,
    color: colors.ink,
    flexShrink: 1,
  },
  goldLabel: { color: colors.gold2 },
  ghost: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 6, 5, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 8,
  },
  tablet: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '88%',
    backgroundColor: '#241e1a',
    borderWidth: 1,
    borderColor: '#6b5340',
    borderRadius: 18,
    overflow: 'hidden',
  },
  tabletWide: { maxWidth: 340 },
  tabletInner: {
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  display: {
    fontFamily: fonts.displayBlack,
    color: colors.gold2,
    fontSize: 20,
    letterSpacing: 1,
    textAlign: 'center',
  },
  muted: {
    fontFamily: fonts.ui,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
