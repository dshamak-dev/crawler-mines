import { useCallback, useState } from 'react';
import type { Difficulty, OfferingSlots, RitualSlots } from '../../src/engine';
import type { Run } from './store';

export type AbandonPending =
  | { kind: 'start'; mode: Difficulty; offerings?: OfferingSlots }
  | { kind: 'rite'; slots: RitualSlots };

export function runNeedsAbandonConfirm(run: Run | null): boolean {
  return run != null;
}

export function useGuardedRunActions(
  run: Run | null,
  onStart: (mode: Difficulty, offerings?: OfferingSlots) => void,
  onStartRite: (slots: RitualSlots) => boolean,
) {
  const [pending, setPending] = useState<AbandonPending | null>(null);

  const tryStart = useCallback(
    (mode: Difficulty, offerings?: OfferingSlots) => {
      if (runNeedsAbandonConfirm(run)) {
        setPending({ kind: 'start', mode, offerings });
        return;
      }
      onStart(mode, offerings);
    },
    [run, onStart],
  );

  const tryStartRite = useCallback(
    (slots: RitualSlots): boolean => {
      if (runNeedsAbandonConfirm(run)) {
        setPending({ kind: 'rite', slots });
        return false;
      }
      return onStartRite(slots);
    },
    [run, onStartRite],
  );

  const confirmAbandon = useCallback(() => {
    if (!pending) return;
    const next = pending;
    setPending(null);
    if (next.kind === 'start') onStart(next.mode, next.offerings);
    else onStartRite(next.slots);
  }, [pending, onStart, onStartRite]);

  const cancelAbandon = useCallback(() => setPending(null), []);

  return { pending, tryStart, tryStartRite, confirmAbandon, cancelAbandon };
}
