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
    const blocks = await prisma.block.findMany({
      where: {
        gridX: { lt: GRID_COLS },
        gridY: { lt: GRID_ROWS },
        status: {
          in: ["SOLD", "RESERVED", "BLOCKED"],
        },
      },
      select: {
        id: true,
        gridX: true,
        gridY: true,
        category: true,
        status: true,
        available: true,
        priceCents: true,

        owner: {
          select: {
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