import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const body = await request.json();
    const blockId = String(body.blockId || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 500);
    const reporterEmail = String(body.reporterEmail || "").trim().slice(0, 120) || null;

    if (!blockId) {
      return NextResponse.json({ ok: false, message: "Tijolinho não informado." }, { status: 400 });
    }

    if (reason.length < 3) {
      return NextResponse.json({ ok: false, message: "Informe o motivo da denúncia." }, { status: 400 });
    }

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      select: { id: true, placementId: true },
    });

    if (!block) {
      return NextResponse.json({ ok: false, message: "Tijolinho não encontrado." }, { status: 404 });
    }

    const report = await prisma.report.create({
      data: {
        blockId: block.id,
        placementId: block.placementId,
        reason,
        reporterEmail,
        reporterIpHash: getIpHash(request),
        status: "OPEN",
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Denúncia enviada.",
      reportId: report.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao criar denúncia.",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
