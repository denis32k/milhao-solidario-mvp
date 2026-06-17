import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const GOAL_CENTS = siteConfig.goalCents;

function moneyFromCents(cents: number) {
  return cents / 100;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function getCategoryStats(prisma: any, category: "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER") {
  const [total, sold, available, reserved, locked] = await Promise.all([
    prisma.block.count({ where: { category } }),
    prisma.block.count({ where: { category, status: "SOLD", placement: { isTest: false } } }),
    prisma.block.count({ where: { category, available: true } }),
    prisma.block.count({ where: { category, status: "RESERVED" } }),
    prisma.block.count({ where: { category, status: "LOCKED" } }),
  ]);

  return { total, sold, available, reserved, locked };
}

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");

    const [
      totalBlocks,
      availableBlocks,
      soldBlocks,
      lockedBlocks,
      reservedBlocks,
      approvedTransactions,
      approvedTotal,
      solidarityStats,
      premiumStats,
      goldStats,
      grandCenterStats,
    ] = await Promise.all([
      prisma.block.count(),
      prisma.block.count({ where: { available: true } }),
      prisma.block.count({ where: { status: "SOLD", placement: { isTest: false } } }),
      prisma.block.count({ where: { status: "LOCKED" } }),
      prisma.block.count({ where: { status: "RESERVED" } }),
      prisma.transaction.count({ where: { status: "APPROVED", isTest: false } }),
      prisma.transaction.aggregate({
        where: { status: "APPROVED", isTest: false },
        _sum: {
          subtotalCents: true,
          operatorFeeCents: true,
          totalPaidCents: true,
          creatorShareCents: true,
          hospitalShareCents: true,
        },
      }),
      getCategoryStats(prisma, "SOLIDARITY"),
      getCategoryStats(prisma, "PREMIUM"),
      getCategoryStats(prisma, "GOLD"),
      getCategoryStats(prisma, "GRAND_CENTER"),
    ]);

    const raisedCents = approvedTotal._sum.subtotalCents ?? 0;
    const operationalFeeCents = approvedTotal._sum.operatorFeeCents ?? 0;
    const totalPaidCents = approvedTotal._sum.totalPaidCents ?? 0;
    const creatorShareCents = approvedTotal._sum.creatorShareCents ?? 0;
    const hospitalShareCents = approvedTotal._sum.hospitalShareCents ?? 0;

    return NextResponse.json({
      ok: true,
      goal: { cents: GOAL_CENTS, reais: moneyFromCents(GOAL_CENTS) },
      raised: {
        cents: raisedCents,
        reais: moneyFromCents(raisedCents),
        progressPercent: Number(((raisedCents / GOAL_CENTS) * 100).toFixed(4)),
      },
      operationalFee: { cents: operationalFeeCents, reais: moneyFromCents(operationalFeeCents) },
      totalPaid: { cents: totalPaidCents, reais: moneyFromCents(totalPaidCents) },
      internalSplit: {
        creator: { cents: creatorShareCents, reais: moneyFromCents(creatorShareCents) },
        reservedOperationalDestination: { cents: hospitalShareCents, reais: moneyFromCents(hospitalShareCents) },
      },
      transactions: { approved: approvedTransactions },
      blocks: {
        total: totalBlocks,
        available: availableBlocks,
        sold: soldBlocks,
        locked: lockedBlocks,
        reserved: reservedBlocks,
        solidarity: solidarityStats.total,
        premium: premiumStats.total,
        gold: goldStats.total,
        grandCenter: grandCenterStats.total,
        byCategory: {
          SOLIDARITY: solidarityStats,
          PREMIUM: premiumStats,
          GOLD: goldStats,
          GRAND_CENTER: grandCenterStats,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Erro ao buscar estatísticas do banco.", error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
