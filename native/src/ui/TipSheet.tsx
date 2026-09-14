import { StyleSheet } from 'react-native';
import type { TipDef } from '../../../src/engine';
import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export default function TipSheet({
  tip,
  onDismiss,
  onUi,
}: {
  tip: TipDef;
  onDismiss: () => void;
  onUi?: () => void;
}) {
  const go = () => {
    onUi?.();
    onDismiss();
  };
  return (
    <Overlay onBackdrop={go}>
      <Tablet>
        <DisplayText>{tip.title}</DisplayText>
        <MutedText style={styles.pad}>{tip.body}</MutedText>
        <StoneButton gold onPress={go} style={styles.center} accessibilityLabel="I understand">
          I understand
        </StoneButton>
      </Tablet>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  pad: { marginVertical: 8 },
  center: { justifyContent: 'center' },
});
