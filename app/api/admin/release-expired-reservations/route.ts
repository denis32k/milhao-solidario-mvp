import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isAuthorized(request: Request) {
  const secret = process.env.ADMIN_API_SECRET;

  if (!secret) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = request.headers.get("x-admin-secret");

  return querySecret === secret || headerSecret === secret;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Acesso negado.",
        },
        {
          status: 401,
        }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const now = new Date();

    const reservedBlocks = await prisma.block.findMany({
      where: {
        status: "RESERVED",
        currentTransactionId: {
          not: null,
        },
        ...(force
          ? {}
          : {
              reservedUntil: {
                lt: now,
              },
            }),
      },
      select: {
        id: true,
        gridX: true,
        gridY: true,
        currentTransactionId: true,
        reservedUntil: true,
        ownerId: true,
      },
      orderBy: [
        {
          reservedUntil: "asc",
        },
        {
          gridY: "asc",
        },
        {
          gridX: "asc",
        },
      ],
    });

    const blockIds = reservedBlocks.map((block) => block.id);

    const transactionIds = Array.from(
      new Set(
        reservedBlocks
          .map((block) => block.currentTransactionId)
          .filter(Boolean)
      )
    ) as string[];

    if (blockIds.length === 0) {
      return NextResponse.json({
        ok: true,
        message: force
          ? "Nenhum tijolinho reservado encontrado para liberar."
          : "Nenhuma reserva expirada encontrada.",
        mode: force ? "force" : "expired-only",
        releasedBlocks: 0,
        expiredTransactions: 0,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const expiredTransactions = await tx.transaction.updateMany({
        where: {
          id: {
            in: transactionIds,
          },
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
          mpStatusDetail: force
            ? "released_manually_by_admin"
            : "expired_local_reservation",
        },
      });

      const releasedBlocks = await tx.block.updateMany({
        where: {
          id: {
            in: blockIds,
          },
          status: "RESERVED",
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

      return {
        expiredTransactions,
        releasedBlocks,
      };
    });

    return NextResponse.json({
      ok: true,
      message: force
        ? "Reservas liberadas manualmente."
        : "Reservas expiradas liberadas com sucesso.",
      mode: force ? "force" : "expired-only",
      releasedBlocks: result.releasedBlocks.count,
      expiredTransactions: result.expiredTransactions.count,
      blocks: reservedBlocks.map((block) => ({
        id: block.id,
        gridX: block.gridX,
        gridY: block.gridY,
        currentTransactionId: block.currentTransactionId,
        reservedUntil: block.reservedUntil,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao liberar reservas expiradas.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
