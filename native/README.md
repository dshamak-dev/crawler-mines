# Crawler Mines — native (Expo)

This is the product. GitHub Pages deploys the Expo web export from this folder (`npx expo export --platform web`, base path `/crawler-mines/`). The old root Vite app has been removed.

## Run

```bash
cd native
npm i          # or: pnpm i
npx expo start
```

`native/.npmrc` hoists Expo packages so pnpm does not hide `@expo/metro-runtime`. Metro also maps that peer from the `.pnpm` store, so `pnpm start` works even with an isolated linker. After pulling, reinstall once: `rm -rf node_modules && pnpm i`.

| Command | What |
| --- | --- |
| `npx expo start` | Metro + Expo Go / dev client |
| `npx expo start --web` | Same client Pages deploys (local preview) |
| `npx expo export --platform web` | Production web bundle → `native/dist` |
| `npx expo start --ios` / `--android` | Simulator (needs Xcode / Android SDK) |

Shared engine tests stay at the repo root:

```bash
cd ..
npm i && npm test
```

## Stack

- Expo SDK 57 + Expo Router (`app/` routes: title, play, collection, shop)
- Zustand store factory from `../src/store/gameStore.ts` with a native `KeyStore`
- Sync persist: **MMKV** on a native build; **expo-sqlite/kv-store** (Expo Go) or `localStorage` (web)
- `expo-audio` for exclusive BGM + SFX (`assets/audio/`). `expo-av` is not in Expo Go.
- `react-native-svg` icons
- Gesture Handler long-press (400ms) + Reanimated board FX

## Shared engine

Metro `watchFolders` points at `../src/engine` and `../src/store` so rules stay identical. The root `node_modules` (vitest / zustand test deps) is on Metro’s block list so its React does not leak in. `@expo/metro-runtime` is a direct dependency and is also mapped in `metro.config.js` for isolated pnpm.

**Follow-up:** if Metro packaging of the parent `src/` folders becomes painful, copy `src/engine` (and the store helpers) into `native/` and unify later. Do not invent gameplay in either copy.

## Audio

Files in `native/assets/audio/` are the approved loops and SFX. Do not invent or re-encode them.
