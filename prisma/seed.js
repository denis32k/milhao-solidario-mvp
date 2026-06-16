const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const GRID_COLS = 200;
const GRID_ROWS = 145;
function getCategory(x, y) {
  const isGrandCenter = x >= 99 && x <= 100 && y >= 70 && y <= 74;
  if (isGrandCenter) return "GRAND_CENTER";
  if (y < 25 || y >= 120) return "SOLIDARITY";
  return "PREMIUM";
}
function getPriceCents(category) {
  if (category === "SOLIDARITY") return 1000;
  if (category === "PREMIUM") return 10000;
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
      batch.push({ gridX: x, gridY: y, category, status: getStatus(category), available: category !== "GRAND_CENTER", priceCents: getPriceCents(category) });
      if (batch.length >= 1000) { await prisma.block.createMany({ data: batch, skipDuplicates: true }); console.log(`Processados ${y}/${GRID_ROWS}`); batch = []; }
    }
  }
  if (batch.length) await prisma.block.createMany({ data: batch, skipDuplicates: true });
  const total = await prisma.block.count();
  const solidarity = await prisma.block.count({ where: { category: "SOLIDARITY" } });
  const premium = await prisma.block.count({ where: { category: "PREMIUM" } });
  const grandCenter = await prisma.block.count({ where: { category: "GRAND_CENTER" } });
  console.log({ total, solidarity, premium, grandCenter });
  if (total !== 29000 || solidarity !== 10000 || premium !== 18990 || grandCenter !== 10) throw new Error("Matemática do grid incorreta");
  console.log("Matemática do grid conferida com sucesso!");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async()=>prisma.$disconnect());
