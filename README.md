# Crawler Mines

Dungeon-crawler minesweeper for phones. Bombs do **not** end the run — they detonate in place, wreck nearby treasure, and **chain** into neighboring bombs.

## Play it

[https://dshamak-dev.github.io/crawler-mines/](https://dshamak-dev.github.io/crawler-mines/)

That URL is the **Expo web** client (`native/`). After merge, GitHub Pages deploys `npx expo export --platform web` with base path `/crawler-mines/` — not the old Vite app (removed).

In the repo **Settings → Pages**, set Source to **GitHub Actions** (not Deploy from a branch / master / root).

## Run

The product is Expo:

```bash
cd native
npm i          # or: rm -rf node_modules && pnpm i
npx expo start
```

Then scan the QR code with Expo Go, or press `i` / `a` for a simulator. `npx expo start --web` is a local preview of the same client Pages deploys.

```bash
# from repo root — shared engine + store tests (vitest)
npm test
```

Shared rules live in `src/engine` and `src/store`. Metro `watchFolders` imports them from `native/`. The legacy Vite web app (`index.html`, `src/ui`, HTMLAudio `src/audio`) has been deleted.

Storage prefers `react-native-mmkv` on a native build. Expo Go / web fall back to Expo’s sync SQLite kv-store or `localStorage`.

See [native/README.md](native/README.md) for stack notes.

## How to play (the twist)

Classic minesweeper kills you when you click a mine. Here the mine explodes where it sits:

- **You never lose by tapping a bomb.** Easy / Medium / Hard end when every *non-bomb* cell is revealed. Bombs may stay covered. A **perfect** clear (no exploded mine, no flag on a safe cell, and every mine flagged) awards a stacking bronze / silver / gold medal. If the floor auto-wins with **exactly one** leftover unflagged mine and every other mine is already flagged, that last mine still counts as flagged. Two leftover mines do not. Zero flags is not perfect unless that leftover mine is the only mine on the board. Wrecked chests do not fail perfect. Campaign never grants those medals.
- **Loot is the stakes.** Chests in the 8 cells around a blast become wrecked ash — gone, not collectible. Empty floor and numbers survive.
- **Blasts chain.** If a detonation's 8-neighborhood hits another bomb (even a flagged one), that bomb detonates too, wrecking loot in *its* radius, and so on.
- **First tap is safe.** A mine under your first reveal is relocated.
- Zeros flood-fill like the classic game.
- **Flag** with a ~400ms long-press, or flip the Dig/Flag toggle in the thumb zone. Flagged cells will not explode until you unflag and tap them (a chain from a neighbor still sets them off).

The in-run HUD tracks **found** vs **broken** chests this floor (hidden on arena floors — Campaign floor 5 and the boss rite — which show **Fight** / **Exit** instead). Inner loot stays sealed until you clear the floor — then surviving chests dump their items on the reward screen and into your pack. Gold pouches empty into a persistent **wallet** (coins), not the salvage list. Wrecked chests give nothing. During play, toasts and tiles show the chest **tier** (wooden / iron / gilded), never the item inside.

Chests roll a named drop (gold pouch, rusty key, torch charm, gem, relic shard, or a rare Hard / Campaign key). Keys, charms, gems, shards, and ticket keys stack in your **collection**. Pouches convert to spendable coins in the same localStorage save. Collection is the first title-menu action (player/wallet row) and also lives on the in-run pack button. Ticket keys sit in inventory, not the wallet.

A mid-floor refresh restores the live board (Zustand + localStorage): sealed chests, found/broken counts, floor, boss id/lives/turn, Lust hearts and plant order, the finale door, campaign stash, and whether this floor already paid out. Inner loot still stays sealed until a successful clear, and that grant cannot fire twice. Reload drops you back on the floor. The title menu is Collection (**Items** | **Skins**), **Start**, **Shop** (Sell | Buy; bone dust 50, witchcraft bag 150, scroll of portal 80, golden/pirate flags 500, classic/vintage grids 1000), and a mute row; **Resume** appears when a descent is in progress. Collection Skins selects the active flag glyph and grid look. Defaults (red flag, gray grid) are always owned. In-run collection lists sealed this-run treasure plus carried kit that stays available mid-run (torch charms socketed as Hard/Campaign offerings — count equals how many were socketed, not the leftover bank stack). Unoffered bank charms stay in Collection and cannot be **Use**d during a live run. Easy/Medium have no offering wells, so they get no torch kit from the pack. **Use** a torch charm from that kit to highlight two random closed mines for **3 seconds** (visual only — it does not reveal or flag, and it consumes one kit torch when at least one closed mine is hinted). If fewer than two closed mines remain, it hints as many as exist. Zero closed mines, or no kit torch, is a deny and does not consume. Cave gems stay shop sell-only. Sealed chest loot stays sealed as before. A witchcraft bag in Collection **Use**s a 3-slot ritual: portal scroll + bone dust + one boss head starts a free one-floor boss rite (Campaign floor-5 arena, 0 chests). Title Collection **Use** never burns bank torches while a run is live.

**Start** opens a sheet: Easy and Medium are free. Hard 12x16 costs **30 gold** each enter, or socket a **Hard key** for a free dive. Campaign is 5 floors for **100 gold** once per descent, or socket a **Campaign key**. Both paid modes open the same tablet with two offering wells: socket from the pack, confirm burns sockets, cancel spends nothing. A key is not auto-spent from the Start row. Campaign key does not pay for Hard; Hard key does not pay for Campaign. One **boss head** on Campaign locks floor 5 to that sin instead of an equal roll. Two heads are allowed: two different sins guarantee the remaining boss (Gluttony + Wrath → Lust); two of the same sin exclude that one and roll among the other two. The resolved boss is stored on the run at enter so resume, retry, and floor 5 stay consistent. The tablet names the finale only when exactly one boss remains. Hard offerings accept torch charms, cave gems, relic shards, and a Hard key — **no boss heads** (heads are Campaign finale locks only). Socketed torch charms leave the bank and move into the this-run kit (one per well) for in-run **Use** (two closed-mine hints for 3s). Cave gems and relic shards still burn on enter with no in-run Use. A socketed Hard or Campaign key is still consume-on-enter payment. Unused kit torches do not return to the bank. Cave gems stay shop sell-only — no in-run Use. Relic shards have no extra combat rule yet. Socketed keys, heads, gems, and shards burn on confirm — no refund. Medals, rusty keys, gold cups, and gold pouches cannot be socketed. Hard keys drop from rare chests on any difficulty; Campaign keys only on Hard and Campaign (~1% of chests). Keys only land in your pack after a successful extract. Confirm still always shows before gold or a key is burned; no refund if the floor is wrecked.

Campaign loot is **stashed** until you beat the floor-5 boss (**Gluttony**, **Wrath**, or **Lust**) and extract through the door. Floor 5 is an **arena** (same layout as the witchcraft-bag rite): **0 chests**, no salvage this floor; the head / gold cup / bonus key still grant on a successful extract. The finale rolls equally when that floor starts unless offerings already resolved it at enter. Floors 1–4 never name which boss is coming. Kill Gluttony or Wrath with three adjacent-mine hits; Lust has five lives (blast a mine next to him). Lust walks to the highest open number that still has a hidden neighbor and plants a heart overlay that hides that digit (never more hearts than his remaining lives; at cap, planting another removes the oldest FIFO); tapping a heart never removes it (deny). A neighboring mine blast strips hearts and drops them from plant order; a hit drops extras oldest-first to match remaining lives, and death clears every heart. Killing the boss does not end the floor — the corpse stays, and a door is hidden on a random empty tile (not a mine, chest, or the spawn; prefer off the spawn ring). Generated arena doors prefer a **number** so a mine can sit in the door's 8-ring. When that cell is revealed (including by flood), it shows a door. Tap it to extract if the boss is dead and any safe cell is still hidden; a tablet asks Exit or Keep digging. If the boss is already dead and every non-mine cell is revealed, extract is immediate (loot/head/cup/key, status cleared) without a door tap — **only if the door is still intact**. A mine blast in the door's 8-ring **wrecks** the exit (wreck + blast SFX, door ash) and the campaign is **lost immediately**, boss alive or dead. Open every safe tile while the boss still lives and the campaign fails — no stash, no head, no cup, no key. The stash dumps on extract, that sin's head trophy always stacks in Collection, and there is a 25% chance of a bonus Hard or Campaign key (50/50 inside that 25%). If every descent floor (1–4) was a perfect clear (same rules, including the last leftover mine), a stacking unsellable **gold cup** trophy is granted with the head. Floor 5 / the boss fight does not need to be perfect. Hard is a normal paid floor with no boss.

Audio (`native/assets/audio/`): **cozy-descent** is the violin loop on the title and Easy/Medium/Hard (quiet violin only ~30–70s, soft edges); campaign-depths on campaign floors 1–4; **flag-eater-boss** loops on the floor-5 Gluttony fight; **wrath-boss** loops when the rolled boss is Wrath; **lust-boss** loops when the rolled boss is Lust. Finale tracks stay up if Collection is opened from that floor, then cozy when you return to the menu. Do not invent or re-encode these bytes. Only one BGM loop plays at a time: starting a new track hard-stops every other BGM immediately (no overlapping crossfade). SFX may overlap. BGM and SFX pause when the tab is hidden and resume from the same point when you return (if Sound is on). Mute persists. SFX play on dig, flag, chest, blast, wreck, clear, UI, deny, and boss cues (move, eat flag, hit, death, campaign lose).
