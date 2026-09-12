import { useRouter } from 'expo-router';
import { playDeny } from '../src/audio';
import { getAudio } from '../src/audio/player';
import { useMuteStore } from '../src/mute';
import { resumeLabel, useGameStore } from '../src/store';
import TitleMenu from '../src/ui/TitleMenu';
import Shell from '../src/ui/Shell';
import type { Difficulty, OfferingSlots } from '../../src/engine';

export default function TitleRoute() {
  const router = useRouter();
  const run = useGameStore((s) => s.run);
  const meta = useGameStore((s) => s.meta);
  const startRun = useGameStore((s) => s.start);
  const muted = useMuteStore((s) => s.muted);
  const toggleMuted = useMuteStore((s) => s.toggle);

  const start = (mode: Difficulty, offerings?: OfferingSlots) => {
    const ok = startRun(mode, undefined, offerings);
    if (!ok) {
      playDeny();
      return;
    }
    router.push('/play');
  };

  return (
    <Shell>
      <TitleMenu
        onStart={start}
        onResume={run ? () => router.push('/play') : undefined}
        resumeCopy={run ? resumeLabel(run) : null}
        onCollection={() => router.push({ pathname: '/collection', params: { from: 'menu' } })}
        onShop={() => router.push('/shop')}
        gold={meta.gold}
        meta={meta}
        muted={muted}
        onToggleMute={toggleMuted}
        onUi={() => getAudio().playSfx('ui')}
        onDeny={playDeny}
      />
    </Shell>
  );
}
