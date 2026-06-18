import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminConteudosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const review = normalizeSearch(params.review);
  const where: any = { isTest: false };
  if (review && review !== "ALL") where.reviewStatus = review;
  const placements = await safeListQuery(() => (prisma as any).placement.findMany({ where, orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }], take: 80, include: { user: true, blocks: { take: 4 }, transaction: true } }));
  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="conteudos" title="Conteúdos" description="Fila de publicados sem revisão, aprovados e ocultados. A publicação automática continua, mas o admin revisa depois." />
    <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_120px]"><input type="hidden" name="secret" value={secret}/><select name="review" defaultValue={review || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Todos</option><option value="PUBLISHED_NOT_REVIEWED">Publicados sem revisão</option><option value="APPROVED">Aprovados</option><option value="CHANGES_REQUESTED">Com restrição</option><option value="HIDDEN_BY_ADMIN">Ocultados</option></select><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button></form>
    <section className="space-y-3">{placements.map((p: any) => <article key={p.id} className="rounded-3xl bg-white p-5 shadow-xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-500">{p.kind} • {p.status} • {p.reviewStatus}</p><h2 className="mt-1 text-xl font-black text-slate-950">{p.title || p.displayName || "Sem título"}</h2><p className="mt-1 text-sm font-bold text-slate-500">Cliente: {p.user?.name || "—"} • {dateTime(p.createdAt)}</p><p className="mt-1 text-xs font-bold text-slate-500">Link: {p.linkDisabled ? "bloqueado" : p.redirectUrl || "sem link"}</p></div>{p.imageUrl && <img src={p.imageUrl} alt="Conteúdo" className="h-20 w-20 rounded-2xl object-cover"/>}</div><p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">{p.description || p.placeholderReason || "Sem descrição."}</p></article>)}{placements.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum conteúdo encontrado.</p>}</section>
  </div></main>;
}
