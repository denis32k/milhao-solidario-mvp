const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const GRID_COLS = 200;
const GRID_ROWS = 145;

function getCategory(x, y) {
  const isGrandCenter = x >= 99 && x <= 100 && y >= 70 && y <= 74;

  if (isGrandCenter) {
    return "GRAND_CENTER";
  }

  if (y < 25 || y >= 120) {
    return "SOLIDARITY";
  }

  return "PREMIUM";
}

function getPriceCents(category) {
  if (category === "SOLIDARITY") {
    return 1000;
  }

  if (category === "PREMIUM") {
    return 10000;
  }

  return 0;
}

function getStatus(category) {
  if (category === "GRAND_CENTER") {
    return "LOCKED";
  }

  return "AVAILABLE";
}

function getAvailable(category) {
  return category !== "GRAND_CENTER";
}

async function createBlocks() {
  const batchSize = 1000;
  let batch = [];
  let createdOrSkipped = 0;

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const category = getCategory(x, y);

      batch.push({
        gridX: x,
        gridY: y,
        category,
        status: getStatus(category),
        available: getAvailable(category),
        priceCents: getPriceCents(category),
      });

      if (batch.length >= batchSize) {
        await prisma.block.createMany({
          data: batch,
          skipDuplicates: true,
        });

        createdOrSkipped += batch.length;
        console.log(`Processados: ${createdOrSkipped} blocos`);

        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await prisma.block.createMany({
      data: batch,
      skipDuplicates: true,
    });

    createdOrSkipped += batch.length;
    console.log(`Processados: ${createdOrSkipped} blocos`);
  }
}

async function main() {
  console.log("Iniciando seed dos blocos...");

  await createBlocks();

  const total = await prisma.block.count();

  const solidarity = await prisma.block.count({
    where: {
      category: "SOLIDARITY",
    },
  });

  const premium = await prisma.block.count({
    where: {
      category: "PREMIUM",
    },
  });

  const grandCenter = await prisma.block.count({
    where: {
      category: "GRAND_CENTER",
    },
  });

  console.log("--------------------------------");
  console.log("Seed finalizado!");
  console.log("--------------------------------");
  console.log(`Total de blocos: ${total}`);
  console.log(`Mosaico Solidário: ${solidarity}`);
  console.log(`Área Premium: ${premium}`);
  console.log(`Centro Grandioso: ${grandCenter}`);
  console.log("--------------------------------");

  if (total !== 29000) {
    throw new Error(`Erro: total esperado era 29000, mas veio ${total}`);
  }

  if (solidarity !== 10000) {
    throw new Error(
      `Erro: Mosaico Solidário esperado era 10000, mas veio ${solidarity}`
    );
  }

  if (premium !== 18990) {
    throw new Error(
      `Erro: Área Premium esperada era 18990, mas veio ${premium}`
    );
  }

  if (grandCenter !== 10) {
    throw new Error(
      `Erro: Centro Grandioso esperado era 10, mas veio ${grandCenter}`
    );
  }

  console.log("Matemática do grid conferida com sucesso!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });