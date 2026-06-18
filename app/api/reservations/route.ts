import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { getOperationalSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

type SelectedBlockInput = {
  gridX: number;
  gridY: number;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeSelectedBlocks(value: unknown): SelectedBlockInput[] {
  if (!Array.isArray(value)) return [];

  const unique = new Map<string, SelectedBlockInput>();
  for (const item of value) {
    const gridX = Number(item?.gridX);
    const gridY = Number(item?.gridY);

    if (
      Number.isInteger(gridX) &&
      Number.isInteger(gridY) &&
      gridX >= 0 &&
      gridX < GRID_COLS &&
      gridY >= 0 &&
      gridY < GRID_ROWS
    ) {
      unique.set(`${gridX}:${gridY}`, { gridX, gridY });
    }
  }

  return Array.from(unique.values());
}

function blocksFormRectangle(blocks: SelectedBlockInput[]) {
  if (blocks.length <= 1) return true;
  const minX = Math.min(...blocks.map((block) => block.gridX));
  const maxX = Math.max(...blocks.map((block) => block.gridX));
  const minY = Math.min(...blocks.map((block) => block.gridY));
  const maxY = Math.max(...blocks.map((block) => block.gridY));
  return (maxX - minX + 1) * (maxY - minY + 1) === blocks.length;
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await getOperationalSettings();

    if (settings.maintenanceMode || settings.blockNewPurchases) {
      return NextResponse.json(
        { ok: false, message: settings.maintenanceMode ? "Site em manutenção." : "Compras pausadas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const selectedBlocks = normalizeSelectedBlocks(body.selectedBlocks);
    const requestedCategory = String(body.category || "").toUpperCase();

    if (selectedBlocks.length === 0) {
      return NextResponse.json({ ok: false, message: "Selecione um espaço no mural." }, { status: 400 });
    }

    if (selectedBlocks.length > 1 && !blocksFormRectangle(selectedBlocks)) {
      return NextResponse.json({ ok: false, message: "Escolha uma área retangular." }, { status: 400 });
    }

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

    const reservationToken = randomUUID();
    const effectiveReservationMinutes = 2;
    const reservedUntil = new Date(now.getTime() + effectiveReservationMinutes * 60 * 1000);

    const result = await prisma.$transaction(async (tx: any) => {
      const foundBlocks = await tx.block.findMany({
        where: {
          OR: selectedBlocks.map((block) => ({ gridX: block.gridX, gridY: block.gridY })),
          status: "AVAILABLE",
          available: true,
          category: { in: ["SOLIDARITY", "PREMIUM", "GOLD", "GRAND_CENTER"] },
        },
        orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
      });

      if (foundBlocks.length !== selectedBlocks.length) {
        throw new Error("Este espaço acabou de ficar indisponível.");
      }

      const categories = Array.from(new Set(foundBlocks.map((block: any) => block.category)));
      if (categories.length !== 1) throw new Error("Escolha espaços da mesma área.");

      if (requestedCategory && requestedCategory !== categories[0]) {
        throw new Error("A área selecionada mudou. Volte ao mural.");
      }

      const updated = await tx.block.updateMany({
        where: { id: { in: foundBlocks.map((block: any) => block.id) }, status: "AVAILABLE", available: true },
        data: {
          status: "RESERVED",
          available: false,
          reservationToken,
          reservedUntil,
          ownerId: null,
          currentTransactionId: null,
        },
      });

      if (updated.count !== foundBlocks.length) {
        throw new Error("Este espaço acabou de ficar indisponível.");
      }

      return { blocks: foundBlocks, category: categories[0] };
    });

    return NextResponse.json({
      ok: true,
      message: "Espaço reservado.",
      reservationToken,
      reservedUntil: reservedUntil.toISOString(),
      expiresInSeconds: Math.max(0, Math.floor((reservedUntil.getTime() - Date.now()) / 1000)),
      reservationMinutes: effectiveReservationMinutes,
      category: result.category,
      blocks: result.blocks.map((block: any) => ({
        id: block.id,
        gridX: block.gridX,
        gridY: block.gridY,
        category: block.category,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: getErrorMessage(error) || "Não foi possível reservar." },
      { status: 409 }
    );
  }
}


export async function DELETE(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const url = new URL(request.url);
    const reservationToken = String(url.searchParams.get("token") || "").trim();

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
