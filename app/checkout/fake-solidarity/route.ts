import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SUBTOTAL_CENTS = 1000;
const OPERATOR_FEE_CENTS = 100;
const TOTAL_PAID_CENTS = 1100;
const CREATOR_SHARE_CENTS = 500;
const HOSPITAL_SHARE_CENTS = 500;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = String(body.fullName || "").trim();

    if (!fullName || fullName.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe um nome completo válido.",
        },
        {
          status: 400,
        }
      );
    }

    const uniqueId = Date.now();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const availableBlock = await tx.block.findFirst({
        where: {
          category: "SOLIDARITY",
          status: "AVAILABLE",
          available: true,
        },
        orderBy: [
          {
            gridY: "asc",
          },
          {
            gridX: "asc",
          },
        ],
      });

      if (!availableBlock) {
        throw new Error("Nenhum bloco solidário disponível encontrado.");
      }

      const user = await tx.user.create({
        data: {
          name: fullName,
          publicName: fullName,
          email: `checkout-fake-${uniqueId}@example.com`,
          totalApprovedCents: 0,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          kind: "SOLIDARITY",
          status: "APPROVED",
          userId: user.id,

          subtotalCents: SUBTOTAL_CENTS,
          operatorFeeCents: OPERATOR_FEE_CENTS,
          totalPaidCents: TOTAL_PAID_CENTS,

          creatorShareCents: CREATOR_SHARE_CENTS,
          hospitalShareCents: HOSPITAL_SHARE_CENTS,

          mpExternalReference: `checkout-fake-approved-${uniqueId}`,
          mpStatus: "approved",
          mpStatusDetail: "fake_checkout_test",

          approvedAt: now,
          paidAt: now,
        },
      });

      const placement = await tx.placement.create({
        data: {
          kind: "SOLIDARITY",
          status: "ACTIVE",
          userId: user.id,
          transactionId: transaction.id,

          displayName: fullName,
          textLabel: fullName,
          fillColor: "#22c55e",
        },
      });

      await tx.block.update({
        where: {
          id: availableBlock.id,
        },
        data: {
          status: "SOLD",
          available: false,
          ownerId: user.id,
          placementId: placement.id,
          currentTransactionId: transaction.id,
        },
      });

      await tx.transactionBlock.create({
        data: {
          transactionId: transaction.id,
          blockId: availableBlock.id,
          gridX: availableBlock.gridX,
          gridY: availableBlock.gridY,
          category: availableBlock.category,
          priceCents: availableBlock.priceCents,
        },
      });

      await tx.distributionLedger.createMany({
        data: [
          {
            transactionId: transaction.id,
            recipient: "CREATOR",
            amountCents: CREATOR_SHARE_CENTS,
            status: "PENDING",
          },
          {
            transactionId: transaction.id,
            recipient: "HOSPITAL",
            amountCents: HOSPITAL_SHARE_CENTS,
            status: "PENDING",
          },
        ],
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          totalApprovedCents: {
            increment: SUBTOTAL_CENTS,
          },
        },
      });

      return {
        user,
        transaction,
        block: availableBlock,
      };
    });

    return NextResponse.json({
      ok: true,
      message: "Compra fake aprovada com sucesso.",
      user: {
        id: result.user.id,
        name: result.user.name,
      },
      transaction: {
        id: result.transaction.id,
        totalPaidCents: result.transaction.totalPaidCents,
      },
      block: {
        id: result.block.id,
        gridX: result.block.gridX,
        gridY: result.block.gridY,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao criar checkout fake.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}