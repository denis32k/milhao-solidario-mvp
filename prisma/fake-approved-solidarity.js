const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const now = new Date();
  const uniqueId = Date.now();
  const result = await prisma.$transaction(async (tx) => {
    const block = await tx.block.findFirst({ where: { category: "SOLIDARITY", status: "AVAILABLE", available: true }, orderBy: [{ gridY: "asc" }, { gridX: "asc" }] });
    if (!block) throw new Error("Nenhum bloco disponível.");
    const user = await tx.user.create({ data: { name: `Apoiador Teste ${uniqueId}`, publicName: "Apoiador Teste", email: `teste-${uniqueId}@example.com` } });
    const transaction = await tx.transaction.create({ data: { kind: "SOLIDARITY", status: "APPROVED", userId: user.id, subtotalCents: 1000, operatorFeeCents: 100, totalPaidCents: 1100, creatorShareCents: 500, hospitalShareCents: 500, mpExternalReference: `fake-${uniqueId}`, mpStatus: "approved", mpStatusDetail: "fake_test", approvedAt: now, paidAt: now } });
    const placement = await tx.placement.create({ data: { kind: "SOLIDARITY", status: "ACTIVE", userId: user.id, transactionId: transaction.id, displayName: "Apoiador Teste", textLabel: "Apoiador Teste", fillColor: "#22c55e" } });
    await tx.block.update({ where: { id: block.id }, data: { status: "SOLD", available: false, ownerId: user.id, placementId: placement.id, currentTransactionId: transaction.id } });
    await tx.transactionBlock.create({ data: { transactionId: transaction.id, blockId: block.id, gridX: block.gridX, gridY: block.gridY, category: block.category, priceCents: block.priceCents } });
    await tx.distributionLedger.createMany({ data: [{ transactionId: transaction.id, recipient: "CREATOR", amountCents: 500 }, { transactionId: transaction.id, recipient: "HOSPITAL", amountCents: 500 }] });
    await tx.user.update({ where: { id: user.id }, data: { totalApprovedCents: { increment: 1000 } } });
    return { user, block };
  });
  console.log(`Compra teste criada: ${result.user.name} em x${result.block.gridX}/y${result.block.gridY}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async()=>prisma.$disconnect());
