# Crawler Mines

Dungeon-crawler minesweeper for phones. Bombs do **not** end the run — they detonate in place, wreck nearby treasure, and **chain** into neighboring bombs.

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

Score is gold from chests you opened *before* they were destroyed. After a floor: gold earned vs gold destroyed.

Difficulties: Easy 8x8, Medium 9x12, Hard 12x16, plus a 5-floor campaign with rising mine density and more chests.
