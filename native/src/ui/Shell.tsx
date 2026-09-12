import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function Shell({ children, tight }: { children: ReactNode; tight?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= 520;
  const padT = framed ? 0 : insets.top;
  const padB = framed ? 0 : insets.bottom;
  const padL = framed ? 0 : insets.left;
  const padR = framed ? 0 : insets.right;

  const body = (
    <View
      style={[
        styles.shell,
        {
          paddingTop: (tight ? 8 : 10) + padT,
          paddingBottom: (tight ? 0 : 10) + padB,
          paddingLeft: (tight ? 6 : 12) + padL,
          paddingRight: (tight ? 6 : 12) + padR,
        },
      ]}
    >
      {children}
    </View>
  );

  if (!framed) return body;

  return (
    <View style={styles.stage}>
      <View style={[styles.phone, { height: Math.min(844, Math.max(640, height - 48)) }]}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#070504',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  phone: {
    width: 390,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 10,
    borderColor: '#1a1410',
    backgroundColor: colors.bg,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
    position: 'relative',
  },
});
