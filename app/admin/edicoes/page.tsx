import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

const statusTabs = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Recusadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

function changeBadges(request: any) {
  const badges = [];
  if (request.requestedDisplayName || request.requestedTitle) badges.push("Nome");
  if (request.requestedRedirectUrl) badges.push("Link");
  if (request.requestedImageUrl) badges.push("Imagem");
  return badges;
}

export default async function AdminEdicoesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/edicoes" />;

  const status = normalizeSearch(params.status) || "ALL";
  const where: any = {};
  if (status !== "ALL") where.status = status;

  const [requests, grouped] = await Promise.all([
    safeListQuery(() => (prisma as any).contentEditRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 140, include: { user: true, placement: { include: { user: true, blocks: { take: 1 } } } } })),
    safeListQuery(() => (prisma as any).contentEditRequest.groupBy({ by: ["status"], _count: { _all: true } })),
  ]);

  const countByStatus = new Map(grouped.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByStatus.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByStatus.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="edicoes" title="Edições pendentes" description="Novo fluxo simplificado: o comprador só altera nome público, link e imagem. A versão atual continua no mural até aprovação." />
        <AdminTabs secret={secret} basePath="/admin/edicoes" paramName="status" active={status} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[220px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <select name="status" defaultValue={status}><option value="ALL">Todas</option><option value="PENDING">Pendentes</option><option value="APPROVED">Aprovadas</option><option value="REJECTED">Recusadas</option><option value="CANCELLED">Canceladas</option></select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Solicitações de troca de nome, link e imagem</h2><span className="text-xs font-bold text-slate-500">{requests.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Data</th><th className="text-left">Status</th><th className="text-left">Conteúdo atual</th><th className="text-left">Cliente</th><th className="text-left">Troca pedida</th><th className="text-left">Motivo</th><th className="text-left">Decisão</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {requests.map((r: any) => {
                  const badges = changeBadges(r);
                  const firstBlock = r.placement?.blocks?.[0];
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(r.createdAt)}</td>
                      <td><AdminStatusBadge value={r.status} /></td>
                      <td><p className="font-black text-slate-950">{r.placement?.displayName || r.placement?.title || "Espaço comprado"}</p><p className="text-[11px] font-bold text-slate-400">{shortId(r.placementId)}</p></td>
                      <td><p className="font-bold text-slate-800">{r.user?.name || r.placement?.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{r.user?.email || r.placement?.user?.email || ""}</p></td>
                      <td className="min-w-[220px]">
                        <div className="flex flex-wrap gap-1">{badges.length ? badges.map((badge) => <span key={badge} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">{badge}</span>) : <span className="text-xs font-bold text-slate-400">Sem alteração visível</span>}</div>
                        {r.requestedDisplayName && <p className="mt-2 truncate text-[11px] font-bold text-slate-600">Nome: {r.requestedDisplayName}</p>}
                        {r.requestedRedirectUrl && <p className="truncate text-[11px] font-bold text-slate-600">Link: {r.requestedRedirectUrl}</p>}
                        {r.requestedImageUrl && <p className="text-[11px] font-bold text-slate-600">Imagem nova enviada</p>}
                      </td>
                      <td className="max-w-[240px]"><p className="max-h-10 overflow-hidden font-bold text-slate-700">{r.reason}</p></td>
                      <td className="max-w-[220px]"><p className="max-h-10 overflow-hidden text-[11px] font-bold text-slate-500">{r.adminNote || "sem decisão"}</p></td>
                      <td><div className="admin-row-actions">{firstBlock && <Link href={`/bloco/${firstBlock.id}`} className="admin-row-link">Público</Link>}<Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(r.placementId)}`, secret)} className="admin-row-link">Suporte</Link></div></td>
                    </tr>
                  );
                })}
                {requests.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhuma solicitação encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
