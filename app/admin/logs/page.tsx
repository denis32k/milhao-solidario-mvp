import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/logs" />;

  const type = normalizeSearch(params.type);
  const where: any = {};
  if (type) where.type = type;
  const logs = await safeListQuery(() => (prisma as any).adminAction.findMany({ where, orderBy: { createdAt: "desc" }, take: 160, include: { admin: true, report: true, block: true, editRequest: true, disputeCase: true } }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="logs" title="Logs" description="Auditoria administrativa em tabela compacta, com motivo, operador e entidades afetadas." />

        <form className="admin-compact-filter mb-4 md:grid-cols-[220px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="type" defaultValue={type} placeholder="Tipo de ação. Ex: BLOCK_LINK" />
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Auditoria</h2><span className="text-xs font-bold text-slate-500">{logs.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Data</th><th className="text-left">Tipo</th><th className="text-left">Admin</th><th className="text-left">Motivo / observação</th><th className="text-left">Entidades</th></tr></thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(log.createdAt)}</td>
                    <td><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-700">{log.type}</span></td>
                    <td><p className="font-black text-slate-800">{log.admin?.name || "Admin"}</p><p className="text-[11px] font-bold text-slate-400">{log.admin?.email || ""}</p></td>
                    <td className="max-w-[420px]"><p className="max-h-10 overflow-hidden font-bold text-slate-700">{log.note || "Sem motivo registrado"}</p></td>
                    <td className="text-[11px] font-bold text-slate-500"><p>placement: {shortId(log.placementId)}</p><p>block: {shortId(log.blockId)}</p><p>report: {shortId(log.reportId)}</p><p>edit: {shortId(log.editRequestId)}</p></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="py-8 text-center font-bold text-slate-500">Nenhum log encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
