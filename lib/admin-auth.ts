import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ADMIN_SESSION_COOKIE = "mural29_admin_session";
const SESSION_HOURS = 8;

export type AdminRole = "OWNER" | "ADMIN" | "FINANCE" | "MODERATOR" | "SUPPORT" | "DEV";

function shouldUseSecureAdminCookie() {
  const explicit = String(process.env.ADMIN_COOKIE_SECURE || "").trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  // Em muitos deploys com proxy/EasyPanel o app roda internamente em HTTP.
  // Deixar false por padrão evita login que "entra" e perde a sessão ao trocar de página.
  return false;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyAdminPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [method, salt, hash] = storedHash.split("$");
  if (method !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const realIp = h.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  const userAgent = h.get("user-agent") || "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  return { ipHash, userAgent };
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "OWNER" || role === "ADMIN" || role === "FINANCE" || role === "MODERATOR" || role === "SUPPORT" || role === "DEV";
}

export function canAccessAdmin(role: string | null | undefined) {
  return isAdminRole(role);
}

export async function getAdminSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await (prisma as any).adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session) return null;

    if (new Date(session.expiresAt) <= new Date()) {
      await (prisma as any).adminSession.delete({ where: { id: session.id } }).catch(() => null);
      return null;
    }

    if (!canAccessAdmin(session.user?.role)) return null;

    await (prisma as any).adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => null);

    return session;
  } catch {
    return null;
  }
}

export async function createAdminSession(user: any) {
  const token = createSessionToken();
  const { ipHash, userAgent } = await getRequestMeta();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await (prisma as any).adminSession.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      role: user.role,
      ipHash,
      userAgent,
      expiresAt,
      lastSeenAt: new Date(),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureAdminCookie(),
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });

  return token;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await (prisma as any).adminSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => null);
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureAdminCookie(),
    path: "/",
    maxAge: 0,
  });
}

export async function recordLoginAttempt({
  email,
  success,
  reason,
  userId,
}: {
  email: string;
  success: boolean;
  reason?: string;
  userId?: string | null;
}) {
  try {
    const { ipHash, userAgent } = await getRequestMeta();
    await (prisma as any).adminLoginAttempt.create({
      data: { email, success, reason: reason || null, userId: userId || null, ipHash, userAgent },
    });
  } catch {
    // Login não deve quebrar só porque o log falhou.
  }
}

export function getBootstrapAdminCredentials() {
  const email = process.env.ADMIN_EMAIL || "admin@mural29.local";
  const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_SECRET || "";
  return { email, password };
}

export async function findOrBootstrapAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const bootstrap = getBootstrapAdminCredentials();
  const bootstrapEmail = bootstrap.email.trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user && bootstrap.password && normalizedEmail === bootstrapEmail && password === bootstrap.password) {
    user = await prisma.user.create({
      data: {
        name: "Dono Mural29",
        publicName: "Admin",
        email: normalizedEmail,
        passwordHash: hashAdminPassword(password),
        role: "OWNER" as any,
      },
    });
  }

  if (user && !user.passwordHash && bootstrap.password && normalizedEmail === bootstrapEmail && password === bootstrap.password) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashAdminPassword(password), role: "OWNER" as any },
    });
  }

  return user;
}
