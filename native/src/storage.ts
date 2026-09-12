import { Platform } from 'react-native';
import type { KeyStore } from '../../src/engine';

function memoryStore(): KeyStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function tryMmkv(): KeyStore | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id: 'crawler-mines' });
    return {
      getItem: (key) => mmkv.getString(key) ?? null,
      setItem: (key, value) => {
        mmkv.set(key, value);
      },
      removeItem: (key) => {
        mmkv.remove(key);
      },
    };
  } catch {
    return null;
  }
}

function trySqlite(): KeyStore | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Storage } = require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store');
    return {
      getItem: (key) => Storage.getItemSync(key),
      setItem: (key, value) => {
        Storage.setItemSync(key, value);
      },
      removeItem: (key) => {
        Storage.removeItemSync(key);
      },
    };
  } catch {
    return null;
  }
}

function tryLocalStorage(): KeyStore | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        localStorage.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}

/**
 * Sync KeyStore: MMKV on a native dev/prod build, Expo SQLite kv-store in
 * Expo Go, localStorage on web, memory last.
 */
export function createNativeKeyStore(): KeyStore {
  return tryMmkv() ?? trySqlite() ?? tryLocalStorage() ?? memoryStore();
}

export const keyStore = createNativeKeyStore();
