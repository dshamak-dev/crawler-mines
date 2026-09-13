import type { KeyStore } from './collection';

export const NAV_KEY = 'crawler-mines-nav';

export const APP_PATHS = ['/', '/play', '/collection', '/shop'] as const;
export type AppPath = (typeof APP_PATHS)[number];

export interface NavEntry {
  pathname: AppPath;
  params?: { from?: string };
}

export interface NavSnapshot {
  v: 1;
  stack: NavEntry[];
}

export const HOME_ENTRY: NavEntry = { pathname: '/' };

const APP_PATH_SET = new Set<string>(APP_PATHS);
const NESTED: readonly AppPath[] = ['/play', '/collection', '/shop'];

export function isAppPath(value: unknown): value is AppPath {
  return typeof value === 'string' && APP_PATH_SET.has(value);
}

/** Split a browser pathname that may include `/crawler-mines` into base + app route. */
export function splitAppPath(pathname: string): { base: string; route: AppPath } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const route of NESTED) {
    if (clean === route || clean.endsWith(route)) {
      return { base: clean.slice(0, clean.length - route.length), route };
    }
  }
  return { base: clean === '/' ? '' : clean, route: '/' };
}

export function parseSearchFrom(search: string): string | undefined {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const from = params.get('from');
  return from === 'play' || from === 'menu' ? from : undefined;
}

export function entryFromLocation(pathname: string, search = ''): NavEntry {
  const { route } = splitAppPath(pathname);
  if (route === '/collection') {
    const from = parseSearchFrom(search);
    return from ? { pathname: route, params: { from } } : { pathname: route };
  }
  return { pathname: route };
}

export function entryFromRouter(pathname: string, from?: string | string[]): NavEntry | null {
  const { route } = splitAppPath(pathname);
  if (!isAppPath(route)) return null;
  if (route === '/collection') {
    const value = Array.isArray(from) ? from[0] : from;
    if (value === 'play' || value === 'menu') return { pathname: route, params: { from: value } };
  }
  return { pathname: route };
}

export function sameEntry(a: NavEntry, b: NavEntry): boolean {
  return a.pathname === b.pathname && (a.params?.from ?? '') === (b.params?.from ?? '');
}

export function parseNavStack(raw: string | null | undefined): NavEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<NavSnapshot>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.stack)) return [];
    const stack: NavEntry[] = [];
    for (const row of parsed.stack) {
      if (!row || !isAppPath(row.pathname)) continue;
      if (row.pathname === '/collection' && (row.params?.from === 'play' || row.params?.from === 'menu')) {
        stack.push({ pathname: '/collection', params: { from: row.params.from } });
      } else {
        stack.push({ pathname: row.pathname });
      }
    }
    return stack;
  } catch {
    return [];
  }
}

export function loadNavStack(store: KeyStore): NavEntry[] {
  return parseNavStack(store.getItem(NAV_KEY));
}

export function saveNavStack(store: KeyStore, stack: NavEntry[]): void {
  const snapshot: NavSnapshot = { v: 1, stack };
  store.setItem(NAV_KEY, JSON.stringify(snapshot));
}

/** Keep a short stack rooted at home so Back after a refresh can walk toward `/`. */
export function syncNavStack(prev: NavEntry[], current: NavEntry): NavEntry[] {
  if (current.pathname === '/') return [HOME_ENTRY];
  const idx = prev.findIndex((entry) => sameEntry(entry, current));
  if (idx >= 0) {
    const truncated = prev.slice(0, idx + 1);
    return truncated[0] && truncated[0].pathname === '/' ? truncated : [HOME_ENTRY, ...truncated];
  }
  const last = prev[prev.length - 1];
  if (last?.pathname === '/play' && current.pathname === '/collection' && current.params?.from === 'play') {
    const rooted = prev[0]?.pathname === '/' ? prev : [HOME_ENTRY, ...prev];
    return [...rooted, current];
  }
  return [HOME_ENTRY, current];
}

export function stackForCurrent(stored: NavEntry[], current: NavEntry): NavEntry[] {
  const synced = syncNavStack(stored, current);
  if (synced.length >= 2 && sameEntry(synced[synced.length - 1], current)) return synced;
  if (current.pathname === '/collection' && current.params?.from === 'play') {
    return [HOME_ENTRY, { pathname: '/play' }, current];
  }
  if (current.pathname === '/') return [HOME_ENTRY];
  return [HOME_ENTRY, current];
}

export function backTarget(stack: NavEntry[]): NavEntry {
  if (stack.length >= 2) return stack[stack.length - 2];
  return HOME_ENTRY;
}

export function routerHref(entry: NavEntry): '/' | '/play' | '/shop' | { pathname: '/collection'; params?: { from: string } } {
  if (entry.pathname === '/collection') {
    return entry.params?.from
      ? { pathname: '/collection', params: { from: entry.params.from } }
      : { pathname: '/collection' };
  }
  return entry.pathname;
}

export function pathHref(entry: NavEntry): string {
  if (entry.pathname === '/collection' && entry.params?.from) {
    return `/collection?from=${entry.params.from}`;
  }
  return entry.pathname;
}

export function fullHref(base: string, entry: NavEntry): string {
  const path = pathHref(entry);
  if (path === '/') return base || '/';
  return `${base}${path}`;
}

export const NAV_HYDRATE_FLAG = 1;

export function isNavHydrateState(state: unknown): boolean {
  return Boolean(
    state &&
      typeof state === 'object' &&
      (state as { crawlerNav?: unknown }).crawlerNav === NAV_HYDRATE_FLAG,
  );
}

export interface HistoryLike {
  state: unknown;
  replaceState(data: unknown, unused: string, url?: string | null): void;
  pushState(data: unknown, unused: string, url?: string | null): void;
}

/**
 * Rebuild enough History entries under the current nested route that browser Back
 * can walk toward home after a reload. No-op when already hydrated or on `/`.
 */
export function hydrateWebHistory(
  loc: { pathname: string; search: string },
  history: HistoryLike,
  store: KeyStore,
): NavEntry[] | null {
  const current = entryFromLocation(loc.pathname, loc.search);
  if (current.pathname === '/') return null;
  if (isNavHydrateState(history.state)) return null;
  const stack = stackForCurrent(loadNavStack(store), current);
  if (stack.length < 2) return null;
  const { base } = splitAppPath(loc.pathname);
  const currentHref = `${loc.pathname}${loc.search}`;
  const state = { crawlerNav: NAV_HYDRATE_FLAG };
  for (let i = 0; i < stack.length; i += 1) {
    const href = i === stack.length - 1 ? currentHref : fullHref(base, stack[i]);
    if (i === 0) history.replaceState(state, '', href);
    else history.pushState(state, '', href);
  }
  saveNavStack(store, stack);
  return stack;
}
