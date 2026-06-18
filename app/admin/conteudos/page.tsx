import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const filename = url.split("/").pop();
    return filename ? `/api/uploads/file/${encodeURIComponent(filename)}` : url;
  }
  return url;
}

const reviewTabs = [
  { value: "ALL", label: "Todos" },
  { value: "PUBLISHED_NOT_REVIEWED", label: "Sem revisão" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "CHANGES_REQUESTED", label: "Com restrição" },
  { value: "HIDDEN_BY_ADMIN", label: "Ocultos" },
];

function contentState(placement: any) {
  const name = placement.displayName || placement.title || "";
  if (placement.status === "IMAGE_BLOCKED") return "Imagem bloqueada";
  if (placement.linkDisabled) return "Link bloqueado";
  if (placement.reviewStatus === "HIDDEN_BY_ADMIN") return "Oculto";
  if (name === "Espaço comprado" && !placement.imageUrl) return "Aguardando personalização";
  return "Publicado";
}

function linkLabel(placement: any) {
  if (placement.linkDisabled) return "bloqueado";
  if (placement.redirectUrl) return "ativo";
  return "sem link";
}

export default async function AdminConteudosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/conteudos" />;

  const review = normalizeSearch(params.review) || "ALL";
  const q = normalizeSearch(params.q);
  const where: any = { isTest: false };
  if (review !== "ALL") where.reviewStatus = review;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { redirectUrl: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { publicName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [placements, grouped] = await Promise.all([
    safeListQuery(() => (prisma as any).placement.findMany({ where, orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }], take: 140, include: { user: true, blocks: { take: 3, orderBy: [{ gridY: "asc" }, { gridX: "asc" }] }, transaction: true } })),
    safeListQuery(() => (prisma as any).placement.groupBy({ by: ["reviewStatus"], where: { isTest: false }, _count: { _all: true } })),
  ]);

  const countByReview = new Map(grouped.map((item: any) => [item.reviewStatus, item._count?._all || 0]));
  const tabs = reviewTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByReview.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByReview.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="conteudos" title="Moderação" description="Revisão compacta do novo padrão: nome público, imagem e link. O conteúdo entra rápido no mural e o admin corrige depois se precisar." />
        <AdminTabs secret={secret} basePath="/admin/conteudos" paramName="review" active={review} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_210px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar nome público, link, cliente ou e-mail" />
          <select name="review" defaultValue={review}><option value="ALL">Todos</option><option value="PUBLISHED_NOT_REVIEWED">Sem revisão</option><option value="APPROVED">Aprovados</option><option value="CHANGES_REQUESTED">Com restrição</option><option value="HIDDEN_BY_ADMIN">Ocultos</option></select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Nome, imagem e link no mural</h2><span className="text-xs font-bold text-slate-500">{placements.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Imagem</th><th className="text-left">Nome público</th><th className="text-left">Link</th><th className="text-left">Área / bloco</th><th className="text-left">Cliente</th><th className="text-left">Revisão</th><th className="text-left">Estado</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {placements.map((p: any) => {
                  const firstBlock = p.blocks?.[0];
                  const displayName = p.displayName || p.title || "Espaço comprado";
                  return (
                    <tr key={p.id}>
                      <td>{p.imageUrl ? <img src={normalizeImageUrl(p.imageUrl)} alt={displayName} className="h-10 w-10 rounded-lg object-cover" /> : <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-400">sem</span>}</td>
                      <td><p className="font-black text-slate-950">{displayName}</p><p className="text-[11px] font-bold text-slate-400">{shortId(p.id)}</p></td>
                      <td className="max-w-[220px]"><p className="truncate text-[11px] font-bold text-slate-600">{p.redirectUrl || "—"}</p><p className="text-[11px] font-black uppercase text-slate-400">{linkLabel(p)}</p></td>
                      <td><p className="font-bold text-slate-700">{firstBlock ? getAreaName(firstBlock.category) : getAreaName(p.kind)}</p><p className="text-[11px] font-bold text-slate-400">{firstBlock ? `x${firstBlock.gridX}/y${firstBlock.gridY}` : "sem bloco"}</p></td>
                      <td><p className="font-bold text-slate-800">{p.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{p.user?.email || ""}</p></td>
                      <td><AdminStatusBadge value={p.reviewStatus} /></td>
                      <td><p className="text-[11px] font-black text-slate-700">{contentState(p)}</p><p className="text-[11px] font-bold text-slate-400">{dateTime(p.createdAt)}</p></td>
                      <td><div className="admin-row-actions">{firstBlock && <Link href={`/bloco/${firstBlock.id}`} className="admin-row-link">Público</Link>}<Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(p.transactionId || p.id)}`, secret)} className="admin-row-link">Suporte</Link>{p.redirectUrl && <a href={p.redirectUrl} target="_blank" rel="noopener noreferrer" className="admin-row-link">Link</a>}</div></td>
                    </tr>
                  );
                })}
                {placements.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhum conteúdo encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
