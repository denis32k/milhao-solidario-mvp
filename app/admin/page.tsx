import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
    await prisma.$transaction(async (tx) => {
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
          placeholderReason: "Bloco liberado pela moderação.",
        },
      });

      if (reportId) {
        await tx.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
      }
    });
  }

  if (action === "BAN_USER" && userId) {
    await prisma.$transaction(async (tx) => {
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
          <Link href="/" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Voltar ao mapa</Link>
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
      where: { kind: { in: ["PREMIUM", "GOLD"] } },
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
  ]);

  const openReports = reports.filter((report) => report.status === "OPEN" || report.status === "REVIEWING").length;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mapa</Link>

        <section className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Painel do dono</p>
          <h1 className="mt-2 text-3xl font-black">Admin Milhão Solidário</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Compras, reservas, Premiums, Área Ouro e denúncias em um lugar só.
          </p>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Blocos vendidos</p><p className="mt-1 text-2xl font-black">{soldBlocks}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Reservas pendentes</p><p className="mt-1 text-2xl font-black">{pendingReservations.length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Denúncias abertas</p><p className="mt-1 text-2xl font-black">{openReports}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Usuários banidos</p><p className="mt-1 text-2xl font-black">{bannedUsers}</p></div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Últimas compras</h2>
          <div className="mt-4 space-y-3">
            {latestTransactions.map((transaction) => (
              <article key={transaction.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">{transaction.user.publicName || transaction.user.name}</p>
                    <p className="text-xs font-bold text-slate-500">{transaction.kind} • {transaction.status} • {transaction.items.length} bloco(s)</p>
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
                <p className="text-sm font-black text-yellow-950">x{block.gridX}/y{block.gridY} • {block.category}</p>
                <p className="text-xs font-bold text-yellow-700">{block.owner?.name || "Sem comprador"} • vence {block.reservedUntil?.toLocaleString("pt-BR")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Premiums e Área Ouro com imagem/link</h2>
          <div className="mt-4 space-y-3">
            {premiumPlacements.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum Premium/Área Ouro vendido ainda.</p>}
            {premiumPlacements.map((placement) => (
              <article key={placement.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{placement.kind} • {placement.status}</p>
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
                    <p className="text-xs font-black uppercase text-slate-500">{report.status} • bloco x{report.block.gridX}/y{report.block.gridY}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{report.placement?.title || report.placement?.displayName || "Bloco denunciado"}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{report.reason}</p>
                  </div>
                  <div className="grid min-w-44 gap-2">
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Liberar bloco" action="RELEASE_BLOCK" secret={secret} reportId={report.id} placementId={report.placementId} className="rounded-2xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950" />
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
