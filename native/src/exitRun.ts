import { useRouter } from 'expo-router';

/** Leave play without stacking duplicate title routes on the navigation stack. */
export function exitToTitle(router: ReturnType<typeof useRouter>): void {
  if ('dismissTo' in router && typeof router.dismissTo === 'function') {
    router.dismissTo('/');
    return;
  }
  router.replace('/');
}
