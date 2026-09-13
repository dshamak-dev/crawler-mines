/** Gap between dungeon cells — keep in sync with Board `GAP`. */
export const BOARD_GAP = 3;

/** Matches `Shell` tight horizontal padding (both sides). */
export const PLAY_SIDE_PAD = 6;

/**
 * Largest square cell that fits `cols×rows` plus gaps inside the slot.
 * Never returns a size that would overflow — campaign 12×16 must shrink.
 */
export function fitBoardCellPx(
  availW: number,
  availH: number,
  cols: number,
  rows: number,
  gap = BOARD_GAP,
): number {
  if (availW <= 0 || availH <= 0 || cols <= 0 || rows <= 0) return 0;
  const byW = (availW - gap * (cols - 1)) / cols;
  const byH = (availH - gap * (rows - 1)) / rows;
  return Math.max(1, Math.floor(Math.min(byW, byH)));
}

export function boardPixelSize(
  cols: number,
  rows: number,
  cell: number,
  gap = BOARD_GAP,
): { width: number; height: number } {
  return {
    width: cols * cell + gap * Math.max(0, cols - 1),
    height: rows * cell + gap * Math.max(0, rows - 1),
  };
}

/**
 * Cap a measured slot to the window minus safe insets and play-shell padding.
 * Needed because a flexWrap board can expand its parent; onLayout then reports
 * the overflowing size and cells walk off the device.
 */
export function clampBoardSlot(
  slotW: number,
  slotH: number,
  windowW: number,
  windowH: number,
  insetL: number,
  insetR: number,
  insetT: number,
  insetB: number,
  extraX = PLAY_SIDE_PAD * 2,
  extraY = 0,
): { w: number; h: number } {
  const maxW = Math.max(0, windowW - insetL - insetR - extraX);
  const maxH = Math.max(0, windowH - insetT - insetB - extraY);
  return {
    w: slotW > 0 ? Math.min(slotW, maxW) : maxW,
    h: slotH > 0 ? Math.min(slotH, maxH) : maxH,
  };
}
