# Crawler Mines — native (Expo)

Phone client for the same dungeon-crawler minesweeper as the Vite web app at the repo root. **Do not move or replace the web product.** Pages still deploys from root `npm run build`.

## Run

```bash
cd native
npm i
npx expo start
```

| Command | What |
| --- | --- |
| `npx expo start` | Metro + Expo Go / dev client |
| `npx expo start --web` | Browser smoke test |
| `npx expo start --ios` / `--android` | Simulator (needs Xcode / Android SDK) |

Web stays at the repo root:

```bash
cd ..
npm i && npm run dev    # Vite
npm test && npm run build
```

## Stack

- Expo SDK 57 + Expo Router (`app/` routes: title, play, collection, shop)
- Zustand store factory from `../src/store/gameStore.ts` with a native `KeyStore`
- Sync persist: **MMKV** on a native build; **expo-sqlite/kv-store** (Expo Go) or `localStorage` (web)
- `expo-av` for exclusive BGM + SFX (same `public/audio/*` bytes, copied into `assets/audio/`)
- `react-native-svg` icons ported from `src/ui/icons.tsx`
- Gesture Handler long-press (400ms) + Reanimated board FX

## Shared engine

Metro `watchFolders` points at `../src/engine` and `../src/store` so rules stay identical to web. Native `node_modules` is isolated (`disableHierarchicalLookup`) so Vite’s React does not leak in.

**Follow-up:** if Metro packaging of the parent `src/` folders becomes painful, copy `src/engine` (and the store helpers) into `native/` and unify later. Do not invent gameplay in either copy.

## Audio

Files in `native/assets/audio/` are byte copies of `../public/audio/`. Do not invent or re-encode them.
