import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameStore } from '../src/store';
import CollectionScreen from '../src/ui/CollectionScreen';
import Shell from '../src/ui/Shell';

export default function CollectionRoute() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const meta = useGameStore((s) => s.meta);
  const runLoot = useGameStore((s) => s.runLoot);
  const run = useGameStore((s) => s.run);
  const fromPlay = from === 'play' && Boolean(run);

  return (
    <Shell>
      <CollectionScreen
        meta={meta}
        runLoot={runLoot}
        sealed={fromPlay}
        game={fromPlay && run ? run.game : undefined}
        stashGold={run?.campaignStash?.gold ?? 0}
        onBack={() => router.back()}
      />
    </Shell>
  );
}
