import { StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '../theme';
import { SpeakerIcon } from './icons';
import { StoneButton } from './primitives';

export default function MuteButton({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const label = muted ? 'Sound off' : 'Sound on';
  return (
    <StoneButton onPress={onToggle} accessibilityLabel={label} style={muted ? styles.muted : undefined}>
      <View style={styles.row}>
        <SpeakerIcon muted={muted} size={26} />
        <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      </View>
      <Text style={[styles.meta, { color: t.muted }]}>{muted ? 'Muted' : 'Playing'}</Text>
    </StoneButton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 0.8 },
  meta: { fontFamily: fonts.ui, fontSize: 14 },
  muted: {},
});
