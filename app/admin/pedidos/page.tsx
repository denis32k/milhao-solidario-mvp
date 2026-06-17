import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminSecret, isAuthorized, money, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING") return "bg-yellow-100 text-yellow-700";
  if (status === "REJECTED" || status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminPedidosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const secret = getAdminSecret(params);
  if (!isAuthorized(secret)) return <AdminLocked />;

  const q = normalizeSearch(params.q);
  const status = normalizeSearch(params.status);
  const where: any = { isTest: false };
  if (status && status !== "ALL") where.status = status;
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

  const orders = await safeListQuery(() =>
    (prisma as any).transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        user: true,
        items: true,
        placement: true,
        webhookEvents: { orderBy: { receivedAt: "desc" }, take: 3 },
      },
    })
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="pedidos" title="Pedidos" description="Busca e conferência dos pedidos, pagamentos, blocos comprados e conteúdo vinculado." />

        <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_180px_120px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail, WhatsApp, payment_id ou pedido" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
          <select name="status" defaultValue={status || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950">
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovado</option>
            <option value="REJECTED">Recusado</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="EXPIRED">Expirado</option>
            <option value="REFUNDED">Reembolsado</option>
          </select>
          <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button>
        </form>

        <section className="space-y-3">
          {orders.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum pedido encontrado.</p>}
          {orders.map((order: any) => {
            const coords = (order.items || []).slice(0, 6).map((item: any) => `x${item.gridX}/y${item.gridY}`).join(", ");
            return (
              <article key={order.id} className="rounded-3xl bg-white p-5 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase text-slate-500">Pedido {shortId(order.id)} • {order.kind}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{order.user?.name || order.placementTitle || "Cliente"}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{order.user?.email || "sem e-mail"} • {order.checkoutWhatsapp || order.user?.whatsapp || "sem WhatsApp"}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">Blocos: {order.items?.length || 0} {coords ? `• ${coords}` : ""}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">MP: {order.mpPaymentId || "sem payment_id"} • Ref: {shortId(order.mpExternalReference)}</p>
                  </div>
                  <div className="min-w-40 text-right">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black ${statusClass(order.status)}`}>{order.status}</span>
                    <p className="mt-2 text-2xl font-black text-slate-950">{money(order.totalPaidCents)}</p>
                    <p className="text-xs font-bold text-slate-500">Criado: {dateTime(order.createdAt)}</p>
                    <p className="text-xs font-bold text-slate-500">Aprovado: {dateTime(order.approvedAt)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">Conteúdo: {order.placement?.reviewStatus || "sem placement"}</div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">Pagamento MP: {order.mpStatus || "sem status"} / {order.mpStatusDetail || "sem detalhe"}</div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">Webhooks: {order.webhookEvents?.length || 0} últimos registros</div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
