/** Gap between dungeon cells — keep in sync with Board `GAP`. */
export const BOARD_GAP = 3;

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
