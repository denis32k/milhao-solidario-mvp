const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const siteConfig = require("../config/site.config.json");

const GRID_COLS = 232;
const GRID_ROWS = 125;
const COPACABANA_MAX_X = 68;
const LEBLON_MAX_X = 151;
const NOBLE_SQL = `
  ("gridX" BETWEEN 91 AND 127 AND "gridY" BETWEEN 0 AND 49)
`;

const NOBLE_AREAS = [
  { minX: 91, maxX: 127, minY: 0, maxY: 49 },
];

function isGrandCenterBlock(x, y) {
  return NOBLE_AREAS.some((rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY);
}

function getCategory(x, y) {
  if (isGrandCenterBlock(x, y)) return "GRAND_CENTER";
  if (x <= COPACABANA_MAX_X) return "SOLIDARITY";
  if (x <= LEBLON_MAX_X) return "GOLD";
  return "PREMIUM";
}

function getPriceCents(category) {
  return siteConfig.areas[category]?.priceCents || 0;
}

function getStatus() {
  return "AVAILABLE";
}

async function main() {
  console.log("Sincronizando Mural 29: 232 x 125 = 29.000 blocos, com área nobre Tom Delfim Moreira...");

  let batch = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const category = getCategory(x, y);
      batch.push({
        gridX: x,
        gridY: y,
        category,
        status: getStatus(category),
        available: true,
        priceCents: getPriceCents(category),
      });

      if (batch.length >= 1000) {
        await prisma.block.createMany({ data: batch, skipDuplicates: true });
        batch = [];
      }
    }
  }
  if (batch.length) await prisma.block.createMany({ data: batch, skipDuplicates: true });

  const priceSolidarity = siteConfig.areas.SOLIDARITY.priceCents;
  const pricePremium = siteConfig.areas.PREMIUM.priceCents;
  const priceGold = siteConfig.areas.GOLD.priceCents;
  const priceGrandCenter = siteConfig.areas.GRAND_CENTER.priceCents;

  await prisma.$executeRawUnsafe(`
    UPDATE "Block"
    SET
      "category" = CASE
        WHEN ${NOBLE_SQL} THEN 'GRAND_CENTER'::"BlockCategory"
        WHEN "gridX" <= ${COPACABANA_MAX_X} THEN 'SOLIDARITY'::"BlockCategory"
        WHEN "gridX" <= ${LEBLON_MAX_X} THEN 'GOLD'::"BlockCategory"
        ELSE 'PREMIUM'::"BlockCategory"
      END,
      "status" = 'AVAILABLE'::"BlockStatus",
      "available" = true,
      "priceCents" = CASE
        WHEN ${NOBLE_SQL} THEN ${priceGrandCenter}
        WHEN "gridX" <= ${COPACABANA_MAX_X} THEN ${priceSolidarity}
        WHEN "gridX" <= ${LEBLON_MAX_X} THEN ${priceGold}
        ELSE ${pricePremium}
      END,
      "ownerId" = NULL,
      "placementId" = NULL,
      "currentTransactionId" = NULL,
      "reservationToken" = NULL,
      "reservedUntil" = NULL
    WHERE
      "gridX" < ${GRID_COLS}
      AND "gridY" < ${GRID_ROWS}
      AND "status" != 'SOLD'::"BlockStatus";
  `);

  await prisma.block.updateMany({
    where: {
      OR: [{ gridX: { gte: GRID_COLS } }, { gridY: { gte: GRID_ROWS } }],
      status: { not: "SOLD" },
    },
    data: {
      category: "GRAND_CENTER",
      status: "AVAILABLE",
      available: false,
      priceCents: 0,
      ownerId: null,
      placementId: null,
      currentTransactionId: null,
      reservationToken: null,
      reservedUntil: null,
    },
  });

  const counts = {
    total: await prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    copacabana: await prisma.block.count({ where: { category: "SOLIDARITY", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    leblon: await prisma.block.count({ where: { category: "GOLD", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    ipanema: await prisma.block.count({ where: { category: "PREMIUM", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    tomDelfim: await prisma.block.count({ where: { category: "GRAND_CENTER", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
  };

  console.log(counts);
  console.log("Mural 29 sincronizado.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
