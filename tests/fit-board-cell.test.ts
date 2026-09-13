import { describe, expect, it } from 'vitest';
import { boardPixelSize, clampBoardSlot, fitBoardCellPx } from '../native/src/ui/fitBoardCell';

describe('fitBoardCellPx', () => {
  it('fits campaign floor 4 (9×12) and floor 5 (12×16) inside a short phone slot', () => {
    const slot = { w: 360, h: 400 };
    for (const [cols, rows] of [
      [9, 12],
      [12, 16],
    ] as const) {
      const cell = fitBoardCellPx(slot.w, slot.h, cols, rows);
      const box = boardPixelSize(cols, rows, cell);
      expect(cell).toBeGreaterThanOrEqual(1);
      expect(box.width).toBeLessThanOrEqual(slot.w);
      expect(box.height).toBeLessThanOrEqual(slot.h);
    }
  });

  it('does not keep a 26px floor when that would overflow a 12×16 board', () => {
    const cell = fitBoardCellPx(360, 380, 12, 16);
    const box = boardPixelSize(12, 16, cell);
    expect(cell).toBeLessThan(26);
    expect(box.height).toBeLessThanOrEqual(380);
  });

  it('uses the full width on a tall 8×8 slot', () => {
    const cell = fitBoardCellPx(340, 600, 8, 8);
    expect(cell).toBe(Math.floor((340 - 3 * 7) / 8));
  });

  it('clamps an overflowing onLayout slot to the inset window', () => {
    const slot = clampBoardSlot(2000, 2000, 430, 932, 0, 0, 59, 34);
    expect(slot.w).toBe(430 - 12);
    expect(slot.h).toBe(932 - 59 - 34);
    const cell = fitBoardCellPx(slot.w, slot.h, 12, 16);
    const box = boardPixelSize(12, 16, cell);
    expect(box.width).toBeLessThanOrEqual(slot.w);
    expect(box.height).toBeLessThanOrEqual(slot.h);
  });
});
