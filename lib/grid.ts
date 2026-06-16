export const GRID_COLS = 200;
export const GRID_ROWS = 145;
export const BLOCK_SIZE = 10;

export const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
export const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

export const CENTER_LOCKED_MIN_X = 95;
export const CENTER_LOCKED_MAX_X = 104;
export const CENTER_LOCKED_MIN_Y = 68;
export const CENTER_LOCKED_MAX_Y = 77;

export const GOLD_RING_MIN_X = 90;
export const GOLD_RING_MAX_X = 109;
export const GOLD_RING_MIN_Y = 63;
export const GOLD_RING_MAX_Y = 82;

export const SOLIDARITY_TOP_ROWS = 10;
export const SOLIDARITY_SIDE_COLS = 24;

export type GridBlockCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

export function isGrandCenterBlock(x: number, y: number) {
  return (
    x >= CENTER_LOCKED_MIN_X &&
    x <= CENTER_LOCKED_MAX_X &&
    y >= CENTER_LOCKED_MIN_Y &&
    y <= CENTER_LOCKED_MAX_Y
  );
}

export function isGoldRingBlock(x: number, y: number) {
  return (
    x >= GOLD_RING_MIN_X &&
    x <= GOLD_RING_MAX_X &&
    y >= GOLD_RING_MIN_Y &&
    y <= GOLD_RING_MAX_Y &&
    !isGrandCenterBlock(x, y)
  );
}

export function isSolidarityFrameBlock(x: number, y: number) {
  return (
    y < SOLIDARITY_TOP_ROWS ||
    y >= GRID_ROWS - SOLIDARITY_TOP_ROWS ||
    x < SOLIDARITY_SIDE_COLS ||
    x >= GRID_COLS - SOLIDARITY_SIDE_COLS
  );
}

export function getBlockCategory(x: number, y: number): GridBlockCategory {
  if (isGrandCenterBlock(x, y)) return "GRAND_CENTER";
  if (isGoldRingBlock(x, y)) return "GOLD";
  if (isSolidarityFrameBlock(x, y)) return "SOLIDARITY";
  return "PREMIUM";
}

export function getBlockPriceCents(category: string) {
  if (category === "SOLIDARITY") return 1000;
  if (category === "PREMIUM") return 10000;
  if (category === "GOLD") return 50000;
  return 0;
}
