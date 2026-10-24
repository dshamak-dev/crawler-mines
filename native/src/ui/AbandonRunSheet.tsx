import { DisplayText, MutedText, Overlay, StoneButton, Tablet } from './primitives';

export default function AbandonRunSheet({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay onBackdrop={onCancel}>
      <Tablet>
        <DisplayText>Abandon current run?</DisplayText>
        <MutedText style={{ marginVertical: 8 }}>
          Progress on this descent will be lost. Stashed campaign loot and socketed offerings are not refunded.
        </MutedText>
        <StoneButton gold onPress={onConfirm} style={{ justifyContent: 'center', marginTop: 8 }}>
          Abandon and continue
        </StoneButton>
        <StoneButton onPress={onCancel} style={{ justifyContent: 'center', marginTop: 8 }}>
          Keep playing
        </StoneButton>
      </Tablet>
    </Overlay>
  );
}
