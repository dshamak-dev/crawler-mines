# Crawler Mines

Dungeon-crawler minesweeper for phones. Bombs do **not** end the run — they detonate in place, wreck nearby treasure, and **chain** into neighboring bombs.

## Play it

[https://dshamak-dev.github.io/crawler-mines/](https://dshamak-dev.github.io/crawler-mines/)

In the repo **Settings → Pages**, set Source to **GitHub Actions** (not Deploy from a branch / master / root). Master/root cannot host both the Vite source and the built site.

## Run

```bash
npm i && npm run dev
```

Then open the printed local URL on a phone or a ~390x844 viewport.

```bash
npm test    # engine unit tests (vitest)
npm run build
```

## How to play (the twist)

Classic minesweeper kills you when you click a mine. Here the mine explodes where it sits:

- **You never lose by tapping a bomb.** The floor ends when every *non-bomb* cell is revealed. Bombs may stay covered.
- **Loot is the stakes.** Chests in the 8 cells around a blast become wrecked ash — gone, not collectible. Empty floor and numbers survive.
- **Blasts chain.** If a detonation's 8-neighborhood hits another bomb (even a flagged one), that bomb detonates too, wrecking loot in *its* radius, and so on.
- **First tap is safe.** A mine under your first reveal is relocated.
- Zeros flood-fill like the classic game.
- **Flag** with a ~400ms long-press, or flip the Dig/Flag toggle in the thumb zone. Flagged cells will not explode until you unflag and tap them (a chain from a neighbor still sets them off).

The in-run HUD tracks **found** vs **broken** chests this floor. Inner loot stays sealed until you clear the floor — then surviving chests dump their items on the reward screen and into your pack. Gold pouches empty into a persistent **wallet** (coins), not the salvage list. Wrecked chests give nothing. During play, toasts and tiles show the chest **tier** (wooden / iron / gilded), never the item inside.

Chests roll a named drop (gold pouch, rusty key, torch charm, gem, relic shard, or a rare Hard / Campaign key). Keys, charms, gems, shards, and ticket keys stack in your **collection**. Pouches convert to spendable coins in the same localStorage save. Collection is the first title-menu action (player/wallet row) and also lives on the in-run pack button. Ticket keys sit in inventory, not the wallet.

A mid-floor refresh restores the live board (Zustand + localStorage): sealed chests, found/broken counts, floor, and whether this floor already paid out. Inner loot still stays sealed until a successful clear, and that grant cannot fire twice. Reload drops you back on the floor. The title menu is Collection, **Start**, and **Sound** at the bottom; **Resume** appears when a descent is in progress.

**Start** opens a sheet: Easy and Medium are free. Hard 12x16 costs **30 gold** each enter (or a Hard key). Campaign is 5 floors for **100 gold** once per descent (or a Campaign key). Keys drop from rare chests and only land in your pack after a successful extract. Confirm before gold or a key is burned; cancel spends nothing; no refund if the floor is wrecked.

Audio (`public/audio/`): cozy-descent loops on the title and Easy / Medium / Hard. campaign-depths plays only while a Campaign floor is active (including Collection opened from that floor). Mute persists in localStorage (`crawler-mines-audio`). SFX play on dig, flag, chest, blast, wreck, clear, UI, and deny (short gold/key). First tap unlocks playback (iOS). Paths use `import.meta.env.BASE_URL` so GitHub Pages (`/crawler-mines/`) works.
