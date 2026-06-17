const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const siteConfig = require("../config/site.config.json");

const GRID_COLS = 200;
const GRID_ROWS = 145;
const COPACABANA_MAX_X = 65;
const LEBLON_MAX_X = 132;
const RESTRICTED_AREAS = [
  { minX: 10, maxX: 51, minY: 124, maxY: 138 },
  { minX: 80, maxX: 122, minY: 66, maxY: 86 },
  { minX: 147, maxX: 189, minY: 124, maxY: 138 },
];

function isRestrictedBlock(x, y) {
  return RESTRICTED_AREAS.some((rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY);
}

function getCategory(x, y) {
  if (isRestrictedBlock(x, y)) return "GRAND_CENTER";
  if (x <= COPACABANA_MAX_X) return "SOLIDARITY";
  if (x <= LEBLON_MAX_X) return "GOLD";
  return "PREMIUM";
}

function getPriceCents(category) {
  return siteConfig.areas[category]?.priceCents || 0;
}

function getStatus(category) {
  return category === "GRAND_CENTER" ? "LOCKED" : "AVAILABLE";
}

async function main() {
  let batch = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const category = getCategory(x, y);

      batch.push({
        gridX: x,
        gridY: y,
        category,
        status: getStatus(category),
        available: category !== "GRAND_CENTER",
        priceCents: getPriceCents(category),
      });

      if (batch.length >= 1000) {
        await prisma.block.createMany({ data: batch, skipDuplicates: true });
        batch = [];
      }
    }
  }

  if (batch.length) {
    await prisma.block.createMany({ data: batch, skipDuplicates: true });
  }

  const counts = {
    total: await prisma.block.count(),
    copacabana: await prisma.block.count({ where: { category: "SOLIDARITY" } }),
    leblon: await prisma.block.count({ where: { category: "GOLD" } }),
    ipanema: await prisma.block.count({ where: { category: "PREMIUM" } }),
    restrita: await prisma.block.count({ where: { category: "GRAND_CENTER" } }),
  };

  console.log(counts);
  console.log("Grid do mural inicializado com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
