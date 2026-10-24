import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { playDeny } from '../src/audio';
import { getAudio } from '../src/audio/player';
import { useGuardedRunActions } from '../src/guardRun';
import { useSafeBack } from '../src/nav';
import { useGameStore } from '../src/store';
import AbandonRunSheet from '../src/ui/AbandonRunSheet';
import ShopScreen from '../src/ui/ShopScreen';
import Shell from '../src/ui/Shell';
import type { RitualSlots } from '../../src/engine';

export default function ShopRoute() {
  const router = useRouter();
  const onBack = useSafeBack();
  const run = useGameStore((s) => s.run);
  const meta = useGameStore((s) => s.meta);
  const sellFromShop = useGameStore((s) => s.sell);
  const buyFromShop = useGameStore((s) => s.buy);
  const startRite = useGameStore((s) => s.startRite);

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
      {pending ? (
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
      <ShopScreen
        meta={meta}
        onBack={onBack}
        onSell={(itemId, qty) => sellFromShop(itemId, qty)}
        onBuy={(id, qty) => buyFromShop(id, qty)}
        onUi={() => getAudio().playSfx('ui')}
        onDeny={playDeny}
        onStartRite={tryStartRite}
      />
    </Shell>
  );
}
