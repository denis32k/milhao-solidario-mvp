import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

const statusTabs = [
  { value: "ALL", label: "Todos" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "PENDING", label: "Pendentes" },
  { value: "EXPIRED", label: "Expirados" },
  { value: "REJECTED", label: "Recusados" },
  { value: "REFUNDED", label: "Reembolsados" },
];

export default async function AdminPagamentosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const q = normalizeSearch(params.q);
  const status = normalizeSearch(params.status) || "ALL";
  const where: any = { isTest: false };
  if (status !== "ALL") where.status = status;
  if (q) where.OR = [{ mpPaymentId: { contains: q, mode: "insensitive" } }, { mpExternalReference: { contains: q, mode: "insensitive" } }, { id: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }];

  const [payments, grouped, events] = await Promise.all([
    safeListQuery(() => (prisma as any).transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 120, include: { user: true, webhookEvents: { orderBy: { receivedAt: "desc" }, take: 2 } } })),
    safeListQuery(() => (prisma as any).transaction.groupBy({ by: ["status"], where: { isTest: false }, _count: { _all: true } })),
    safeListQuery(() => (prisma as any).paymentWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 8, include: { transaction: true } })),
  ]);

  const countByStatus = new Map(grouped.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByStatus.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByStatus.get(tab.value) || 0) }));

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="pagamentos" title="Pagamentos" description="Conferência compacta de pagamentos, Mercado Pago, PIX e últimos webhooks." />
        <AdminTabs secret={secret} basePath="/admin/pagamentos" paramName="status" active={status} tabs={tabs} />

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_170px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar payment_id, referência, pedido ou e-mail" />
          <select name="status" defaultValue={status}><option value="ALL">Todos</option><option value="PENDING">Pendente</option><option value="APPROVED">Aprovado</option><option value="REJECTED">Recusado</option><option value="EXPIRED">Expirado</option><option value="REFUNDED">Reembolsado</option></select>
          <button>Filtrar</button>
        </form>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="admin-table-card">
            <div className="admin-table-header"><h2>Pedidos financeiros</h2><span className="text-xs font-bold text-slate-500">{payments.length} registros</span></div>
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th className="text-left">Pedido</th><th className="text-left">Cliente</th><th className="text-left">Status</th><th className="text-left">Valor</th><th className="text-left">Mercado Pago</th><th className="text-left">Datas</th><th className="text-right">Ações</th></tr></thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td><p className="font-black text-slate-950">{shortId(payment.id)}</p><p className="text-[11px] font-bold text-slate-400">{payment.kind}</p></td>
                      <td><p className="font-black text-slate-800">{payment.user?.name || "Cliente"}</p><p className="text-[11px] font-bold text-slate-500">{payment.user?.email || "sem e-mail"}</p></td>
                      <td><AdminStatusBadge value={payment.status} /></td>
                      <td className="font-black text-slate-950">{money(payment.totalPaidCents)}</td>
                      <td><p className="font-bold text-slate-700">{payment.mpStatus || "sem status"}</p><p className="text-[11px] font-bold text-slate-400">{payment.mpPaymentId || "sem payment_id"}</p><p className="text-[11px] font-bold text-slate-400">{shortId(payment.mpExternalReference)}</p></td>
                      <td><p className="text-[11px] font-bold text-slate-600">Criado: {dateTime(payment.createdAt)}</p><p className="text-[11px] font-bold text-slate-400">Pago: {dateTime(payment.paidAt || payment.approvedAt)}</p></td>
                      <td><div className="admin-row-actions"><Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(payment.id)}`, secret)} className="admin-row-link">Suporte</Link><Link href={withAdminSecret(`/admin/webhooks?q=${encodeURIComponent(payment.mpPaymentId || payment.id)}`, secret)} className="admin-row-link">Webhooks</Link></div></td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={7} className="py-8 text-center font-bold text-slate-500">Nenhum pagamento encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="admin-table-card">
            <div className="admin-table-header"><h2>Últimos webhooks</h2><Link href={withAdminSecret("/admin/webhooks", secret)} className="admin-row-link">Ver todos</Link></div>
            <div className="divide-y divide-slate-100">
              {events.map((event: any) => (
                <div key={event.id} className="p-3">
                  <div className="flex items-start justify-between gap-2"><p className="font-black text-slate-950">{event.eventType || "evento"}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${event.processed ? "bg-emerald-50 text-emerald-700" : event.ignored ? "bg-slate-100 text-slate-700" : "bg-yellow-50 text-yellow-700"}`}>{event.processed ? "processado" : event.ignored ? "ignorado" : "pendente"}</span></div>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">payment_id: {event.paymentId || "—"}</p>
                  <p className="text-[11px] font-bold text-slate-400">{dateTime(event.receivedAt)}</p>
                  {event.error && <p className="mt-1 text-[11px] font-bold text-red-600">{event.error}</p>}
                </div>
              ))}
              {events.length === 0 && <p className="p-4 text-sm font-bold text-slate-500">Nenhum webhook registrado.</p>}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
