import { NextResponse } from "next/server";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function GET() {
  try {
    const now = new Date();

    await prisma.transaction.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED", mpStatusDetail: "expired_local_reservation" },
    }).catch(() => null);

    await prisma.block.updateMany({
      where: { status: "RESERVED", reservedUntil: { lt: now } },
      data: {
        status: "AVAILABLE",
        available: true,
        ownerId: null,
        currentTransactionId: null,
        reservationToken: null,
        reservedUntil: null,
      },
    }).catch(() => null);

    const blocks = await prisma.block.findMany({
      where: {
        gridX: { lt: GRID_COLS },
        gridY: { lt: GRID_ROWS },
        OR: [
          { status: "RESERVED" },
          { status: "BLOCKED" },
          {
            status: "SOLD",
            OR: [{ placement: null }, { placement: { isTest: false } }],
          },
        ],
      },
      select: {
        id: true,
        gridX: true,
        gridY: true,
        category: true,
        status: true,
        available: true,
        priceCents: true,
        reservationToken: true,
        reservedUntil: true,

        owner: {
          select: {
            id: true,
            name: true,
            publicName: true,
            totalApprovedCents: true,
          },
        },

        placement: {
          select: {
            id: true,
            kind: true,
            status: true,
            title: true,
            description: true,
            imageUrl: true,
            redirectUrl: true,
            linkDisabled: true,
            displayName: true,
            textLabel: true,
            fillColor: true,
            placeholderReason: true,
            originX: true,
            originY: true,
            widthBlocks: true,
            heightBlocks: true,
          },
        },
      },
      orderBy: [
        {
          gridY: "asc",
        },
        {
          gridX: "asc",
        },
      ],
      take: 29000,
    });

    return NextResponse.json({
      ok: true,
      count: blocks.length,
      blocks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao buscar tijolinhos do mural.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}