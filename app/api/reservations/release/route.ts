import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const raw = await request.text();

    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }

    const reservationToken = String(body.reservationToken || "").trim();

    if (!reservationToken) {
      return NextResponse.json({ ok: false, message: "Reserva não informada." }, { status: 400 });
    }

    const released = await prisma.block.updateMany({
      where: {
        reservationToken,
        status: "RESERVED",
        currentTransactionId: null,
      },
      data: {
        status: "AVAILABLE",
        available: true,
        ownerId: null,
        currentTransactionId: null,
        reservationToken: null,
        reservedUntil: null,
      },
    });

    return NextResponse.json({ ok: true, releasedBlocks: released.count });
  } catch (error) {
    return NextResponse.json({ ok: false, message: getErrorMessage(error) || "Não foi possível liberar." }, { status: 500 });
  }
}
