import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { playDeny } from '../src/audio';
import { getAudio } from '../src/audio/player';
import { useGuardedRunActions } from '../src/guardRun';
import { useSafeBack } from '../src/nav';
import { useGameStore } from '../src/store';
import AbandonRunSheet from '../src/ui/AbandonRunSheet';
import CollectionScreen from '../src/ui/CollectionScreen';
import Shell from '../src/ui/Shell';
import type { RitualSlots } from '../../src/engine';

export default function CollectionRoute() {
  const router = useRouter();
  const onBack = useSafeBack();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const meta = useGameStore((s) => s.meta);
  const runLoot = useGameStore((s) => s.runLoot);
  const run = useGameStore((s) => s.run);
  const startRite = useGameStore((s) => s.startRite);
  const pickTheme = useGameStore((s) => s.selectTheme);
  const fromPlay = from === 'play' && Boolean(run);

  const beginRite = useCallback(
    (slots: RitualSlots) => {
      const ok = startRite(slots);
      if (ok) router.push('/play');
      return ok;
    },
    [router, startRite],
  );

  const { pending, tryStartRite, confirmAbandon, cancelAbandon } = useGuardedRunActions(
    run,
    () => {},
    beginRite,
  );

  return (
    <Shell>
      {pending && !fromPlay ? (
        <AbandonRunSheet
          onCancel={() => {
            getAudio().playSfx('ui');
            cancelAbandon();
          }}
          onConfirm={() => {
            getAudio().playSfx('ui');
            confirmAbandon();
          }}
        />
      ) : null}
      <CollectionScreen
        meta={meta}
        runLoot={runLoot}
        sealed={fromPlay}
        game={fromPlay && run ? run.game : undefined}
        kit={fromPlay ? run?.kit : undefined}
        stashGold={run?.campaignStash?.gold ?? 0}
        onBack={onBack}
        onStartRite={fromPlay ? undefined : tryStartRite}
        onOpenSecret={
          fromPlay ? undefined : (socketed) => useGameStore.getState().openSecretChest(socketed)
        }
        onSelectTheme={fromPlay ? undefined : pickTheme}
        onUi={() => getAudio().playSfx('ui')}
        onDeny={playDeny}
        onUseTorch={fromPlay ? () => useGameStore.getState().useTorch() : undefined}
      />
    </Shell>
  );
}
