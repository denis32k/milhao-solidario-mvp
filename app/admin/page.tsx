import Link from "next/link";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { formatMoney, getAreaName, siteConfig, type AreaKey } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{ secret?: string }>;
type TestCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
type LegacyKind = "SOLIDARITY" | "PREMIUM" | "GOLD";

type AvailableBlockForTest = {
  id: string;
  gridX: number;
  gridY: number;
  category: TestCategory;
  priceCents: number;
};

function isAuthorized(secretFromUrl: string | undefined) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return true;
  return secretFromUrl === secret;
}

function areaLabel(value: string | null | undefined) {
  if (value === "SOLIDARITY" || value === "PREMIUM" || value === "GOLD" || value === "GRAND_CENTER") {
    return getAreaName(value as AreaKey);
  }

  return value || "Área";
}

function normalizeTestCategory(value: string): TestCategory {
  if (value === "PREMIUM") return "PREMIUM";
  if (value === "GOLD") return "GOLD";
  if (value === "GRAND_CENTER") return "GRAND_CENTER";
  return "SOLIDARITY";
}

function legacyKindFromCategory(category: TestCategory): LegacyKind {
  // O banco atual ainda usa GOLD/PREMIUM/SOLIDARITY para Transaction/Placement.
  // A categoria real do bloco continua sendo GRAND_CENTER quando for Tom Delfim.
  if (category === "GRAND_CENTER") return "GOLD";
  return category;
}

function areaFromPlacement(placement: any) {
  return areaLabel(placement?.blocks?.[0]?.category || placement?.kind);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function saveTestImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) return null;
  if (!file.size) return null;
  if (!file.type.startsWith("image/")) return null;

  const extension = file.type.includes("webp") ? "webp" : file.type.includes("png") ? "png" : "jpg";
  const filename = `teste-${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filepath = path.join(uploadDir, filename);
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  return `/uploads/${filename}`;
}

async function updateBrandLogo(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  if (!isAuthorized(secret)) return;

  const file = formData.get("logo");
  if (!(file instanceof File) || !file.size) return;
  if (file.type !== "image/png") return;

  const uploadDir = path.join(process.cwd(), "public");
  const filepath = path.join(uploadDir, "logo-mural-29.png");
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/transparencia");
}

async function findAvailableRectangle(category: TestCategory, width: number, height: number) {
  const blocks: AvailableBlockForTest[] = await prisma.block.findMany({
    where: {
      category,
      gridX: { lt: GRID_COLS },
      gridY: { lt: GRID_ROWS },
      status: "AVAILABLE",
      available: true,
    },
    select: {
      id: true,
      gridX: true,
      gridY: true,
      category: true,
      priceCents: true,
    },
    orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
    take: 29000,
  });

  const byCoord = new Map(blocks.map((block) => [`${block.gridX}:${block.gridY}`, block]));

  for (const block of blocks) {
    const selected: AvailableBlockForTest[] = [];

    for (let y = block.gridY; y < block.gridY + height; y++) {
      for (let x = block.gridX; x < block.gridX + width; x++) {
        const found = byCoord.get(`${x}:${y}`);
        if (found) selected.push(found);
      }
    }

    if (selected.length === width * height) return selected;
  }

  return [];
}

async function createTestArea(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  if (!isAuthorized(secret)) return;

  const category = normalizeTestCategory(String(formData.get("category") || "SOLIDARITY"));
  const width = category === "SOLIDARITY" ? 1 : Math.max(1, Math.min(8, Number(formData.get("width") || (category === "GRAND_CENTER" ? 3 : 2))));
  const height = category === "SOLIDARITY" ? 1 : Math.max(1, Math.min(8, Number(formData.get("height") || (category === "GRAND_CENTER" ? 3 : 2))));
  const imageUrl = category === "SOLIDARITY" ? null : await saveTestImage(formData.get("image"));
  const blocks = await findAvailableRectangle(category, width, height);

  if (blocks.length !== width * height) return;

  const now = new Date();
  const uniqueId = Date.now();
  const kind = legacyKindFromCategory(category);
  const testName = category === "GRAND_CENTER" ? "Teste Tom Delfim Moreira" : category === "SOLIDARITY" ? siteConfig.testData.supporterName : siteConfig.testData.brandName;
  const fillColor = category === "SOLIDARITY" ? siteConfig.mosaicColors[0].value : category === "GRAND_CENTER" ? "#c026d3" : category === "GOLD" ? "#f59e0b" : "#0f172a";

  await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        name: testName,
        publicName: testName,
        email: `teste-${uniqueId}@example.com`,
        whatsapp: "11999999999",
        cpfLast4: "0000",
        totalApprovedCents: 0,
        isTest: true,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        kind,
        status: "APPROVED",
        userId: user.id,
        subtotalCents: 0,
        operatorFeeCents: 0,
        totalPaidCents: 0,
        creatorShareCents: 0,
        hospitalShareCents: 0,
        placementTitle: testName,
        placementDescription: siteConfig.testData.description,
        placementRedirectUrl: siteConfig.testData.link,
        placementImageUrl: imageUrl,
        placementFillColor: fillColor,
        mpExternalReference: `teste-${uniqueId}`,
        mpStatus: "test",
        mpStatusDetail: "admin_test_area",
        approvedAt: now,
        paidAt: now,
        isTest: true,
      },
    });

    const minX = Math.min(...blocks.map((block) => block.gridX));
    const maxX = Math.max(...blocks.map((block) => block.gridX));
    const minY = Math.min(...blocks.map((block) => block.gridY));
    const maxY = Math.max(...blocks.map((block) => block.gridY));

    const placement = await tx.placement.create({
      data: {
        kind,
        status: "ACTIVE",
        userId: user.id,
        transactionId: transaction.id,
        title: testName,
        description: siteConfig.testData.description,
        imageUrl,
        redirectUrl: siteConfig.testData.link,
        displayName: testName,
        textLabel: testName,
        fillColor,
        originX: minX,
        originY: minY,
        widthBlocks: maxX - minX + 1,
        heightBlocks: maxY - minY + 1,
        isTest: true,
      },
    });

    await tx.block.updateMany({
      where: { id: { in: blocks.map((block) => block.id) } },
      data: {
        status: "SOLD",
        available: false,
        ownerId: user.id,
        placementId: placement.id,
        currentTransactionId: transaction.id,
        reservationToken: null,
        reservedUntil: null,
      },
    });

    await tx.transactionBlock.createMany({
      data: blocks.map((block) => ({
        transactionId: transaction.id,
        blockId: block.id,
        gridX: block.gridX,
        gridY: block.gridY,
        category: block.category,
        priceCents: block.priceCents,
      })),
    });
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function deleteTestAreas(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const placementId = String(formData.get("placementId") || "");
  if (!isAuthorized(secret)) return;

  const where = placementId ? { id: placementId, isTest: true } : { isTest: true };
  const placements = await prisma.placement.findMany({ where, select: { id: true } });
  const placementIds = placements.map((placement) => placement.id);

  if (!placementIds.length) return;

  await prisma.$transaction(async (tx: any) => {
    await tx.block.updateMany({
      where: { placementId: { in: placementIds } },
      data: {
        status: "AVAILABLE",
        available: true,
        ownerId: null,
        placementId: null,
        currentTransactionId: null,
        reservationToken: null,
        reservedUntil: null,
      },
    });

    await tx.placement.deleteMany({ where: { id: { in: placementIds }, isTest: true } });
    await tx.transaction.deleteMany({ where: { isTest: true } });
    await tx.user.deleteMany({ where: { isTest: true } });
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function adminAction(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const action = String(formData.get("action") || "");
  const reportId = String(formData.get("reportId") || "");
  const placementId = String(formData.get("placementId") || "");
  const userId = String(formData.get("userId") || "");
  const reason = String(formData.get("reason") || "Ação administrativa manual.");

  if (!isAuthorized(secret)) return;

  if (action === "BLOCK_IMAGE" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: {
        imageUrl: null,
        imageStorageKey: null,
        placeholderReason: reason || "Imagem bloqueada pela moderação.",
        status: "IMAGE_BLOCKED",
      },
    });
    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
  }

  if (action === "BLOCK_LINK" && placementId) {
    await prisma.placement.update({ where: { id: placementId }, data: { linkDisabled: true } });
    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
  }

  if (action === "RELEASE_BLOCK" && placementId) {
    await prisma.$transaction(async (tx: any) => {
      await tx.block.updateMany({
        where: { placementId },
        data: {
          status: "AVAILABLE",
          available: true,
          ownerId: null,
          placementId: null,
          currentTransactionId: null,
          reservationToken: null,
          reservedUntil: null,
        },
      });
      await tx.placement.update({
        where: { id: placementId },
        data: {
          status: "REMOVED",
          imageUrl: null,
          redirectUrl: null,
          linkDisabled: true,
          placeholderReason: reason || "Tijolinho liberado pela moderação.",
        },
      });
      if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
    });
  }

  if (action === "BAN_USER" && userId) {
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id: userId }, data: { isBanned: true } });
      await tx.placement.updateMany({
        where: { userId },
        data: {
          status: "BANNED",
          imageUrl: null,
          redirectUrl: null,
          linkDisabled: true,
          description: null,
          placeholderReason: reason || "Comprador banido pela moderação.",
        },
      });
      if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "BANNED" } });
    });
  }

  if (action === "RESOLVE_REPORT" && reportId) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

function StatCard({ label, value, detail, tone = "slate" }: { label: string; value: string | number; detail?: string; tone?: "slate" | "green" | "yellow" | "red" | "blue" | "purple" }) {
  const styles = {
    slate: "bg-white text-slate-950",
    green: "bg-emerald-50 text-emerald-950",
    yellow: "bg-yellow-50 text-yellow-950",
    red: "bg-red-50 text-red-950",
    blue: "bg-blue-50 text-blue-950",
    purple: "bg-fuchsia-50 text-fuchsia-950",
  }[tone];

  return (
    <div className={`rounded-3xl p-4 shadow ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {detail && <p className="mt-1 text-xs font-bold opacity-70">{detail}</p>}
    </div>
  );
}

function ActionButton({ label, action, secret, reportId, placementId, userId, className }: { label: string; action: string; secret: string; reportId?: string | null; placementId?: string | null; userId?: string | null; className: string }) {
  return (
    <form action={adminAction} className="grid gap-2">
      <input type="hidden" name="secret" value={secret} />
      <input type="hidden" name="action" value={action} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      {placementId && <input type="hidden" name="placementId" value={placementId} />}
      {userId && <input type="hidden" name="userId" value={userId} />}
      <input name="reason" placeholder="Motivo interno" className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold" />
      <button type="submit" className={className}>{label}</button>
    </form>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const secret = params?.secret || "";
  const authorized = isAuthorized(secret);

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🔐</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Admin protegido</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Acesse usando <strong>/admin?secret=SUA_SENHA</strong>.</p>
          <Link href="/" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const todayStart = startOfToday();
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = addDays(todayStart, -7);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const now = new Date();

  const [
    totalSold,
    soldToday,
    soldWeek,
    soldMonth,
    totalBlocks,
    soldBlocks,
    availableBlocks,
    reservedBlocks,
    expiredReservations,
    pendingPayments,
    approvedToday,
    approvedWeek,
    approvedMonth,
    approvedTotal,
    latestTransactions,
    approvedTransactions,
    problemPayments,
    pendingReservations,
    contentQueue,
    reports,
    testPlacements,
    customers,
    byCategory,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { status: "APPROVED", isTest: false }, _sum: { totalPaidCents: true } }),
    prisma.transaction.aggregate({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: todayStart, lt: tomorrowStart } }, _sum: { totalPaidCents: true } }),
    prisma.transaction.aggregate({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: weekStart } }, _sum: { totalPaidCents: true } }),
    prisma.transaction.aggregate({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: monthStart } }, _sum: { totalPaidCents: true } }),
    prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS } } }),
    prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS }, status: "SOLD", placement: { isTest: false } } }),
    prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS }, available: true } }),
    prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS }, status: "RESERVED" } }),
    prisma.block.count({ where: { gridX: { lt: GRID_COLS }, gridY: { lt: GRID_ROWS }, status: "RESERVED", reservedUntil: { lt: now } } }),
    prisma.transaction.count({ where: { status: "PENDING", isTest: false } }),
    prisma.transaction.count({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.transaction.count({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: weekStart } } }),
    prisma.transaction.count({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: monthStart } } }),
    prisma.transaction.count({ where: { status: "APPROVED", isTest: false } }),
    prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: true, items: true } }),
    prisma.transaction.findMany({ where: { status: "APPROVED", isTest: false }, orderBy: { approvedAt: "desc" }, take: 10, include: { user: true, items: true } }),
    prisma.transaction.findMany({ where: { status: { in: ["REJECTED", "CANCELLED", "EXPIRED", "REFUNDED"] }, isTest: false }, orderBy: { updatedAt: "desc" }, take: 10, include: { user: true, items: true } }),
    prisma.block.findMany({ where: { status: "RESERVED" }, orderBy: { reservedUntil: "asc" }, take: 20, include: { owner: true } }),
    prisma.placement.findMany({ where: { status: "ACTIVE", isTest: false }, orderBy: { createdAt: "desc" }, take: 25, include: { user: true, blocks: { take: 1 } } }),
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { block: true, placement: { include: { user: true } } } }),
    prisma.placement.findMany({ where: { isTest: true }, orderBy: { createdAt: "desc" }, take: 30, include: { blocks: { take: 1 } } }),
    prisma.user.findMany({ where: { isTest: false }, orderBy: { totalApprovedCents: "desc" }, take: 12, include: { _count: { select: { transactions: true, placements: true } } } }),
    Promise.all((["SOLIDARITY", "PREMIUM", "GOLD", "GRAND_CENTER"] as const).map(async (category) => ({
      category,
      sold: await prisma.block.count({ where: { category, status: "SOLD", placement: { isTest: false } } }),
      reserved: await prisma.block.count({ where: { category, status: "RESERVED" } }),
      available: await prisma.block.count({ where: { category, available: true } }),
    }))),
  ]);

  const openReports = reports.filter((report) => report.status === "OPEN" || report.status === "REVIEWING").length;
  const publishedUnreviewed = contentQueue.length;
  const alerts = [
    expiredReservations ? `${expiredReservations} reserva(s) vencida(s) precisam ser liberadas.` : null,
    openReports ? `${openReports} denúncia(s) aberta(s).` : null,
    pendingPayments ? `${pendingPayments} pagamento(s) ainda pendente(s).` : null,
    problemPayments.length ? `${problemPayments.length} pagamento(s) com status problemático recente.` : null,
    publishedUnreviewed ? `${publishedUnreviewed} conteúdo(s) publicado(s) sem revisão.` : null,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <a href="#dashboard" className="rounded-full bg-slate-950 px-3 py-2 text-white">Dashboard</a>
            <a href="#pedidos" className="rounded-full bg-white px-3 py-2 text-slate-700">Pedidos</a>
            <a href="#moderacao" className="rounded-full bg-white px-3 py-2 text-slate-700">Moderação</a>
            <a href="#testes" className="rounded-full bg-white px-3 py-2 text-slate-700">Testes</a>
            <a href="#clientes" className="rounded-full bg-white px-3 py-2 text-slate-700">Clientes</a>
          </div>
        </div>

        <section id="dashboard" className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Painel de avião</p>
          <h1 className="mt-2 text-3xl font-black">Admin V2 — Operação Mural29</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Visão rápida de vendas, blocos, reservas, pagamentos, conteúdo publicado sem revisão e denúncias. A estrutura do grid permanece intocada.</p>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatCard label="Vendas hoje" value={formatMoney(soldToday._sum.totalPaidCents || 0)} detail={`${approvedToday} pagamento(s)`} tone="green" />
          <StatCard label="Vendas 7 dias" value={formatMoney(soldWeek._sum.totalPaidCents || 0)} detail={`${approvedWeek} pagamento(s)`} tone="blue" />
          <StatCard label="Vendas mês" value={formatMoney(soldMonth._sum.totalPaidCents || 0)} detail={`${approvedMonth} pagamento(s)`} tone="purple" />
          <StatCard label="Total vendido" value={formatMoney(totalSold._sum.totalPaidCents || 0)} detail={`${approvedTotal} pedido(s)`} tone="slate" />
          <StatCard label="Blocos vendidos" value={soldBlocks} detail={`${totalBlocks} no mural`} tone="yellow" />
          <StatCard label="Reservas" value={reservedBlocks} detail={`${expiredReservations} vencida(s)`} tone={expiredReservations ? "red" : "slate"} />
          <StatCard label="Disponíveis" value={availableBlocks} detail="prontos para venda" tone="green" />
          <StatCard label="Pagamentos pendentes" value={pendingPayments} detail="aguardando PIX" tone="yellow" />
          <StatCard label="Publicados sem revisão" value={publishedUnreviewed} detail="fila de moderação" tone="purple" />
          <StatCard label="Denúncias abertas" value={openReports} detail="precisam análise" tone={openReports ? "red" : "slate"} />
          <StatCard label="Pedidos com erro" value={problemPayments.length} detail="recusado/cancelado/expirado" tone={problemPayments.length ? "red" : "slate"} />
          <StatCard label="Testes/dev" value={testPlacements.length} detail="não misturar com venda real" tone="blue" />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Alertas rápidos</h2>
            <div className="mt-4 space-y-2">
              {alerts.length === 0 && <p className="rounded-2xl bg-green-50 p-3 text-sm font-black text-green-800">Tudo saudável por enquanto.</p>}
              {alerts.map((alert) => <p key={alert} className="rounded-2xl bg-red-50 p-3 text-sm font-black text-red-800">⚠️ {alert}</p>)}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Áreas que mais vendem</h2>
            <div className="mt-4 grid gap-2">
              {byCategory.sort((a, b) => b.sold - a.sold).map((area) => (
                <div key={area.category} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{areaLabel(area.category)}</p>
                    <p className="text-xs font-black text-slate-500">{area.sold} vendidos</p>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{area.available} disponíveis • {area.reserved} reservados</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Logo do site</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Troca rápida do logo</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Envie PNG com fundo transparente. Ele substitui o logo usado no cabeçalho.</p>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <img src={siteConfig.brand.logoUrl || "/logo-mural-29.png"} alt="Logo atual" className="h-16 w-auto object-contain" />
            </div>
          </div>

          <form action={updateBrandLogo} encType="multipart/form-data" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-xl">
            <input type="hidden" name="secret" value={secret} />
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Atualização visual</p>
            <h3 className="mt-2 text-lg font-black text-emerald-950">Enviar novo logo</h3>
            <input name="logo" type="file" accept="image/png" className="mt-4 w-full rounded-2xl bg-white px-3 py-3 text-sm font-bold" />
            <button type="submit" className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">Salvar logo PNG</button>
          </form>
        </section>

        <section id="testes" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Área de testes/dev</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">Crie áreas fictícias sem PIX. Dados de teste ficam marcados como teste.</p>
            </div>
            <form action={deleteTestAreas}>
              <input type="hidden" name="secret" value={secret} />
              <button type="submit" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-700">Excluir todos os testes</button>
            </form>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {([
              ["SOLIDARITY", "Teste Copacabana", "green", 1, 1],
              ["PREMIUM", "Teste Ipanema", "yellow", 2, 2],
              ["GOLD", "Teste Leblon", "blue", 2, 2],
              ["GRAND_CENTER", "Teste Tom Delfim", "fuchsia", 3, 3],
            ] as const).map(([category, title, color, width, height]) => (
              <form key={category} action={createTestArea} encType="multipart/form-data" className={`rounded-3xl border p-4 ${color === "green" ? "border-green-200 bg-green-50" : color === "yellow" ? "border-yellow-200 bg-yellow-50" : color === "blue" ? "border-blue-200 bg-blue-50" : "border-fuchsia-200 bg-fuchsia-50"}`}>
                <input type="hidden" name="secret" value={secret} />
                <input type="hidden" name="category" value={category} />
                <h3 className="font-black text-slate-950">{title}</h3>
                {category !== "SOLIDARITY" && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <input name="width" defaultValue={width} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
                      <input name="height" defaultValue={height} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
                    </div>
                    <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
                  </>
                )}
                <button type="submit" className="mt-4 w-full rounded-2xl bg-slate-950 py-3 text-xs font-black text-white">Criar teste</button>
              </form>
            ))}
          </div>

          {testPlacements.length > 0 && (
            <div className="mt-5 space-y-2">
              {testPlacements.map((placement) => (
                <article key={placement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{placement.title || placement.displayName}</p>
                    <p className="text-xs font-bold text-slate-500">{areaFromPlacement(placement)} • TESTE/DEV</p>
                  </div>
                  <form action={deleteTestAreas}>
                    <input type="hidden" name="secret" value={secret} />
                    <input type="hidden" name="placementId" value={placement.id} />
                    <button type="submit" className="rounded-full bg-red-50 px-3 py-2 text-[10px] font-black text-red-700">Excluir teste</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="pedidos" className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Últimas compras</h2>
            <div className="mt-4 space-y-3">
              {latestTransactions.map((transaction) => (
                <article key={transaction.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-950">{transaction.user.publicName || transaction.user.name}</p>
                      <p className="text-xs font-bold text-slate-500">{areaLabel(transaction.items[0]?.category || transaction.kind)} • {transaction.status} • {transaction.items.length} tijolinho(s)</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">MP: {transaction.mpPaymentId || "sem payment_id"}</p>
                    </div>
                    <p className="text-sm font-black text-green-700">{formatMoney(transaction.totalPaidCents)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Pagamentos aprovados recentes</h2>
            <div className="mt-4 space-y-3">
              {approvedTransactions.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum pagamento aprovado ainda.</p>}
              {approvedTransactions.map((transaction) => (
                <article key={transaction.id} className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-950">{transaction.user.publicName || transaction.user.name} • {formatMoney(transaction.totalPaidCents)}</p>
                  <p className="text-xs font-bold text-emerald-700">{transaction.items.length} tijolinho(s) • {transaction.approvedAt?.toLocaleString("pt-BR") || "sem data"}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Reservas</h2>
            <div className="mt-4 space-y-3">
              {pendingReservations.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma reserva pendente.</p>}
              {pendingReservations.map((block) => (
                <article key={block.id} className={`rounded-2xl p-4 ${block.reservedUntil && block.reservedUntil < now ? "bg-red-50" : "bg-yellow-50"}`}>
                  <p className="text-sm font-black text-slate-950">x{block.gridX}/y{block.gridY} • {areaLabel(block.category)}</p>
                  <p className="text-xs font-bold text-slate-600">{block.owner?.name || "Sem comprador"} • vence {block.reservedUntil?.toLocaleString("pt-BR")}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Pagamentos problemáticos</h2>
            <div className="mt-4 space-y-3">
              {problemPayments.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum problema recente.</p>}
              {problemPayments.map((transaction) => (
                <article key={transaction.id} className="rounded-2xl bg-red-50 p-4">
                  <p className="text-sm font-black text-red-950">{transaction.status} • {transaction.user.publicName || transaction.user.name}</p>
                  <p className="text-xs font-bold text-red-700">{formatMoney(transaction.totalPaidCents)} • MP {transaction.mpStatus || "sem status"}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="moderacao" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Publicados sem revisão</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">Nesta versão, todo conteúdo ativo entra aqui para revisão posterior.</p>
          <div className="mt-4 space-y-3">
            {contentQueue.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum conteúdo publicado.</p>}
            {contentQueue.map((placement) => (
              <article key={placement.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{areaFromPlacement(placement)} • {placement.status}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{placement.title || placement.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-600">{placement.description || "Sem descrição"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Imagem: {placement.imageUrl ? "sim" : "não"} • Link: {placement.redirectUrl && !placement.linkDisabled ? "ativo" : "não"}</p>
                  </div>
                  <div className="grid min-w-48 gap-2">
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} placementId={placement.id} className="rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} placementId={placement.id} className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Banir comprador" action="BAN_USER" secret={secret} placementId={placement.id} userId={placement.userId} className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Denúncias públicas</h2>
          <div className="mt-4 space-y-3">
            {reports.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma denúncia ainda.</p>}
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{report.status} • tijolinho x{report.block.gridX}/y{report.block.gridY}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{report.placement?.title || report.placement?.displayName || "Tijolinho denunciado"}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{report.reason}</p>
                  </div>
                  <div className="grid min-w-48 gap-2">
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Liberar tijolinho" action="RELEASE_BLOCK" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Banir comprador" action="BAN_USER" secret={secret} reportId={report.id} placementId={report.placementId} userId={report.placement?.userId} className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Resolver" action="RESOLVE_REPORT" secret={secret} reportId={report.id} className="rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="clientes" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Clientes</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {customers.map((customer) => (
              <article key={customer.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">{customer.publicName || customer.name}</p>
                <p className="text-xs font-bold text-slate-500">{customer.email || "sem e-mail"} • {customer.whatsapp || "sem WhatsApp"}</p>
                <p className="mt-1 text-xs font-black text-emerald-700">{formatMoney(customer.totalApprovedCents)} • {customer._count.transactions} pedido(s) • {customer._count.placements} conteúdo(s)</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Webhooks Mercado Pago</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">Controle de pagamento</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">A confirmação real segue no backend/webhook. O botão “já paguei” não aprova manualmente.</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Logs/Auditoria</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">Base operacional</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">As ações críticas já pedem motivo interno. A próxima etapa é evoluir para audit log dedicado por usuário admin.</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Reembolso/Chargeback</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">Sem fluxo público</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">O admin acompanha status problemáticos internamente, sem prometer reembolso público.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
