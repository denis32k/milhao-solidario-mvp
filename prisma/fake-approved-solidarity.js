const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUBTOTAL_CENTS = 1000;
const OPERATOR_FEE_CENTS = 100;
const TOTAL_PAID_CENTS = 1100;
const CREATOR_SHARE_CENTS = 500;
const HOSPITAL_SHARE_CENTS = 500;

async function main() {
  console.log("Criando compra teste aprovada...");

  const availableBlock = await prisma.block.findFirst({
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

  const now = new Date();
  const uniqueId = Date.now();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: `Apoiador Teste ${uniqueId}`,
        publicName: `Apoiador Teste`,
        email: `apoiador-teste-${uniqueId}@example.com`,
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

        mpExternalReference: `fake-approved-${uniqueId}`,
        mpStatus: "approved",
        mpStatusDetail: "fake_test",

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

        displayName: "Apoiador Teste",
        textLabel: "Apoiador Teste",
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
      placement,
    };
  });

  console.log("--------------------------------");
  console.log("Compra teste criada com sucesso!");
  console.log("--------------------------------");
  console.log(`Usuário: ${result.user.name}`);
  console.log(`Bloco vendido: x${result.block.gridX} / y${result.block.gridY}`);
  console.log("Valor principal: R$ 10,00");
  console.log("Taxa operacional: R$ 1,00");
  console.log("Total pago: R$ 11,00");
  console.log("--------------------------------");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });