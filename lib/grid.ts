import { getAreaPriceCents } from "@/lib/site-config";

export const GRID_COLS = 200;
export const GRID_ROWS = 145;
export const BLOCK_SIZE = 10;

export const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
export const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

export type GridBlockCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

export const COPACABANA_MAX_X = 65;
export const LEBLON_MAX_X = 132;

export const RESTRICTED_AREAS = [
  { id: "copacabana-sign", minX: 10, maxX: 51, minY: 124, maxY: 138 },
  { id: "leblon-sign", minX: 80, maxX: 122, minY: 66, maxY: 86 },
  { id: "ipanema-sign", minX: 147, maxX: 189, minY: 124, maxY: 138 },
] as const;

function isInsideRect(
  x: number,
  y: number,
  rect: { minX: number; maxX: number; minY: number; maxY: number }
) {
  return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
}

export function isRestrictedBlock(x: number, y: number) {
  return RESTRICTED_AREAS.some((rect) => isInsideRect(x, y, rect));
}

export function getRestrictedAreaId(x: number, y: number) {
  const rect = RESTRICTED_AREAS.find((area) => isInsideRect(x, y, area));
  return rect?.id ?? null;
}

export function getBlockCategory(x: number, y: number): GridBlockCategory {
  if (isRestrictedBlock(x, y)) return "GRAND_CENTER";
  if (x <= COPACABANA_MAX_X) return "SOLIDARITY";
  if (x <= LEBLON_MAX_X) return "GOLD";
  return "PREMIUM";
}

export function getBlockPriceCents(category: string) {
  if (category === "SOLIDARITY" || category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER") {
    return getAreaPriceCents(category);
  }

  return 0;
}
