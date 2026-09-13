import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  backTarget,
  entryFromRouter,
  hydrateWebHistory,
  loadNavStack,
  routerHref,
  saveNavStack,
  syncNavStack,
} from '../../src/engine';
import { keyStore } from './storage';

const isWeb =
  typeof document !== 'undefined' &&
  typeof window !== 'undefined' &&
  typeof window.history?.replaceState === 'function';

/** Once per web document load — restore History under a nested route after refresh. */
if (isWeb) {
  hydrateWebHistory(window.location, window.history, keyStore);
}

export function useNavStackSync() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ from?: string }>();
  useEffect(() => {
    const entry = entryFromRouter(pathname, params.from);
    if (!entry) return;
    saveNavStack(keyStore, syncNavStack(loadNavStack(keyStore), entry));
  }, [pathname, params.from]);
}

export function useSafeBack() {
  const router = useRouter();
  return () => {
    const href = routerHref(backTarget(loadNavStack(keyStore)));
    // After a web refresh Expo's stack is empty even when History exists.
    // Replace the persisted parent so in-app Back still walks toward home.
    // Native keeps router.back() so the real push stack is unchanged.
    if (!isWeb && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(href);
  };
}
