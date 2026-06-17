import { getAreaPriceCents } from "@/lib/site-config";

// 232 x 125 = exatamente 29.000 tijolinhos vendáveis no mural.
// A imagem de fundo foi convertida para 2320 x 1250, então cada tijolinho ocupa 10 x 10 px.
export const GRID_COLS = 232;
export const GRID_ROWS = 125;
export const BLOCK_SIZE = 10;

export const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
export const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

export type GridBlockCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

// Divisões calculadas para o mural 232 x 125.
// Copacabana: 0..71 | Leblon: 72..154 | Ipanema: 155..231
// Área restrita atual: apenas a placa do Leblon.
export const COPACABANA_MAX_X = 71;
export const LEBLON_MAX_X = 154;

export const AREA_DIVIDERS = [COPACABANA_MAX_X + 1, LEBLON_MAX_X + 1] as const;

export const RESTRICTED_AREAS = [
  { id: "leblon-sign", minX: 82, maxX: 144, minY: 55, maxY: 70 },
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
