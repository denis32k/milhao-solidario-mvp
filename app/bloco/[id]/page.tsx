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

function normalizeExternalUrl(url: string | null | undefined) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
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
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🧱</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Bloco não encontrado</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">Esse tijolinho não existe ou não está disponível para visualização.</p>
          <Link href="/" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const placement = (block as any).placement;
  const hidden = !placement || placement.status !== "ACTIVE" || placement.reviewStatus === "HIDDEN_BY_ADMIN";
  const imageBlocked = placement?.status === "IMAGE_BLOCKED" || placement?.placeholderReason;
  const reported = query.reported === "1";
  const error = query.error;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>

        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Tijolinho digital</p>
          <h1 className="mt-2 text-3xl font-black">{hidden ? "Conteúdo em análise" : placement.title || placement.displayName || "Bloco publicado"}</h1>
          <p className="mt-2 text-sm font-bold text-slate-300">{getAreaName((block as any).category)} • Coordenada x{(block as any).gridX}/y{(block as any).gridY}</p>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
          {hidden ? (
            <div className="rounded-3xl bg-yellow-50 p-5 text-center">
              <div className="text-4xl">👀</div>
              <h2 className="mt-3 text-xl font-black text-yellow-950">Conteúdo em análise</h2>
              <p className="mt-2 text-sm font-bold leading-relaxed text-yellow-800">Este bloco está oculto, bloqueado ou ainda sem conteúdo público liberado.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[160px_1fr]">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl bg-slate-100">
                {placement.imageUrl && !imageBlocked ? <img src={placement.imageUrl} alt="Conteúdo do bloco" className="h-full w-full object-cover" /> : <span className="px-4 text-center text-xs font-black text-slate-400">{imageBlocked ? "Imagem bloqueada" : "Sem imagem"}</span>}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Publicado no Mural29</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{placement.displayName || placement.title || "Sem nome público"}</h2>
                <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold leading-relaxed text-slate-600">{placement.description || "Sem descrição."}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {placement.redirectUrl && !placement.linkDisabled ? (
                    <a href={normalizeExternalUrl(placement.redirectUrl)} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-slate-950 py-3 text-center text-xs font-black text-white">Abrir link</a>
                  ) : (
                    <div className="rounded-2xl bg-slate-100 py-3 text-center text-xs font-black text-slate-500">Link indisponível</div>
                  )}
                  <a href="#denunciar" className="rounded-2xl bg-red-50 py-3 text-center text-xs font-black text-red-700">Denunciar este bloco</a>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black uppercase text-slate-500">Área</p><p className="mt-1 text-lg font-black text-slate-950">{getAreaName((block as any).category)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black uppercase text-slate-500">Status</p><p className="mt-1 text-lg font-black text-slate-950">{(block as any).status}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black uppercase text-slate-500">Valor</p><p className="mt-1 text-lg font-black text-slate-950">{money((block as any).priceCents)}</p></div>
        </section>

        <section id="denunciar" className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-red-600">Denúncia pública</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Denunciar este bloco</h2>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Use este canal para imagem imprópria, link suspeito, golpe, uso indevido de marca ou conteúdo ofensivo. A denúncia vai para análise no admin.</p>

          {reported && <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">Denúncia enviada. Obrigado por ajudar a manter o mural seguro.</div>}
          {error && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-800">Não foi possível enviar a denúncia. Confira o motivo e tente novamente.</div>}

          <form action={submitReport} className="mt-5 space-y-3">
            <input type="hidden" name="blockId" value={(block as any).id} />
            <select name="reasonCode" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950">
              {Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea name="message" rows={4} placeholder="Explique rapidamente o problema encontrado" className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
            <input name="reporterEmail" type="email" placeholder="Seu e-mail opcional" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
            <button className="w-full rounded-2xl bg-red-600 py-4 text-sm font-black text-white">Enviar denúncia</button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs font-bold text-slate-400">Publicado em: {dateTime(placement?.createdAt || (block as any).updatedAt)}</p>
      </div>
    </main>
  );
}
