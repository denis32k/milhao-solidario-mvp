const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const siteConfig = require("../config/site.config.json");
const priceSolidarity = siteConfig.areas.SOLIDARITY.priceCents;
const pricePremium = siteConfig.areas.PREMIUM.priceCents;
const priceGold = siteConfig.areas.GOLD.priceCents;

async function main() {
  console.log("Atualizando categorias do grid sem apagar vendas aprovadas...");

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = 'PREMIUM'::"BlockCategory",
      "status" = 'AVAILABLE'::"BlockStatus",
      "available" = true,
      "priceCents" = ${pricePremium},
      "ownerId" = NULL,
      "currentTransactionId" = NULL,
      "reservationToken" = NULL,
      "reservedUntil" = NULL
    WHERE "status" != 'SOLD'::"BlockStatus";
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = 'SOLIDARITY'::"BlockCategory",
      "priceCents" = ${priceSolidarity}
    WHERE
      "status" != 'SOLD'::"BlockStatus"
      AND (
        "gridY" < 10
        OR "gridY" >= 135
        OR "gridX" < 24
        OR "gridX" >= 176
      );
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = 'GOLD'::"BlockCategory",
      "priceCents" = ${priceGold}
    WHERE
      "status" != 'SOLD'::"BlockStatus"
      AND "gridX" BETWEEN 90 AND 109
      AND "gridY" BETWEEN 63 AND 82
      AND NOT (
        "gridX" BETWEEN 95 AND 104
        AND "gridY" BETWEEN 68 AND 77
      );
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = 'GRAND_CENTER'::"BlockCategory",
      "status" = 'LOCKED'::"BlockStatus",
      "available" = false,
      "priceCents" = 0,
      "ownerId" = NULL,
      "placementId" = NULL,
      "currentTransactionId" = NULL,
      "reservationToken" = NULL,
      "reservedUntil" = NULL
    WHERE
      "gridX" BETWEEN 95 AND 104
      AND "gridY" BETWEEN 68 AND 77;
  `);

  const counts = {
    total: await prisma.block.count(),
    solidarity: await prisma.block.count({ where: { category: "SOLIDARITY" } }),
    premium: await prisma.block.count({ where: { category: "PREMIUM" } }),
    gold: await prisma.block.count({ where: { category: "GOLD" } }),
    grandCenter: await prisma.block.count({ where: { category: "GRAND_CENTER" } }),
  };

  console.log(counts);
  console.log("Categorias sincronizadas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
