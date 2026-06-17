const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const siteConfig = require("../config/site.config.json");

// 232 x 125 = exatamente 29.000 tijolinhos.
const GRID_COLS = 232;
const GRID_ROWS = 125;
const COPACABANA_MAX_X = 68;
const LEBLON_MAX_X = 151;
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

  if (batch.length) {
    await prisma.block.createMany({ data: batch, skipDuplicates: true });
  }

  const counts = {
    total: await prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    copacabana: await prisma.block.count({ where: { category: "SOLIDARITY", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    leblon: await prisma.block.count({ where: { category: "GOLD", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    ipanema: await prisma.block.count({ where: { category: "PREMIUM", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    tomDelfim: await prisma.block.count({ where: { category: "GRAND_CENTER", gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
  };

  console.log(counts);
  console.log("Grid Mural 29 inicializado com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
