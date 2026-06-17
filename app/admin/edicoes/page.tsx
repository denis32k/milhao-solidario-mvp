import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminEdicoesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const status = normalizeSearch(params.status);
  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  const requests = await safeListQuery(() => (prisma as any).contentEditRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 80, include: { user: true, placement: { include: { user: true } } } }));
  return <main className="min-h-screen bg-slate-100 px-4 py-6"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="edicoes" title="Solicitações de edição" description="Toda edição futura fica pendente até aprovação. O conteúdo atual continua no mural." />
    <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_120px]"><input type="hidden" name="secret" value={secret}/><select name="status" defaultValue={status || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Todas</option><option value="PENDING">Pendentes</option><option value="APPROVED">Aprovadas</option><option value="REJECTED">Recusadas</option><option value="CANCELLED">Canceladas</option></select><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button></form>
    <section className="space-y-3">{requests.map((r: any) => <article key={r.id} className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">{r.status} • {dateTime(r.createdAt)}</p><h2 className="mt-1 text-xl font-black text-slate-950">{r.placement?.title || r.placement?.displayName || "Conteúdo"}</h2><p className="mt-2 text-sm font-bold text-slate-600">Cliente: {r.user?.name || "—"}</p><p className="mt-2 rounded-2xl bg-yellow-50 p-3 text-sm font-bold text-yellow-900">Motivo: {r.reason}</p><div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-2">{r.requestedTitle && <p>Novo título: {r.requestedTitle}</p>}{r.requestedDisplayName && <p>Novo nome público: {r.requestedDisplayName}</p>}{r.requestedDescription && <p>Nova descrição: {r.requestedDescription}</p>}{r.requestedRedirectUrl && <p>Novo link: {r.requestedRedirectUrl}</p>}{r.requestedImageUrl && <p>Nova imagem: {r.requestedImageUrl}</p>}</div>{r.adminNote && <p className="mt-2 text-xs font-bold text-slate-500">Decisão admin: {r.adminNote}</p>}</article>)}{requests.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhuma solicitação encontrada.</p>}</section>
  </div></main>;
}
