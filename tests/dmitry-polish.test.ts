import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Dmitry polish wiring', () => {
  const title = readFileSync(resolve(__dirname, '../native/src/ui/TitleMenu.tsx'), 'utf8');
  const play = readFileSync(resolve(__dirname, '../native/src/ui/PlayScreen.tsx'), 'utf8');
  const board = readFileSync(resolve(__dirname, '../native/src/ui/Board.tsx'), 'utf8');
  const layout = readFileSync(resolve(__dirname, '../native/app/_layout.tsx'), 'utf8');
  const collection = readFileSync(resolve(__dirname, '../native/app/collection.tsx'), 'utf8');
  const shop = readFileSync(resolve(__dirname, '../native/app/shop.tsx'), 'utf8');
  const nav = readFileSync(resolve(__dirname, '../native/src/nav.ts'), 'utf8');

  it('orders the title menu Resume → Start → Collection → Shop → Sounds', () => {
    const block = title.slice(title.indexOf('style={styles.nav}'));
    const resume = block.indexOf('Resume');
    const start = block.indexOf('style={styles.cta}');
    const collectionBtn = block.indexOf('>Collection<');
    const shopBtn = block.indexOf('<ScalesIcon');
    const sound = block.indexOf('<MuteButton');
    expect(resume).toBeGreaterThan(-1);
    expect(resume).toBeLessThan(start);
    expect(start).toBeLessThan(collectionBtn);
    expect(collectionBtn).toBeLessThan(shopBtn);
    expect(shopBtn).toBeLessThan(sound);
    expect(block).toContain('onResume && resumeCopy');
  });

  it('paints board numbers from the selected grid skin', () => {
    expect(board).toContain('gridNumberColor(gridPaint, cell.adjacentMines)');
    expect(board).not.toContain('NUMBER_COLORS');
  });

  it('does not retrigger blast pop or burst FX on later cell presses', () => {
    expect(board).toContain('playedWave');
    expect(board).toContain('playedWave.current === wave');
    expect(board).not.toMatch(/if \(!reduce && wave != null\) \{\s*pop\.value = withSequence/);
    const burst = board.slice(board.indexOf('function Burst'));
    const burstEffect = burst.indexOf('useEffect');
    expect(burstEffect).toBeGreaterThan(-1);
    expect(burst.slice(0, burstEffect)).not.toContain('scale.value = withTiming');
    expect(burst.slice(burstEffect)).toContain('scale.value = withTiming');
  });

  it('renames only the home-bound cleared-floor control', () => {
    expect(play).toContain("mode === 'campaign' ? 'Return' : 'Claim and leave'");
    expect(play).toContain('Claim and leave');
    expect(play).toContain('<DisplayText>Menu</DisplayText>');
    expect(play).toContain('Continue');
    expect(play).toContain('Descend');
    expect(play).not.toMatch(/: 'Menu'/);
  });

  it('persists the Expo route stack and restores web History after reload', () => {
    expect(layout).toContain("initialRouteName: 'index'");
    expect(layout).toContain('useNavStackSync');
    expect(nav).toContain('hydrateWebHistory');
    expect(nav).toContain('useNavStackSync');
    expect(nav).toContain('useSafeBack');
    expect(nav).toContain('router.canGoBack()');
    expect(collection).toContain('useSafeBack');
    expect(shop).toContain('useSafeBack');
    expect(collection).not.toContain('router.back()');
    expect(shop).not.toContain('router.back()');
  });
});
