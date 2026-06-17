import { createHash, randomBytes } from "crypto";

export function createManagementToken() {
  return randomBytes(32).toString("hex");
}

export function hashManagementToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getManagementPath(token: string) {
  return `/gerenciar/${encodeURIComponent(token)}`;
}

export function getManagementUrl(token: string, appUrl?: string | null) {
  const path = getManagementPath(token);
  if (!appUrl) return path;
  const clean = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${clean}${path}`;
}
