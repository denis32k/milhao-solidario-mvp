export const GRID_COLS = 200;
export const GRID_ROWS = 145;
export const BLOCK_SIZE = 10;

export const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
export const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

export function getBlockCategory(x: number, y: number) {
  const isGrandCenter =
    x >= 99 &&
    x <= 100 &&
    y >= 70 &&
    y <= 74;

  if (isGrandCenter) return "GRAND_CENTER";

  if (y < 25 || y >= 120) return "SOLIDARITY";

  return "PREMIUM";
}

export function getBlockPriceCents(category: string) {
  if (category === "SOLIDARITY") return 1000;
  if (category === "PREMIUM") return 10000;
  return 0;
}
