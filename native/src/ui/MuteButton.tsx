import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { SpeakerIcon } from './icons';
import { StoneButton } from './primitives';

export default function MuteButton({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  const label = muted ? 'Sound off' : 'Sound on';
  return (
    <StoneButton onPress={onToggle} accessibilityLabel={label} style={muted ? styles.muted : undefined}>
      <View style={styles.row}>
        <SpeakerIcon muted={muted} size={26} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.meta}>{muted ? 'Muted' : 'Playing'}</Text>
    </StoneButton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, letterSpacing: 0.8 },
  meta: { fontFamily: fonts.ui, color: colors.muted, fontSize: 14 },
  muted: {},
});
