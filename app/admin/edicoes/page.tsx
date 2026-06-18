import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

const statusTabs = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Recusadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default async function AdminEdicoesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/edicoes" />;

  const status = normalizeSearch(params.status) || "ALL";
  const where: any = {};
  if (status !== "ALL") where.status = status;

  const [requests, grouped] = await Promise.all([
    safeListQuery(() => (prisma as any).contentEditRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 120, include: { user: true, placement: { include: { user: true } } } })),
    safeListQuery(() => (prisma as any).contentEditRequest.groupBy({ by: ["status"], _count: { _all: true } })),
  ]);

  const countByStatus = new Map(grouped.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByStatus.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByStatus.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="edicoes" title="Edições pendentes" description="Toda edição futura fica pendente até aprovação. O conteúdo atual continua no mural até decisão do admin." />
        <AdminTabs secret={secret} basePath="/admin/edicoes" paramName="status" active={status} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[220px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <select name="status" defaultValue={status}><option value="ALL">Todas</option><option value="PENDING">Pendentes</option><option value="APPROVED">Aprovadas</option><option value="REJECTED">Recusadas</option><option value="CANCELLED">Canceladas</option></select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Solicitações de edição</h2><span className="text-xs font-bold text-slate-500">{requests.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Data</th><th className="text-left">Status</th><th className="text-left">Conteúdo</th><th className="text-left">Cliente</th><th className="text-left">Motivo</th><th className="text-left">Alterações pedidas</th><th className="text-left">Decisão</th></tr></thead>
              <tbody>
                {requests.map((r: any) => {
                  const changes = [r.requestedTitle && "título", r.requestedDisplayName && "nome público", r.requestedDescription && "descrição", r.requestedRedirectUrl && "link", r.requestedImageUrl && "imagem"].filter(Boolean).join(", ");
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(r.createdAt)}</td>
                      <td><AdminStatusBadge value={r.status} /></td>
                      <td><p className="font-black text-slate-950">{r.placement?.title || r.placement?.displayName || "Conteúdo"}</p><p className="text-[11px] font-bold text-slate-400">{shortId(r.placementId)}</p></td>
                      <td><p className="font-bold text-slate-800">{r.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{r.user?.email || ""}</p></td>
                      <td className="max-w-[260px]"><p className="max-h-10 overflow-hidden font-bold text-slate-700">{r.reason}</p></td>
                      <td className="font-bold text-slate-700">{changes || "—"}</td>
                      <td className="max-w-[220px]"><p className="max-h-10 overflow-hidden text-[11px] font-bold text-slate-500">{r.adminNote || "sem decisão"}</p></td>
                    </tr>
                  );
                })}
                {requests.length === 0 && <tr><td colSpan={7} className="py-8 text-center font-bold text-slate-500">Nenhuma solicitação encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
