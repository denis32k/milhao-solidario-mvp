import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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

    const transactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      select: {
        id: true,
        kind: true,
        status: true,

        subtotalCents: true,
        operatorFeeCents: true,
        totalPaidCents: true,

        creatorShareCents: true,
        hospitalShareCents: true,

        mpPaymentId: true,
        mpExternalReference: true,
        mpStatus: true,
        mpStatusDetail: true,

        createdAt: true,
        approvedAt: true,
        paidAt: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            name: true,
            publicName: true,
            email: true,
            totalApprovedCents: true,
          },
        },

        items: {
          select: {
            blockId: true,
            gridX: true,
            gridY: true,
            category: true,
            priceCents: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Últimas transações carregadas.",
      count: transactions.length,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        kind: transaction.kind,
        status: transaction.status,

        value: {
          subtotalCents: transaction.subtotalCents,
          subtotalFormatted: money(transaction.subtotalCents),

          operatorFeeCents: transaction.operatorFeeCents,
          operatorFeeFormatted: money(transaction.operatorFeeCents),

          totalPaidCents: transaction.totalPaidCents,
          totalPaidFormatted: money(transaction.totalPaidCents),

          creatorShareCents: transaction.creatorShareCents,
          creatorShareFormatted: money(transaction.creatorShareCents),

          hospitalShareCents: transaction.hospitalShareCents,
          hospitalShareFormatted: money(transaction.hospitalShareCents),
        },

        mercadoPago: {
          mpPaymentId: transaction.mpPaymentId,
          mpExternalReference: transaction.mpExternalReference,
          mpStatus: transaction.mpStatus,
          mpStatusDetail: transaction.mpStatusDetail,
        },

        user: transaction.user,

        blocks: transaction.items.map((item) => ({
          blockId: item.blockId,
          gridX: item.gridX,
          gridY: item.gridY,
          category: item.category,
          priceCents: item.priceCents,
          priceFormatted: money(item.priceCents),
        })),

        dates: {
          createdAt: transaction.createdAt,
          approvedAt: transaction.approvedAt,
          paidAt: transaction.paidAt,
          expiresAt: transaction.expiresAt,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao buscar últimas transações.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
