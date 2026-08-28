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

Chests roll a named drop (gold pouch, rusty key, torch charm, gem, or relic shard). Keys, charms, gems, and shards stack in your **collection**. Pouches convert to spendable coins in the same localStorage save. Collection is the first title-menu action (player/wallet row) and also lives on the in-run pack button.

A mid-floor refresh restores the live board (Zustand + localStorage): sealed chests, found/broken counts, floor, and whether this floor already paid out. Inner loot still stays sealed until a successful clear, and that grant cannot fire twice. The title menu offers **Resume** if you leave a run; a reload drops you back on the floor.

Difficulties: Easy 8x8, Medium 9x12, Hard 12x16, plus a 5-floor campaign with rising mine density and more chests.
