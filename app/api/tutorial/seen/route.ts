import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getVisitorIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const ipHash = getVisitorIpHash(request);

    const existing = await (prisma as any).consentLog.findFirst({
      where: { ipHash, channel: "purchase_tutorial_seen" },
      select: { id: true },
    }).catch(() => null);

    if (!existing) {
      await (prisma as any).consentLog.create({
        data: {
          ipHash,
          channel: "purchase_tutorial_seen",
          purpose: "Tutorial guiado de primeira visita do Mural29 concluído ou pulado.",
        },
      }).catch(() => null);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("mural29_purchase_tutorial_seen", "1", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("mural29_purchase_tutorial_seen", "1", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });

    return response;
  }
}
