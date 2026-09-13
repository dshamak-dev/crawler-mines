import { Cinzel_700Bold, Cinzel_900Black, useFonts } from '@expo-google-fonts/cinzel';
import { SourceSans3_400Regular, SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useGameAudio, type AppScreen } from '../src/audio';
import { useNavStackSync } from '../src/nav';
import { useGameStore } from '../src/store';
import { colors } from '../src/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden */
});

function screenFromPath(path: string): AppScreen {
  if (path.includes('play')) return 'play';
  if (path.includes('collection')) return 'collection';
  if (path.includes('shop')) return 'shop';
  return 'menu';
}

function AudioHost() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ from?: string }>();
  const run = useGameStore((s) => s.run);
  const screen = screenFromPath(pathname);
  const collectionFrom: AppScreen = params.from === 'play' ? 'play' : 'menu';
  const { unlock } = useGameAudio(
    screen,
    run?.mode ?? null,
    collectionFrom,
    run?.floor ?? 0,
    run?.game.boss?.id ?? null,
  );
  useEffect(() => {
    unlock();
  }, [unlock]);
  return null;
}

function NavSync() {
  useNavStackSync();
  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Cinzel_700Bold,
    Cinzel_900Black,
    SourceSans3_400Regular,
    SourceSans3_700Bold,
  });

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar style="light" />
          <NavSync />
          <AudioHost />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg, flex: 1, overflow: 'hidden' },
              animation: 'fade',
            }}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
