import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPagamentosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const q = normalizeSearch(params.q);
  const status = normalizeSearch(params.status);
  const where: any = { isTest: false };
  if (status && status !== "ALL") where.status = status;
  if (q) where.OR = [{ mpPaymentId: { contains: q, mode: "insensitive" } }, { mpExternalReference: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }];

  const [payments, events] = await Promise.all([
    safeListQuery(() => (prisma as any).transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 60, include: { user: true, webhookEvents: { orderBy: { receivedAt: "desc" }, take: 2 } } })),
    safeListQuery(() => (prisma as any).paymentWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 40, include: { transaction: { include: { user: true } } } })),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="pagamentos" title="Pagamentos" description="Conferência financeira, status Mercado Pago e log técnico dos webhooks recebidos." />
        <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_180px_120px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar payment_id, referência ou e-mail" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          <select name="status" defaultValue={status || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Todos</option><option value="PENDING">Pendente</option><option value="APPROVED">Aprovado</option><option value="REJECTED">Recusado</option><option value="EXPIRED">Expirado</option><option value="REFUNDED">Reembolsado</option></select>
          <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button>
        </form>
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Pedidos financeiros</h2>
          <div className="mt-4 space-y-3">
            {payments.map((payment: any) => (
              <article key={payment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase text-slate-500">{payment.status} • {payment.mpStatus || "sem MP status"}</p><h3 className="mt-1 text-lg font-black text-slate-950">{payment.user?.name || "Cliente"}</h3><p className="mt-1 text-xs font-bold text-slate-500">payment_id: {payment.mpPaymentId || "—"} • pedido {shortId(payment.id)}</p></div>
                  <div className="text-right"><p className="text-2xl font-black text-slate-950">{money(payment.totalPaidCents)}</p><p className="text-xs font-bold text-slate-500">Criado: {dateTime(payment.createdAt)}</p><p className="text-xs font-bold text-slate-500">Pago: {dateTime(payment.paidAt)}</p></div>
                </div>
              </article>
            ))}
            {payments.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum pagamento encontrado.</p>}
          </div>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Webhooks Mercado Pago</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">Aqui aparecem duplicados, ignorados, erros e mudanças de status.</p>
          <div className="mt-4 space-y-2">
            {events.map((event: any) => (
              <article key={event.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-xs font-black uppercase text-slate-500">{event.eventType || "evento"} • payment_id {event.paymentId || "—"}</p><p className="mt-1 text-sm font-bold text-slate-700">{event.previousStatus || "sem status"} → {event.newStatus || "sem status"}</p>{event.error && <p className="mt-1 text-xs font-bold text-red-600">Erro: {event.error}</p>}</div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${event.processed ? "bg-emerald-100 text-emerald-700" : event.ignored ? "bg-slate-200 text-slate-700" : "bg-yellow-100 text-yellow-700"}`}>{event.processed ? "processado" : event.ignored ? "ignorado" : "pendente"}</span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Recebido: {dateTime(event.receivedAt)} • Pedido: {shortId(event.transactionId)}</p>
              </article>
            ))}
            {events.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum webhook registrado ainda.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
