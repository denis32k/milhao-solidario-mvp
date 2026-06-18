import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const reviewTabs = [
  { value: "ALL", label: "Todos" },
  { value: "PUBLISHED_NOT_REVIEWED", label: "Sem revisão" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "CHANGES_REQUESTED", label: "Com restrição" },
  { value: "HIDDEN_BY_ADMIN", label: "Ocultos" },
];

export default async function AdminConteudosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const review = normalizeSearch(params.review) || "ALL";
  const q = normalizeSearch(params.q);
  const where: any = { isTest: false };
  if (review !== "ALL") where.reviewStatus = review;
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { redirectUrl: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }, { user: { publicName: { contains: q, mode: "insensitive" } } }];

  const [placements, grouped] = await Promise.all([
    safeListQuery(() => (prisma as any).placement.findMany({ where, orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }], take: 120, include: { user: true, blocks: { take: 3 }, transaction: true } })),
    safeListQuery(() => (prisma as any).placement.groupBy({ by: ["reviewStatus"], where: { isTest: false }, _count: { _all: true } })),
  ]);

  const countByReview = new Map(grouped.map((item: any) => [item.reviewStatus, item._count?._all || 0]));
  const tabs = reviewTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByReview.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByReview.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="conteudos" title="Moderação" description="Fila compacta de conteúdos publicados, aprovados, restritos e ocultos. A publicação automática continua, mas o admin revisa depois." />
        <AdminTabs secret={secret} basePath="/admin/conteudos" paramName="review" active={review} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_210px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar título, nome público, link ou cliente" />
          <select name="review" defaultValue={review}><option value="ALL">Todos</option><option value="PUBLISHED_NOT_REVIEWED">Sem revisão</option><option value="APPROVED">Aprovados</option><option value="CHANGES_REQUESTED">Com restrição</option><option value="HIDDEN_BY_ADMIN">Ocultos</option></select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Conteúdos no mural</h2><span className="text-xs font-bold text-slate-500">{placements.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Conteúdo</th><th className="text-left">Cliente</th><th className="text-left">Área</th><th className="text-left">Status</th><th className="text-left">Revisão</th><th className="text-left">Link</th><th className="text-left">Imagem</th><th className="text-left">Criado</th></tr></thead>
              <tbody>
                {placements.map((p: any) => {
                  const firstBlock = p.blocks?.[0];
                  return (
                    <tr key={p.id}>
                      <td><p className="font-black text-slate-950">{p.title || p.displayName || "Sem título"}</p><p className="max-w-[260px] truncate text-[11px] font-bold text-slate-400">{p.description || p.placeholderReason || "Sem descrição"}</p></td>
                      <td><p className="font-bold text-slate-800">{p.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{p.user?.email || ""}</p></td>
                      <td className="font-bold text-slate-700">{firstBlock ? getAreaName(firstBlock.category) : p.kind}</td>
                      <td><AdminStatusBadge value={p.status} /></td>
                      <td><AdminStatusBadge value={p.reviewStatus} /></td>
                      <td className="max-w-[190px] truncate text-[11px] font-bold text-slate-600">{p.linkDisabled ? "bloqueado" : p.redirectUrl || "sem link"}</td>
                      <td>{p.imageUrl ? <img src={p.imageUrl} alt="Conteúdo" className="h-9 w-9 rounded-lg object-cover" /> : <span className="text-[11px] font-bold text-slate-400">sem imagem</span>}</td>
                      <td><p className="whitespace-nowrap text-[11px] font-bold text-slate-500">{dateTime(p.createdAt)}</p><p className="text-[11px] font-bold text-slate-400">{shortId(p.transactionId)}</p></td>
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
