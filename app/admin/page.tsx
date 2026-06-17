import Link from "next/link";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { getAreaName, siteConfig, type AreaKey } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{ secret?: string }>;

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

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


type TestCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

type AvailableBlockForTest = {
  id: string;
  gridX: number;
  gridY: number;
  category: TestCategory;
  priceCents: number;
};

function normalizeTestCategory(value: string): TestCategory {
  if (value === "PREMIUM") return "PREMIUM";
  if (value === "GOLD") return "GOLD";
  if (value === "GRAND_CENTER") return "GRAND_CENTER";
  return "SOLIDARITY";
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

    if (selected.length === width * height) {
      return selected;
    }
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
  const imageUrl = await saveTestImage(formData.get("image"));
  const blocks = await findAvailableRectangle(category, width, height);

  if (blocks.length !== width * height) {
    return;
  }

  const now = new Date();
  const uniqueId = Date.now();
  const testName = category === "SOLIDARITY" ? siteConfig.testData.supporterName : siteConfig.testData.brandName;
  const fillColor = category === "SOLIDARITY" ? siteConfig.mosaicColors[0].value : category === "GOLD" ? "#f59e0b" : category === "GRAND_CENTER" ? "#c026d3" : "#0f172a";
  const kind = category;

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
  if (!isAuthorized(secret)) return;

  const placementId = String(formData.get("placementId") || "");
  const where = placementId ? { id: placementId, isTest: true } : { isTest: true };
  const placements = await prisma.placement.findMany({
    where,
    select: { id: true, transactionId: true, userId: true },
  });

  if (!placements.length) return;

  const placementIds = placements.map((placement) => placement.id);
  const transactionIds = placements.map((placement) => placement.transactionId);
  const userIds = placements.map((placement) => placement.userId);

  await prisma.$transaction(async (tx: any) => {
    await tx.report.deleteMany({ where: { placementId: { in: placementIds } } });
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
    await tx.transaction.deleteMany({ where: { id: { in: transactionIds }, isTest: true } });
    await tx.user.deleteMany({ where: { id: { in: userIds }, isTest: true } });
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

  if (!isAuthorized(secret)) {
    return;
  }

  if (action === "BLOCK_IMAGE" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: {
        imageUrl: null,
        imageStorageKey: null,
        placeholderReason: "Imagem bloqueada pela moderação.",
        status: "IMAGE_BLOCKED",
      },
    });

    if (reportId) {
      await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    }
  }

  if (action === "BLOCK_LINK" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: { linkDisabled: true },
    });

    if (reportId) {
      await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    }
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
          placeholderReason: "Tijolinho liberado pela moderação.",
        },
      });

      if (reportId) {
        await tx.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
      }
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
          placeholderReason: "Comprador banido pela moderação.",
        },
      });

      if (reportId) {
        await tx.report.update({ where: { id: reportId }, data: { status: "BANNED" } });
      }
    });
  }

  if (action === "RESOLVE_REPORT" && reportId) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

function ActionButton({
  label,
  action,
  secret,
  reportId,
  placementId,
  userId,
  className,
}: {
  label: string;
  action: string;
  secret: string;
  reportId?: string | null;
  placementId?: string | null;
  userId?: string | null;
  className: string;
}) {
  return (
    <form action={adminAction}>
      <input type="hidden" name="secret" value={secret} />
      <input type="hidden" name="action" value={action} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      {placementId && <input type="hidden" name="placementId" value={placementId} />}
      {userId && <input type="hidden" name="userId" value={userId} />}
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
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Acesse usando <strong>/admin?secret=SUA_SENHA</strong>.
          </p>
          <Link href="/" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const [
    latestTransactions,
    soldBlocks,
    pendingReservations,
    premiumPlacements,
    reports,
    bannedUsers,
    testPlacements,
  ] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: true, items: true },
    }),
    prisma.block.count({ where: { status: "SOLD" } }),
    prisma.block.findMany({
      where: { status: "RESERVED" },
      orderBy: { reservedUntil: "asc" },
      take: 20,
      include: { owner: true },
    }),
    prisma.placement.findMany({
      where: { kind: { in: ["PREMIUM", "GOLD", "GRAND_CENTER"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true, blocks: { take: 1 } },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        block: true,
        placement: { include: { user: true } },
      },
    }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.placement.findMany({
      where: { isTest: true },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { blocks: { take: 1 } },
    }),
  ]);

  const openReports = reports.filter((report) => report.status === "OPEN" || report.status === "REVIEWING").length;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>

        <section className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Painel admin</p>
          <h1 className="mt-2 text-3xl font-black">Admin Mural 29</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Compras, reservas, áreas do mural, Tom Delfim Moreira, moderação, testes e denúncias em um lugar só.
          </p>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Tijolinhos vendidos</p><p className="mt-1 text-2xl font-black">{soldBlocks}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Reservas pendentes</p><p className="mt-1 text-2xl font-black">{pendingReservations.length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Denúncias abertas</p><p className="mt-1 text-2xl font-black">{openReports}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Usuários banidos</p><p className="mt-1 text-2xl font-black">{bannedUsers}</p></div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Logo do site</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Troca rápida do logo</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Envie aqui o logo em PNG com fundo transparente. Ele substitui o logo atual usado no cabeçalho do site.</p>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <img src={siteConfig.brand.logoUrl || "/logo-mural-29.png"} alt="Logo atual" className="h-16 w-auto object-contain" />
            </div>
          </div>

          <form action={updateBrandLogo} encType="multipart/form-data" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-xl">
            <input type="hidden" name="secret" value={secret} />
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Atualização visual</p>
            <h3 className="mt-2 text-lg font-black text-emerald-950">Enviar novo logo</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-800">Aceite preferencial: PNG transparente.</p>
            <input name="logo" type="file" accept="image/png" className="mt-4 w-full rounded-2xl bg-white px-3 py-3 text-sm font-bold" />
            <button type="submit" className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">Salvar novo logo</button>
          </form>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Testes do mural</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">Crie áreas fictícias direto no mural sem checkout e sem PIX.</p>
            </div>
            <form action={deleteTestAreas}>
              <input type="hidden" name="secret" value={secret} />
              <button type="submit" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-700">Excluir todos os testes</button>
            </form>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <form action={createTestArea} className="rounded-3xl border border-green-200 bg-green-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="SOLIDARITY" />
              <h3 className="font-black text-green-950">Teste Copacabana</h3>
              <p className="mt-1 text-xs font-bold text-green-700">Cria 1 tijolinho fictício.</p>
              <button type="submit" className="mt-4 w-full rounded-2xl bg-green-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-yellow-200 bg-yellow-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="PREMIUM" />
              <h3 className="font-black text-yellow-950">Teste Ipanema</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="2" className="rounded-xl border border-yellow-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="2" className="rounded-xl border border-yellow-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-yellow-500 py-3 text-xs font-black text-yellow-950">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="GOLD" />
              <h3 className="font-black text-blue-950">Teste Leblon</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="2" className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="2" className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-blue-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="GRAND_CENTER" />
              <h3 className="font-black text-fuchsia-950">Teste Tom Delfim Moreira</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="3" className="rounded-xl border border-fuchsia-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="3" className="rounded-xl border border-fuchsia-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-fuchsia-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>
          </div>

          {testPlacements.length > 0 && (
            <div className="mt-5 space-y-2">
              {testPlacements.map((placement) => (
                <article key={placement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{placement.title || placement.displayName}</p>
                    <p className="text-xs font-bold text-slate-500">{areaLabel(placement.kind)} • teste</p>
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

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Últimas compras</h2>
          <div className="mt-4 space-y-3">
            {latestTransactions.map((transaction) => (
              <article key={transaction.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">{transaction.user.publicName || transaction.user.name}</p>
                    <p className="text-xs font-bold text-slate-500">{areaLabel(transaction.kind)} • {transaction.status} • {transaction.items.length} tijolinho(s)</p>
                  </div>
                  <p className="text-sm font-black text-green-700">{money(transaction.totalPaidCents)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Reservas pendentes</h2>
          <div className="mt-4 space-y-3">
            {pendingReservations.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma reserva pendente.</p>}
            {pendingReservations.map((block) => (
              <article key={block.id} className="rounded-2xl bg-yellow-50 p-4">
                <p className="text-sm font-black text-yellow-950">x{block.gridX}/y{block.gridY} • {areaLabel(block.category)}</p>
                <p className="text-xs font-bold text-yellow-700">{block.owner?.name || "Sem comprador"} • vence {block.reservedUntil?.toLocaleString("pt-BR")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Ipanema e Leblon com imagem/link</h2>
          <div className="mt-4 space-y-3">
            {premiumPlacements.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum espaço de Ipanema, Leblon ou Tom Delfim Moreira vendido ainda.</p>}
            {premiumPlacements.map((placement) => (
              <article key={placement.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{areaLabel(placement.kind)} • {placement.status}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{placement.title || placement.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-600">{placement.description || "Sem descrição"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Imagem: {placement.imageUrl ? "sim" : "não"} • Link: {placement.redirectUrl && !placement.linkDisabled ? "ativo" : "não"}</p>
                  </div>
                  <div className="grid min-w-44 gap-2">
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} placementId={placement.id} className="rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} placementId={placement.id} className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Banir comprador" action="BAN_USER" secret={secret} placementId={placement.id} userId={placement.userId} className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Denúncias</h2>
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
                  <div className="grid min-w-44 gap-2">
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
      </div>
    </main>
  );
}
