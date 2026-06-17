import siteConfigJson from "@/config/site.config.json";

export type AreaKey = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
export type BuyableAreaKey = "SOLIDARITY" | "PREMIUM" | "GOLD";

export const siteConfig = siteConfigJson;

export const buyableAreaKeys: BuyableAreaKey[] = ["SOLIDARITY", "PREMIUM", "GOLD"];

export const constructionPhases = siteConfig.constructionPhases;

export function getAreaName(category: AreaKey) {
  return siteConfig.areas[category].name;
}

export function getAreaShortName(category: AreaKey) {
  return siteConfig.areas[category].shortName;
}

export function getAreaPriceCents(category: AreaKey) {
  return siteConfig.areas[category].priceCents;
}

export function getAreaDescription(category: AreaKey) {
  return siteConfig.areas[category].description;
}

export function getAreaIncluded(category: BuyableAreaKey) {
  return siteConfig.areas[category].included;
}

export function getOperationalFeeCents(subtotalCents: number) {
  return Math.ceil(subtotalCents * (siteConfig.operationalFeePercent / 100));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function getConstructionPhase(sold: number, total: number) {
  const phases = siteConfig.constructionPhases;
  const safeTotal = Math.max(total, 1);
  const progress = Math.min(1, Math.max(0, sold / safeTotal));
  const phaseSize = 1 / phases.length;
  const currentIndex = Math.min(phases.length - 1, Math.floor(progress / phaseSize));
  const nextIndex = Math.min(phases.length - 1, currentIndex + 1);
  const nextThreshold = Math.ceil(safeTotal * phaseSize * (currentIndex + 1));
  const missingToNext = Math.max(0, nextThreshold - sold);

  return {
    phases,
    progress,
    progressPercent: Number((progress * 100).toFixed(2)),
    currentIndex,
    currentPhase: phases[currentIndex],
    nextIndex,
    nextPhase: phases[nextIndex],
    missingToNext,
    isCompleted: sold >= safeTotal,
  };
}
