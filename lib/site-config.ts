import siteConfigJson from "@/config/site.config.json";

export type AreaKey = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

export const siteConfig = siteConfigJson;

export function getAreaName(category: AreaKey) {
  return siteConfig.areas[category].name;
}

export function getAreaShortName(category: AreaKey) {
  return siteConfig.areas[category].shortName;
}

export function getAreaPriceCents(category: AreaKey) {
  return siteConfig.areas[category].priceCents;
}

export function getOperationalFeeCents(subtotalCents: number) {
  return Math.ceil(subtotalCents * (siteConfig.operationalFeePercent / 100));
}
