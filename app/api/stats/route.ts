import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOAL_CENTS = 200000000;

function moneyFromCents(cents: number) {
  return cents / 100;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");

    const [
      totalBlocks,
      solidarityBlocks,
      premiumBlocks,
      grandCenterBlocks,
      availableBlocks,
      soldBlocks,
      lockedBlocks,
      approvedTransactions,
      approvedTotal,
    ] = await Promise.all([
      prisma.block.count(),

      prisma.block.count({
        where: {
          category: "SOLIDARITY",
        },
      }),

      prisma.block.count({
        where: {
          category: "PREMIUM",
        },
      }),

      prisma.block.count({
        where: {
          category: "GRAND_CENTER",
        },
      }),

      prisma.block.count({
        where: {
          available: true,
        },
      }),

      prisma.block.count({
        where: {
          status: "SOLD",
        },
      }),

      prisma.block.count({
        where: {
          status: "LOCKED",
        },
      }),

      prisma.transaction.count({
        where: {
          status: "APPROVED",
        },
      }),

      prisma.transaction.aggregate({
        where: {
          status: "APPROVED",
        },
        _sum: {
          subtotalCents: true,
          operationalFeeCents: true,
          totalPaidCents: true,
          creatorShareCents: true,
          hospitalShareCents: true,
        },
      }),
    ]);

    const raisedCents = approvedTotal._sum.subtotalCents ?? 0;
    const operationalFeeCents = approvedTotal._sum.operationalFeeCents ?? 0;
    const totalPaidCents = approvedTotal._sum.totalPaidCents ?? 0;
    const creatorShareCents = approvedTotal._sum.creatorShareCents ?? 0;
    const hospitalShareCents = approvedTotal._sum.hospitalShareCents ?? 0;

    return NextResponse.json({
      ok: true,

      goal: {
        cents: GOAL_CENTS,
        reais: moneyFromCents(GOAL_CENTS),
      },

      raised: {
        cents: raisedCents,
        reais: moneyFromCents(raisedCents),
        progressPercent: Number(((raisedCents / GOAL_CENTS) * 100).toFixed(4)),
      },

      operationalFee: {
        cents: operationalFeeCents,
        reais: moneyFromCents(operationalFeeCents),
      },

      totalPaid: {
        cents: totalPaidCents,
        reais: moneyFromCents(totalPaidCents),
      },

      split: {
        creator: {
          cents: creatorShareCents,
          reais: moneyFromCents(creatorShareCents),
        },
        hospital: {
          cents: hospitalShareCents,
          reais: moneyFromCents(hospitalShareCents),
        },
      },

      transactions: {
        approved: approvedTransactions,
      },

      blocks: {
        total: totalBlocks,
        available: availableBlocks,
        sold: soldBlocks,
        locked: lockedBlocks,
        solidarity: solidarityBlocks,
        premium: premiumBlocks,
        grandCenter: grandCenterBlocks,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao buscar estatísticas do banco.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}