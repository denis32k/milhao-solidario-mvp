import Link from "next/link";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateTime, money, safeValueQuery } from "@/lib/admin";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type BlockPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const reasonLabels: Record<string, string> = {
  IMAGEM_IMPROPRIA: "Imagem imprópria",
  LINK_SUSPEITO: "Link suspeito",
  GOLPE_FRAUDE: "Golpe/fraude",
  USO_INDEVIDO_MARCA: "Uso indevido de marca",
  CONTEUDO_OFENSIVO: "Conteúdo ofensivo",
  OUTRO: "Outro motivo",
};

function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const filename = url.split("/").pop();
    return filename ? `/api/uploads/file/${encodeURIComponent(filename)}` : url;
  }
  return url;
}

function normalizeExternalUrl(url: string | null | undefined) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function statusLabel(status: string | null | undefined) {
  if (status === "SOLD") return "Publicado";
  if (status === "RESERVED") return "Reservado";
  if (status === "BLOCKED") return "Bloqueado";
  if (status === "AVAILABLE") return "Disponível";
  return status || "Status não informado";
}

function getRankTheme(rank: number | null, category: string) {
  if (rank === 1) return { label: "🥇 1º lugar", box: "border-yellow-300 bg-gradient-to-br from-yellow-50 via-white to-amber-100", badge: "bg-yellow-400 text-yellow-950" };
  if (rank === 2) return { label: "🥈 2º lugar", box: "border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-200", badge: "bg-slate-300 text-slate-950" };
  if (rank === 3) return { label: "🥉 3º lugar", box: "border-orange-300 bg-gradient-to-br from-orange-50 via-white to-orange-100", badge: "bg-orange-300 text-orange-950" };
  if (rank && rank >= 4 && rank <= 10) return { label: "VIP Top 10", box: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-white", badge: "bg-fuchsia-600 text-white" };
  if (category === "GRAND_CENTER") return { label: "Tom Delfim", box: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-white", badge: "bg-fuchsia-600 text-white" };
  if (category === "GOLD") return { label: "Leblon", box: "border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-white", badge: "bg-yellow-400 text-yellow-950" };
  if (category === "PREMIUM") return { label: "Ipanema", box: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white", badge: "bg-orange-500 text-white" };
  return { label: "Mural29", box: "border-slate-200 bg-white", badge: "bg-slate-950 text-white" };
}

async function getOwnerRank(ownerId: string | null | undefined) {
  if (!ownerId) return null;
  const topOwners = await safeValueQuery<Array<{ id: string }>>(() =>
    prisma.user.findMany({
      where: { totalApprovedCents: { gt: 0 } },
      select: { id: true },
      orderBy: { totalApprovedCents: "desc" },
      take: 10,
    }),
    []
  );
  const index = topOwners.findIndex((owner) => owner.id === ownerId);
  return index >= 0 ? index + 1 : null;
}

async function getIpHash() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const realIp = h.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

async function submitReport(formData: FormData) {
  "use server";

  const blockId = String(formData.get("blockId") || "").trim();
  const reasonCode = String(formData.get("reasonCode") || "OUTRO").trim();
  const reason = reasonLabels[reasonCode] || "Outro motivo";
  const message = String(formData.get("message") || "").trim().slice(0, 1200);
  const reporterEmail = String(formData.get("reporterEmail") || "").trim().slice(0, 120) || null;

  if (!blockId || (!message && !reason)) {
    redirect(`/bloco/${encodeURIComponent(blockId)}?error=denuncia#denunciar`);
  }

  const block = await prisma.block.findUnique({
    where: { id: blockId },
    select: { id: true, placementId: true },
  });

  if (!block) {
    redirect(`/bloco/${encodeURIComponent(blockId)}?error=nao_encontrado#denunciar`);
  }

  await (prisma as any).report.create({
    data: {
      blockId: block.id,
      placementId: block.placementId,
      reasonCode,
      reason,
      message: message || null,
      reporterEmail,
      reporterIpHash: await getIpHash(),
      status: "OPEN",
    },
  });

  redirect(`/bloco/${encodeURIComponent(blockId)}?reported=1#denunciar`);
}

export default async function PublicBlockPage({ params, searchParams }: BlockPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const block = await safeValueQuery(() =>
    prisma.block.findUnique({
      where: { id },
      include: {
        owner: true,
        placement: { include: { transaction: true } },
        currentTransaction: true,
      },
    }),
    null
  );

  if (!block) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8">
        <div className="pixel-panel mx-auto max-w-md p-6 text-center">
          <div className="text-5xl">🧱</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Tijolinho não encontrado</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">Esse espaço não existe ou não está disponível para visualização.</p>
          <Link href="/" className="pixel-btn pixel-btn--dark mt-5 flex justify-center !rounded-2xl !py-4 !text-sm">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const placement = (block as any).placement;
  const rank = await getOwnerRank((block as any).ownerId || (block as any).owner?.id);
  const theme = getRankTheme(rank, (block as any).category);
  const hidden = !placement || placement.status !== "ACTIVE" || placement.reviewStatus === "HIDDEN_BY_ADMIN";
  const imageBlocked = placement?.status === "IMAGE_BLOCKED" || placement?.placeholderReason;
  const displayName = placement?.displayName || placement?.title || (block as any).owner?.publicName || "Espaço comprado";
  const isWaitingPersonalization = displayName === "Espaço comprado";
  const reported = query.reported === "1";
  const error = query.error;

  return (
    <main className="min-h-screen bg-transparent px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="pixel-btn pixel-btn--light mb-5 !rounded-2xl !px-4 !py-2 !text-sm">← Voltar ao mural</Link>

        <section className={`rounded-[2rem] border-2 p-5 shadow-xl ${theme.box}`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow md:h-48 md:w-48">
              {!hidden && placement?.imageUrl && !imageBlocked ? <img src={normalizeImageUrl(placement.imageUrl)} alt={displayName} className="h-full w-full object-cover" /> : <span className="px-6 text-center text-4xl">🧱</span>}
            </div>
            <div className="min-w-0 flex-1">
              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase ${theme.badge}`}>{theme.label}</span>
              <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950">{hidden ? "Conteúdo em análise" : displayName}</h1>
              <p className="mt-2 text-sm font-bold text-slate-600">{getAreaName((block as any).category)} • Coordenada x{(block as any).gridX}/y{(block as any).gridY}</p>
              {isWaitingPersonalization && !hidden && <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm font-bold leading-relaxed text-slate-600">Espaço comprado. Aguardando personalização do comprador.</p>}
              {hidden && <p className="mt-3 rounded-2xl bg-yellow-50 p-3 text-sm font-bold leading-relaxed text-yellow-800">Este conteúdo está oculto, bloqueado ou ainda em análise.</p>}
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {!hidden && placement?.redirectUrl && !placement?.linkDisabled ? (
                  <a href={normalizeExternalUrl(placement.redirectUrl)} target="_blank" rel="noopener noreferrer" className="pixel-btn pixel-btn--dark justify-center !rounded-2xl !py-3 !text-xs">Abrir link</a>
                ) : (
                  <div className="rounded-2xl bg-white/70 py-3 text-center text-xs font-black text-slate-500">Link indisponível</div>
                )}
                <a href="#denunciar" className="pixel-btn pixel-btn--red justify-center !rounded-2xl !py-3 !text-xs">Denunciar</a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="pixel-card p-4"><p className="text-xs font-black uppercase text-slate-500">Área</p><p className="mt-1 text-lg font-black text-slate-950">{getAreaName((block as any).category)}</p></div>
          <div className="pixel-card p-4"><p className="text-xs font-black uppercase text-slate-500">Status</p><p className="mt-1 text-lg font-black text-slate-950">{statusLabel((block as any).status)}</p></div>
          <div className="pixel-card p-4"><p className="text-xs font-black uppercase text-slate-500">Valor</p><p className="mt-1 text-lg font-black text-slate-950">{money((block as any).priceCents)}</p></div>
        </section>

        <section id="denunciar" className="pixel-panel mt-5 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-red-600">Denúncia pública</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Denunciar este tijolinho</h2>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Use este canal para imagem imprópria, link suspeito, golpe, uso indevido de marca ou conteúdo ofensivo.</p>

          {reported && <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">Denúncia enviada. Obrigado por ajudar a manter o mural seguro.</div>}
          {error && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-800">Não foi possível enviar a denúncia. Confira o motivo e tente novamente.</div>}

          <form action={submitReport} className="mt-5 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="blockId" value={(block as any).id} />
            <select name="reasonCode" className="pixel-input md:col-span-2">
              {Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea name="message" rows={4} placeholder="Explique rapidamente o problema encontrado" className="pixel-input min-h-[120px] resize-none md:col-span-2" />
            <input name="reporterEmail" type="email" placeholder="Seu e-mail opcional" className="pixel-input" />
            <button className="pixel-btn pixel-btn--red w-full !rounded-2xl !py-4 !text-sm">Enviar denúncia</button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs font-bold text-slate-400">Publicado em: {dateTime(placement?.createdAt || (block as any).updatedAt)}</p>
      </div>
    </main>
  );
}
