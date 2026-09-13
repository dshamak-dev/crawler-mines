import { describe, expect, it } from 'vitest';
import {
  HOME_ENTRY,
  NAV_KEY,
  backTarget,
  entryFromLocation,
  entryFromRouter,
  fullHref,
  hydrateWebHistory,
  loadNavStack,
  parseNavStack,
  pathHref,
  routerHref,
  saveNavStack,
  splitAppPath,
  stackForCurrent,
  syncNavStack,
  type HistoryLike,
  type KeyStore,
  type NavEntry,
} from '../src/engine';

function memoryStore(seed: Record<string, string> = {}): KeyStore {
  const data = new Map(Object.entries(seed));
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

function fakeHistory(start = '/'): HistoryLike & { hrefs: string[]; state: unknown } {
  const hrefs = [start];
  const api: HistoryLike & { hrefs: string[]; state: unknown } = {
    hrefs,
    state: null,
    replaceState(data, _title, url) {
      api.state = data;
      if (typeof url === 'string') hrefs[hrefs.length - 1] = url;
    },
    pushState(data, _title, url) {
      api.state = data;
      hrefs.push(typeof url === 'string' ? url : hrefs[hrefs.length - 1]);
    },
  };
  return api;
}

describe('nav stack persist', () => {
  it('parses a durable stack and ignores junk', () => {
    expect(parseNavStack(null)).toEqual([]);
    expect(parseNavStack('{')).toEqual([]);
    expect(parseNavStack(JSON.stringify({ v: 2, stack: [{ pathname: '/shop' }] }))).toEqual([]);
    expect(
      parseNavStack(
        JSON.stringify({
          v: 1,
          stack: [{ pathname: '/' }, { pathname: '/nope' }, { pathname: '/collection', params: { from: 'play' } }],
        }),
      ),
    ).toEqual([HOME_ENTRY, { pathname: '/collection', params: { from: 'play' } }]);
  });

  it('syncs toward home and keeps play → collection', () => {
    expect(syncNavStack([], { pathname: '/shop' })).toEqual([HOME_ENTRY, { pathname: '/shop' }]);
    expect(syncNavStack([HOME_ENTRY, { pathname: '/shop' }], HOME_ENTRY)).toEqual([HOME_ENTRY]);
    const play: NavEntry[] = [HOME_ENTRY, { pathname: '/play' }];
    expect(syncNavStack(play, { pathname: '/collection', params: { from: 'play' } })).toEqual([
      HOME_ENTRY,
      { pathname: '/play' },
      { pathname: '/collection', params: { from: 'play' } },
    ]);
    expect(
      syncNavStack(
        [HOME_ENTRY, { pathname: '/play' }, { pathname: '/collection', params: { from: 'play' } }],
        { pathname: '/play' },
      ),
    ).toEqual([HOME_ENTRY, { pathname: '/play' }]);
    expect(syncNavStack([HOME_ENTRY, { pathname: '/collection' }], { pathname: '/shop' })).toEqual([
      HOME_ENTRY,
      { pathname: '/shop' },
    ]);
  });

  it('round-trips through the key store', () => {
    const store = memoryStore();
    const stack: NavEntry[] = [HOME_ENTRY, { pathname: '/collection', params: { from: 'menu' } }];
    saveNavStack(store, stack);
    expect(store.getItem(NAV_KEY)).toContain('/collection');
    expect(loadNavStack(store)).toEqual(stack);
    expect(backTarget(stack)).toEqual(HOME_ENTRY);
    expect(backTarget([HOME_ENTRY])).toEqual(HOME_ENTRY);
    expect(routerHref({ pathname: '/shop' })).toBe('/shop');
    expect(routerHref({ pathname: '/collection', params: { from: 'play' } })).toEqual({
      pathname: '/collection',
      params: { from: 'play' },
    });
  });

  it('reads Expo and browser locations, including the Pages base path', () => {
    expect(splitAppPath('/crawler-mines/collection')).toEqual({
      base: '/crawler-mines',
      route: '/collection',
    });
    expect(splitAppPath('/play')).toEqual({ base: '', route: '/play' });
    expect(entryFromLocation('/crawler-mines/collection', '?from=play')).toEqual({
      pathname: '/collection',
      params: { from: 'play' },
    });
    expect(entryFromRouter('/collection', 'menu')).toEqual({
      pathname: '/collection',
      params: { from: 'menu' },
    });
    expect(fullHref('/crawler-mines', { pathname: '/shop' })).toBe('/crawler-mines/shop');
    expect(pathHref({ pathname: '/collection', params: { from: 'play' } })).toBe('/collection?from=play');
  });

  it('hydrates History under a nested reload so Back can walk home', () => {
    const store = memoryStore();
    saveNavStack(store, [HOME_ENTRY, { pathname: '/play' }, { pathname: '/collection', params: { from: 'play' } }]);
    const history = fakeHistory('/crawler-mines/collection?from=play');
    const stack = hydrateWebHistory(
      { pathname: '/crawler-mines/collection', search: '?from=play' },
      history,
      store,
    );
    expect(stack).toEqual([
      HOME_ENTRY,
      { pathname: '/play' },
      { pathname: '/collection', params: { from: 'play' } },
    ]);
    expect(history.hrefs).toEqual([
      '/crawler-mines',
      '/crawler-mines/play',
      '/crawler-mines/collection?from=play',
    ]);
    expect(hydrateWebHistory({ pathname: '/crawler-mines/collection', search: '?from=play' }, history, store)).toBeNull();
    const empty = memoryStore();
    const again = fakeHistory('/shop');
    expect(stackForCurrent([], { pathname: '/shop' })).toEqual([HOME_ENTRY, { pathname: '/shop' }]);
    expect(hydrateWebHistory({ pathname: '/shop', search: '' }, again, empty)).toEqual([
      HOME_ENTRY,
      { pathname: '/shop' },
    ]);
    expect(again.hrefs).toEqual(['/', '/shop']);
    expect(hydrateWebHistory({ pathname: '/', search: '' }, fakeHistory('/'), empty)).toBeNull();
  });
});
