const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const siteConfig = require("../config/site.config.json");
const priceSolidarity = siteConfig.areas.SOLIDARITY.priceCents;
const pricePremium = siteConfig.areas.PREMIUM.priceCents;
const priceGold = siteConfig.areas.GOLD.priceCents;

async function main() {
  console.log("Atualizando categorias do grid para o novo mural sem apagar vendas aprovadas...");

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = CASE
        WHEN "gridX" <= 65 THEN 'SOLIDARITY'::"BlockCategory"
        WHEN "gridX" <= 132 THEN 'GOLD'::"BlockCategory"
        ELSE 'PREMIUM'::"BlockCategory"
      END,
      "status" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN "status" ELSE 'AVAILABLE'::"BlockStatus" END,
      "available" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN false ELSE true END,
      "priceCents" = CASE
        WHEN "gridX" <= 65 THEN ${priceSolidarity}
        WHEN "gridX" <= 132 THEN ${priceGold}
        ELSE ${pricePremium}
      END,
      "ownerId" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN "ownerId" ELSE NULL END,
      "currentTransactionId" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN "currentTransactionId" ELSE NULL END,
      "reservationToken" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN "reservationToken" ELSE NULL END,
      "reservedUntil" = CASE WHEN "status" = 'SOLD'::"BlockStatus" THEN "reservedUntil" ELSE NULL END
    WHERE "status" != 'BLOCKED'::"BlockStatus";
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
      ("gridX" BETWEEN 10 AND 51 AND "gridY" BETWEEN 124 AND 138)
      OR ("gridX" BETWEEN 80 AND 122 AND "gridY" BETWEEN 66 AND 86)
      OR ("gridX" BETWEEN 147 AND 189 AND "gridY" BETWEEN 124 AND 138);
  `);

  const counts = {
    total: await prisma.block.count(),
    copacabana: await prisma.block.count({ where: { category: "SOLIDARITY" } }),
    leblon: await prisma.block.count({ where: { category: "GOLD" } }),
    ipanema: await prisma.block.count({ where: { category: "PREMIUM" } }),
    restrita: await prisma.block.count({ where: { category: "GRAND_CENTER" } }),
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
