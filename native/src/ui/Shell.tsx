import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function Shell({ children, tight }: { children: ReactNode; tight?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: (tight ? 8 : 10) + insets.top,
          paddingBottom: (tight ? 0 : 10) + insets.bottom,
          paddingLeft: (tight ? 6 : 12) + insets.left,
          paddingRight: (tight ? 6 : 12) + insets.right,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
