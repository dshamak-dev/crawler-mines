import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useMuteStore } from '../src/mute';
import { useGameStore } from '../src/store';
import PlayScreen from '../src/ui/PlayScreen';
import Shell from '../src/ui/Shell';

export default function PlayRoute() {
  const router = useRouter();
  const run = useGameStore((s) => s.run);
  const muted = useMuteStore((s) => s.muted);
  const toggleMuted = useMuteStore((s) => s.toggle);

  useEffect(() => {
    if (!run) router.replace('/');
  }, [run, router]);

  if (!run) return null;

  return (
    <Shell tight>
      <PlayScreen
        muted={muted}
        onToggleMute={toggleMuted}
        onCollection={() => router.push({ pathname: '/collection', params: { from: 'play' } })}
        onExitRun={() => router.replace('/')}
      />
    </Shell>
  );
}
