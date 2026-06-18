import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId, muralBlockHref, withAdminSecret } from "@/lib/admin";
import { getAreaName, type AreaKey } from "@/lib/site-config";

export const dynamic = "force-dynamic";

function areaLabel(value: string | null | undefined) {
  if (value === "SOLIDARITY" || value === "PREMIUM" || value === "GOLD" || value === "GRAND_CENTER") return getAreaName(value as AreaKey);
  return "Área do mural";
}

const statusTabs = [
  { value: "ALL", label: "Todos" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "PENDING", label: "Pendentes" },
  { value: "EXPIRED", label: "Expirados" },
  { value: "REJECTED", label: "Recusados" },
  { value: "CANCELLED", label: "Cancelados" },
  { value: "REFUNDED", label: "Reembolsados" },
];

export default async function AdminPedidosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/pedidos" />;

  const q = normalizeSearch(params.q);
  const status = normalizeSearch(params.status) || "ALL";
  const where: any = { isTest: false };
  if (status !== "ALL") where.status = status;
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { mpPaymentId: { contains: q, mode: "insensitive" } },
      { mpExternalReference: { contains: q, mode: "insensitive" } },
      { placementTitle: { contains: q, mode: "insensitive" } },
      { checkoutWhatsapp: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { publicName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { whatsapp: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, allCounts] = await Promise.all([
    safeListQuery(() =>
      (prisma as any).transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 120,
        include: { user: true, items: true, placement: { include: { blocks: { take: 1 } } }, webhookEvents: { orderBy: { receivedAt: "desc" }, take: 1 } },
      })
    ),
    safeListQuery(() => (prisma as any).transaction.groupBy({ by: ["status"], where: { isTest: false }, _count: { _all: true } })),
  ]);

  const countByStatus = new Map(allCounts.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByStatus.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByStatus.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="pedidos" title="Pedidos" description="Operação compacta dos pedidos, clientes, pagamentos, blocos comprados e conteúdo vinculado." />
        <AdminTabs secret={secret} basePath="/admin/pedidos" paramName="status" active={status} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_170px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar nome, e-mail, WhatsApp, payment_id ou pedido" />
          <select name="status" defaultValue={status}>
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovado</option>
            <option value="REJECTED">Recusado</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="EXPIRED">Expirado</option>
            <option value="REFUNDED">Reembolsado</option>
          </select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Pedidos encontrados</h2><span className="text-xs font-bold text-slate-500">{orders.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Pedido / área</th><th className="text-left">Cliente</th><th className="text-left">Status</th><th className="text-left">Valor</th><th className="text-left">Blocos</th><th className="text-left">Pagamento</th><th className="text-left">Datas</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {orders.map((order: any) => {
                  const previewItems = (order.items || []).slice(0, 3);
                  const extraBlocks = (order.items || []).length > previewItems.length ? ` +${(order.items || []).length - previewItems.length}` : "";
                  const primaryBlockId = order.placement?.blocks?.[0]?.id || previewItems[0]?.blockId;
                  return (
                    <tr key={order.id}>
                      <td><p className="font-black text-slate-950">{shortId(order.id)}</p><p className="text-[11px] font-bold text-slate-400">{areaLabel(order.kind)}</p></td>
                      <td><p className="font-black text-slate-800">{order.user?.name || order.placementTitle || "Cliente"}</p><p className="text-[11px] font-bold text-slate-500">{order.user?.email || "sem e-mail"}</p><p className="text-[11px] font-bold text-slate-400">{order.checkoutWhatsapp || order.user?.whatsapp || "sem WhatsApp"}</p></td>
                      <td><AdminStatusBadge value={order.status} /></td>
                      <td className="font-black text-slate-950">{money(order.totalPaidCents)}</td>
                      <td><p className="font-bold text-slate-700">{order.items?.length || 0} bloco(s)</p><div className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">{previewItems.length ? previewItems.map((item: any) => <Link key={item.id || item.blockId} href={muralBlockHref(item.blockId)} className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">x{item.gridX}/y{item.gridY}</Link>) : <span className="text-slate-400">—</span>}{extraBlocks && <span className="px-1 py-1 text-slate-400">{extraBlocks}</span>}</div></td>
                      <td><p className="font-bold text-slate-700">{order.mpStatus || "sem confirmação"}</p><p className="text-[11px] font-bold text-slate-400">{order.mpPaymentId || "sem ID Mercado Pago"}</p></td>
                      <td><p className="text-[11px] font-bold text-slate-600">Criado: {dateTime(order.createdAt)}</p><p className="text-[11px] font-bold text-slate-400">Pago: {dateTime(order.approvedAt || order.paidAt)}</p></td>
                      <td><div className="admin-row-actions"><Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(order.id)}`, secret)} className="admin-row-link">Suporte</Link>{primaryBlockId && <Link href={muralBlockHref(primaryBlockId)} className="admin-row-link">Mural</Link>}{order.placement?.blocks?.[0]?.id && <Link href={`/bloco/${order.placement.blocks[0].id}`} className="admin-row-link">Bloco</Link>}</div></td>
                    </tr>
                  );
                })}
                {orders.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhum pedido encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
