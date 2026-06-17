export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const BLOCKED_PROTOCOLS = ["javascript:", "data:", "file:", "vbscript:"];

export function getImageExtension(fileType: string) {
  return ALLOWED_IMAGE_TYPES[fileType] || null;
}

export function validateImageFile(file: File) {
  const extension = getImageExtension(file.type);
  if (!extension) {
    return { ok: false, message: "Formato inválido. Use JPG, PNG ou WEBP.", extension: null as string | null };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, message: "Imagem muito grande. Envie até 5MB.", extension: null as string | null };
  }

  return { ok: true, message: "Imagem válida.", extension };
}

export function normalizePublicUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (BLOCKED_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) return "";

  if (raw.startsWith("@")) {
    const handle = raw.replace("@", "").replace(/[^a-zA-Z0-9._]/g, "");
    return handle ? `https://instagram.com/${handle}` : "";
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.toString().slice(0, 500);
    } catch {
      return "";
    }
  }

  if (/^[a-zA-Z0-9._-]+$/.test(raw)) return `https://instagram.com/${raw}`;

  if (raw.includes(".") && !raw.includes(" ")) {
    try {
      const parsed = new URL(`https://${raw}`);
      return parsed.toString().slice(0, 500);
    } catch {
      return "";
    }
  }

  return "";
}

export function getHostnameFromUrl(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeBlockedDomain(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const withoutProtocol = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const domain = withoutProtocol.split("/")[0].split("?")[0].split("#")[0].trim();
  if (!domain || domain.includes(" ")) return "";
  return domain.replace(/[^a-z0-9.-]/g, "").replace(/^\.+|\.+$/g, "");
}

export function getDomainCandidates(hostname: string) {
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  if (!clean) return [];
  const parts = clean.split(".").filter(Boolean);
  const candidates = new Set<string>([clean]);

  if (parts.length >= 2) candidates.add(parts.slice(-2).join("."));
  if (parts.length >= 3) candidates.add(parts.slice(-3).join("."));

  return Array.from(candidates);
}

export async function findBlockedDomain(prisma: any, url: string) {
  const hostname = getHostnameFromUrl(url);
  const candidates = getDomainCandidates(hostname);
  if (!candidates.length) return null;

  return prisma.blockedDomain.findFirst({
    where: { active: true, domain: { in: candidates } },
  });
}
