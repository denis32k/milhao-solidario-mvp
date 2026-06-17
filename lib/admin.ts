export type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

export function isAuthorized(secretFromUrl: string | undefined) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return true;
  return secretFromUrl === secret;
}

export function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function getAdminSecret(params: Record<string, string | string[] | undefined>) {
  return firstParam(params.secret);
}

export function withAdminSecret(path: string, secret: string) {
  if (!secret) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}secret=${encodeURIComponent(secret)}`;
}

export async function safeListQuery<T>(factory: () => Promise<T[]>): Promise<T[]> {
  try {
    return await factory();
  } catch {
    return [];
  }
}

export async function safeValueQuery<T>(factory: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await factory();
  } catch {
    return fallback;
  }
}

export function shortId(value: string | null | undefined) {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function dateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export function normalizeSearch(value: string | string[] | undefined) {
  return firstParam(value).trim();
}
