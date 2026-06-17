import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const type = normalizeSearch(params.type);
  const where: any = {};
  if (type) where.type = type;
  const logs = await safeListQuery(() => (prisma as any).adminAction.findMany({ where, orderBy: { createdAt: "desc" }, take: 120, include: { admin: true, report: true, block: true, editRequest: true, disputeCase: true } }));
  return <main className="min-h-screen bg-slate-100 px-4 py-6"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="logs" title="Logs e auditoria" description="Histórico administrativo. Ações importantes devem ficar registradas com motivo e entidade afetada." />
    <section className="space-y-3">{logs.map((log: any) => <article key={log.id} className="rounded-3xl bg-white p-4 shadow-xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-500">{log.type} • {dateTime(log.createdAt)}</p><h2 className="mt-1 text-lg font-black text-slate-950">{log.admin?.name || "Admin"}</h2><p className="mt-1 text-sm font-bold text-slate-600">{log.note || "Sem motivo registrado"}</p></div><div className="text-right text-[10px] font-bold text-slate-500"><p>placement: {shortId(log.placementId)}</p><p>block: {shortId(log.blockId)}</p><p>report: {shortId(log.reportId)}</p><p>edit: {shortId(log.editRequestId)}</p></div></div></article>)}{logs.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum log encontrado.</p>}</section>
  </div></main>;
}
