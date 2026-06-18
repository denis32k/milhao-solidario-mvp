import { prisma } from "@/lib/prisma";

export type OperationalSettings = {
  maintenanceMode: boolean;
  blockNewPurchases: boolean;
  preorderMode: boolean;
  uploadsEnabled: boolean;
  publicLinksEnabled: boolean;
  checkoutNotice: string;
  supportEmail: string;
  supportWhatsapp: string;
  reservationMinutes: number;
  maxImageMb: number;
  perIpLimitPerDay: number;
  perCustomerLimitPerDay: number;
};

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  maintenanceMode: false,
  blockNewPurchases: false,
  preorderMode: false,
  uploadsEnabled: true,
  publicLinksEnabled: true,
  checkoutNotice: "",
  supportEmail: "",
  supportWhatsapp: "",
  reservationMinutes: 2,
  maxImageMb: 5,
  perIpLimitPerDay: 0,
  perCustomerLimitPerDay: 0,
};

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function normalizeOperationalSettings(value: any): OperationalSettings {
  const source = value && typeof value === "object" ? value : {};
  return {
    maintenanceMode: asBoolean(source.maintenanceMode, DEFAULT_OPERATIONAL_SETTINGS.maintenanceMode),
    blockNewPurchases: asBoolean(source.blockNewPurchases, DEFAULT_OPERATIONAL_SETTINGS.blockNewPurchases),
    preorderMode: asBoolean(source.preorderMode, DEFAULT_OPERATIONAL_SETTINGS.preorderMode),
    uploadsEnabled: asBoolean(source.uploadsEnabled, DEFAULT_OPERATIONAL_SETTINGS.uploadsEnabled),
    publicLinksEnabled: asBoolean(source.publicLinksEnabled, DEFAULT_OPERATIONAL_SETTINGS.publicLinksEnabled),
    checkoutNotice: asString(source.checkoutNotice, DEFAULT_OPERATIONAL_SETTINGS.checkoutNotice).slice(0, 500),
    supportEmail: asString(source.supportEmail, DEFAULT_OPERATIONAL_SETTINGS.supportEmail).slice(0, 120),
    supportWhatsapp: asString(source.supportWhatsapp, DEFAULT_OPERATIONAL_SETTINGS.supportWhatsapp).replace(/\D/g, "").slice(0, 14),
    reservationMinutes: asNumber(source.reservationMinutes, DEFAULT_OPERATIONAL_SETTINGS.reservationMinutes, 1, 30),
    maxImageMb: asNumber(source.maxImageMb, DEFAULT_OPERATIONAL_SETTINGS.maxImageMb, 1, 20),
    perIpLimitPerDay: asNumber(source.perIpLimitPerDay, DEFAULT_OPERATIONAL_SETTINGS.perIpLimitPerDay, 0, 500),
    perCustomerLimitPerDay: asNumber(source.perCustomerLimitPerDay, DEFAULT_OPERATIONAL_SETTINGS.perCustomerLimitPerDay, 0, 500),
  };
}

export async function getOperationalSettings(): Promise<OperationalSettings> {
  try {
    const setting = await (prisma as any).systemSetting.findUnique({ where: { key: "operational" } });
    return normalizeOperationalSettings(setting?.value || DEFAULT_OPERATIONAL_SETTINGS);
  } catch {
    return DEFAULT_OPERATIONAL_SETTINGS;
  }
}
