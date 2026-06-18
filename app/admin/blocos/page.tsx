import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const statusTabs = [
  { value: "ALL", label: "Relevantes" },
  { value: "SOLD", label: "Vendidos" },
  { value: "RESERVED", label: "Reservados" },
  { value: "AVAILABLE", label: "Disponíveis" },
  { value: "LOCKED", label: "Travados" },
  { value: "BLOCKED", label: "Bloqueados" },
];

export default async function AdminBlocosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/blocos" />;

  const status = normalizeSearch(params.status) || "ALL";
  const area = normalizeSearch(params.area) || "ALL";
  const x = normalizeSearch(params.x);
  const y = normalizeSearch(params.y);
  const where: any = { gridX: { lt: 232 }, gridY: { lt: 125 } };
  if (status && status !== "ALL") where.status = status;
  else where.status = { in: ["SOLD", "RESERVED", "LOCKED", "BLOCKED"] };
  if (area && area !== "ALL") where.category = area;
  if (x) where.gridX = Number(x);
  if (y) where.gridY = Number(y);

  const [blocks, grouped] = await Promise.all([
    safeListQuery(() =>
      (prisma as any).block.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { gridY: "asc" }, { gridX: "asc" }],
        take: 180,
        include: { owner: true, placement: true, currentTransaction: { include: { user: true } } },
      })
    ),
    safeListQuery(() => (prisma as any).block.groupBy({ by: ["status"], where: { gridX: { lt: 232 }, gridY: { lt: 125 } }, _count: { _all: true } })),
  ]);

  const countByStatus = new Map(grouped.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? blocks.length : Number(countByStatus.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="blocos" title="Blocos" description="Consulta densa de blocos, coordenadas, compradores e status sem alterar o grid travado." />
        <div className="admin-density-note mb-3">Regra fixa: coordenada vendida é histórico. O admin pode revisar, ocultar ou bloquear conteúdo, mas não remanejar estrutura.</div>
        <AdminTabs secret={secret} basePath="/admin/blocos" paramName="status" active={status} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[160px_180px_90px_90px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <select name="status" defaultValue={status}><option value="ALL">Status relevantes</option><option value="AVAILABLE">Disponível</option><option value="RESERVED">Reservado</option><option value="SOLD">Vendido</option><option value="LOCKED">Travado</option><option value="BLOCKED">Bloqueado</option></select>
          <select name="area" defaultValue={area}><option value="ALL">Todas áreas</option><option value="SOLIDARITY">Copacabana</option><option value="PREMIUM">Ipanema</option><option value="GOLD">Leblon</option><option value="GRAND_CENTER">Tom Delfim</option></select>
          <input name="x" defaultValue={x} placeholder="X" />
          <input name="y" defaultValue={y} placeholder="Y" />
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Blocos encontrados</h2><span className="text-xs font-bold text-slate-500">{blocks.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Coordenada</th><th className="text-left">Área</th><th className="text-left">Status</th><th className="text-left">Cliente</th><th className="text-left">Conteúdo</th><th className="text-left">Valor</th><th className="text-left">Atualizado</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {blocks.map((block: any) => (
                  <tr key={block.id}>
                    <td><p className="font-black text-slate-950">x{block.gridX}/y{block.gridY}</p><p className="text-[11px] font-bold text-slate-400">{shortId(block.id)}</p></td>
                    <td className="font-bold text-slate-700">{getAreaName(block.category)}</td>
                    <td><AdminStatusBadge value={block.status} /></td>
                    <td><p className="font-bold text-slate-800">{block.owner?.publicName || block.owner?.name || block.currentTransaction?.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{block.owner?.email || block.currentTransaction?.user?.email || ""}</p></td>
                    <td><p className="font-bold text-slate-700">{block.placement?.title || block.placement?.displayName || "—"}</p><p className="text-[11px] font-bold text-slate-400">{block.placement?.reviewStatus || "sem conteúdo"}</p></td>
                    <td className="font-black text-slate-950">{money(block.priceCents || 0)}</td>
                    <td className="whitespace-nowrap text-[11px] font-bold text-slate-500">{dateTime(block.updatedAt)}</td>
                    <td><div className="admin-row-actions"><Link href={`/bloco/${block.id}`} className="admin-row-link">Público</Link>{block.currentTransactionId && <Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(block.currentTransactionId)}`, secret)} className="admin-row-link">Pedido</Link>}</div></td>
                  </tr>
                ))}
                {blocks.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhum bloco encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
