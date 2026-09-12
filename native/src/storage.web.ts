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

export const keyStore: KeyStore = tryLocalStorage() ?? memoryStore();
