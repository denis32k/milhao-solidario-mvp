const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const GRID_COLS = 200;
const GRID_ROWS = 145;

function isGrandCenterBlock(x, y) {
  return x >= 95 && x <= 104 && y >= 68 && y <= 77;
}

function isGoldRingBlock(x, y) {
  return x >= 90 && x <= 109 && y >= 63 && y <= 82 && !isGrandCenterBlock(x, y);
}

function isSolidarityFrameBlock(x, y) {
  return y < 10 || y >= 135 || x < 24 || x >= 176;
}

function getCategory(x, y) {
  if (isGrandCenterBlock(x, y)) return "GRAND_CENTER";
  if (isGoldRingBlock(x, y)) return "GOLD";
  if (isSolidarityFrameBlock(x, y)) return "SOLIDARITY";
  return "PREMIUM";
}

function getPriceCents(category) {
  if (category === "SOLIDARITY") return 1000;
  if (category === "PREMIUM") return 10000;
  if (category === "GOLD") return 50000;
  return 0;
}

function getStatus(category) {
  if (category === "GRAND_CENTER") return "LOCKED";
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
        available: category !== "GRAND_CENTER",
        priceCents: getPriceCents(category),
      });

      if (batch.length >= 1000) {
        await prisma.block.createMany({ data: batch, skipDuplicates: true });
        console.log(`Processados ${y}/${GRID_ROWS}`);
        batch = [];
      }
    }
  }

  if (batch.length) {
    await prisma.block.createMany({ data: batch, skipDuplicates: true });
  }

  const total = await prisma.block.count();
  const solidarity = await prisma.block.count({ where: { category: "SOLIDARITY" } });
  const premium = await prisma.block.count({ where: { category: "PREMIUM" } });
  const gold = await prisma.block.count({ where: { category: "GOLD" } });
  const grandCenter = await prisma.block.count({ where: { category: "GRAND_CENTER" } });

  console.log({ total, solidarity, premium, gold, grandCenter });

  if (
    total !== 29000 ||
    solidarity !== 10000 ||
    premium !== 18600 ||
    gold !== 300 ||
    grandCenter !== 100
  ) {
    throw new Error("Matemática do grid incorreta");
  }

  console.log("Matemática do grid conferida com sucesso!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
