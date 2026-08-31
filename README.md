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

- **You never lose by tapping a bomb.** Easy / Medium / Hard end when every *non-bomb* cell is revealed. Bombs may stay covered. A **perfect** clear (no exploded mine, no flag on a safe cell, and every mine flagged) awards a stacking bronze / silver / gold medal. If the floor auto-wins with **exactly one** leftover unflagged mine and every other mine is already flagged, that last mine still counts as flagged. Two leftover mines do not. Zero flags is not perfect unless that leftover mine is the only mine on the board. Wrecked chests do not fail perfect. Campaign never grants those medals.
- **Loot is the stakes.** Chests in the 8 cells around a blast become wrecked ash — gone, not collectible. Empty floor and numbers survive.
- **Blasts chain.** If a detonation's 8-neighborhood hits another bomb (even a flagged one), that bomb detonates too, wrecking loot in *its* radius, and so on.
- **First tap is safe.** A mine under your first reveal is relocated.
- Zeros flood-fill like the classic game.
- **Flag** with a ~400ms long-press, or flip the Dig/Flag toggle in the thumb zone. Flagged cells will not explode until you unflag and tap them (a chain from a neighbor still sets them off).

The in-run HUD tracks **found** vs **broken** chests this floor. Inner loot stays sealed until you clear the floor — then surviving chests dump their items on the reward screen and into your pack. Gold pouches empty into a persistent **wallet** (coins), not the salvage list. Wrecked chests give nothing. During play, toasts and tiles show the chest **tier** (wooden / iron / gilded), never the item inside.

Chests roll a named drop (gold pouch, rusty key, torch charm, gem, relic shard, or a rare Hard / Campaign key). Keys, charms, gems, shards, and ticket keys stack in your **collection**. Pouches convert to spendable coins in the same localStorage save. Collection is the first title-menu action (player/wallet row) and also lives on the in-run pack button. Ticket keys sit in inventory, not the wallet.

A mid-floor refresh restores the live board (Zustand + localStorage): sealed chests, found/broken counts, floor, boss id/lives/turn, Lust hearts and plant order, the finale door, campaign stash, and whether this floor already paid out. Inner loot still stays sealed until a successful clear, and that grant cannot fire twice. Reload drops you back on the floor. The title menu is Collection, **Start**, and a mute row; **Resume** appears when a descent is in progress.

**Start** opens a sheet: Easy and Medium are free. Hard 12x16 costs **30 gold** each enter (or a Hard key). Campaign is 5 floors for **100 gold** once per descent. Confirm opens a tablet with two offering wells: socket a **Campaign key** for a free dive (the key is not auto-spent from the Start row), or pay 100 gold. One **boss head** locks floor 5 to that sin instead of an equal roll. Two heads are allowed: two different sins guarantee the remaining boss (Gluttony + Wrath → Lust); two of the same sin exclude that one and roll among the other two. The resolved boss is stored on the run at enter so resume, retry, and floor 5 stay consistent. The tablet names the finale only when exactly one boss remains. Torch charms, cave gems, and relic shards may be socketed and are consumed; they have no extra combat or loot rule yet. Every socketed item burns on confirm — no refund. Medals, rusty keys, Hard keys, gold cups, and gold pouches cannot be socketed. Hard keys drop from rare chests on any difficulty; Campaign keys only on Hard and Campaign (~1% of chests). Keys only land in your pack after a successful extract. Confirm still always shows before gold or a key is burned; cancel spends nothing; no refund if the floor is wrecked.

Campaign loot is **stashed** until you beat the floor-5 boss (**Gluttony**, **Wrath**, or **Lust**) and extract through the door. The finale rolls equally when that floor starts unless offerings already resolved it at enter. Floors 1–4 never name which boss is coming. Kill Gluttony or Wrath with three adjacent-mine hits; Lust has five lives (blast a mine next to him). Lust walks to the highest open number that still has a hidden neighbor and plants a heart overlay that hides that digit (never more hearts than his remaining lives; at cap, planting another removes the oldest FIFO); tapping a heart never removes it (deny). A neighboring mine blast strips hearts and drops them from plant order; a hit drops extras oldest-first to match remaining lives, and death clears every heart. Killing the boss does not end the floor — the corpse stays, and a door is hidden on a random empty zero (not a mine, number, chest, or the spawn; prefer off the spawn ring). When that cell is revealed (including by flood), it shows a door. Tap it to extract if the boss is dead and any safe cell is still hidden; a tablet asks Exit or Keep digging. If the boss is already dead and every non-mine cell is revealed, extract is immediate (loot/head/cup/key, status cleared) without a door tap. Open every safe tile while the boss still lives and the campaign fails — no stash, no head, no cup, no key. The stash dumps on extract, that sin's head trophy always stacks in Collection, and there is a 25% chance of a bonus Hard or Campaign key (50/50 inside that 25%). If every descent floor (1–4) was a perfect clear (same rules, including the last leftover mine), a stacking unsellable **gold cup** trophy is granted with the head. Floor 5 / the boss fight does not need to be perfect. Hard is a normal paid floor with no boss.

Audio (`public/audio/`): **cozy-descent** is the violin loop on the title and Easy/Medium/Hard (quiet violin only ~30–70s, soft edges); campaign-depths on campaign floors 1–4; **flag-eater-boss** loops on the floor-5 Gluttony fight; **wrath-boss** loops when the rolled boss is Wrath; **lust-boss** loops when the rolled boss is Lust. Finale tracks stay up if Collection is opened from that floor, then cozy when you return to the menu. Approved **lust-boss** and violin **cozy-descent** bytes land in a follow-up contents-API commit — do not invent or re-encode them here. Only one BGM loop plays at a time: starting a new track hard-stops every other BGM immediately (no overlapping crossfade). SFX may overlap. BGM and SFX pause when the tab is hidden and resume from the same point when you return (if Sound is on). Mute persists in localStorage. SFX play on dig, flag, chest, blast, wreck, clear, UI, deny, and boss cues (move, eat flag, hit, death, campaign lose).
