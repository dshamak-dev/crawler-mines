import { useRouter } from 'expo-router';
import { playDeny } from '../src/audio';
import { getAudio } from '../src/audio/player';
import { useSafeBack } from '../src/nav';
import { useGameStore } from '../src/store';
import ShopScreen from '../src/ui/ShopScreen';
import Shell from '../src/ui/Shell';

export default function ShopRoute() {
  const router = useRouter();
  const onBack = useSafeBack();
  const meta = useGameStore((s) => s.meta);
  const sellFromShop = useGameStore((s) => s.sell);
  const buyFromShop = useGameStore((s) => s.buy);
  const startRite = useGameStore((s) => s.startRite);

  return (
    <Shell>
      <ShopScreen
        meta={meta}
        onBack={onBack}
        onSell={(itemId, qty) => sellFromShop(itemId, qty)}
        onBuy={(id, qty) => buyFromShop(id, qty)}
        onUi={() => getAudio().playSfx('ui')}
        onDeny={playDeny}
        onStartRite={(slots) => {
          const ok = startRite(slots);
          if (ok) router.push('/play');
          return ok;
        }}
      />
    </Shell>
  );
}
