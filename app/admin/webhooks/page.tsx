import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

function statusLabel(event: any) {
  if (event.error) return { label: "Erro", className: "bg-red-50 text-red-700 border-red-100" };
  if (event.processed) return { label: "Processado", className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  if (event.ignored) return { label: "Ignorado", className: "bg-slate-100 text-slate-700 border-slate-200" };
  return { label: "Pendente", className: "bg-yellow-50 text-yellow-700 border-yellow-100" };
}

export default async function AdminWebhooksPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/webhooks" />;

  const q = normalizeSearch(params.q);
  const state = normalizeSearch(params.state) || "ALL";
  const where: any = {};

  if (q) {
    where.OR = [
      { paymentId: { contains: q, mode: "insensitive" } },
      { eventId: { contains: q, mode: "insensitive" } },
      { eventType: { contains: q, mode: "insensitive" } },
      { transactionId: { contains: q, mode: "insensitive" } },
    ];
  }

  if (state === "PROCESSED") where.processed = true;
  if (state === "IGNORED") where.ignored = true;
  if (state === "PENDING") {
    where.processed = false;
    where.ignored = false;
    where.error = null;
  }
  if (state === "ERROR") where.error = { not: null };

  const events = await safeListQuery(() =>
    (prisma as any).paymentWebhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 120,
      include: { transaction: { include: { user: true } } },
    })
  );

  const counts = {
    all: events.length,
    processed: events.filter((event: any) => event.processed).length,
    ignored: events.filter((event: any) => event.ignored).length,
    pending: events.filter((event: any) => !event.processed && !event.ignored && !event.error).length,
    error: events.filter((event: any) => event.error).length,
  };

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="webhooks" title="Webhooks" description="Monitoramento compacto dos eventos recebidos do Mercado Pago, com status de processamento, erros e vínculo com pedidos." />

        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-slate-400">Eventos listados</p><p className="mt-1 text-2xl font-black text-slate-950">{counts.all}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-emerald-600">Processados</p><p className="mt-1 text-2xl font-black text-emerald-700">{counts.processed}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-yellow-600">Pendentes</p><p className="mt-1 text-2xl font-black text-yellow-700">{counts.pending}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-slate-500">Ignorados</p><p className="mt-1 text-2xl font-black text-slate-700">{counts.ignored}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-red-600">Com erro</p><p className="mt-1 text-2xl font-black text-red-700">{counts.error}</p></div>
        </section>

        <form className="mb-4 grid gap-2 rounded-3xl bg-white p-4 shadow-xl md:grid-cols-[1fr_180px_110px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar por payment_id, evento, pedido ou e-mail" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold" />
          <select name="state" defaultValue={state} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="ALL">Todos</option>
            <option value="PROCESSED">Processados</option>
            <option value="PENDING">Pendentes</option>
            <option value="IGNORED">Ignorados</option>
            <option value="ERROR">Com erro</option>
          </select>
          <button className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">Filtrar</button>
        </form>

        <section className="rounded-3xl bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-black text-slate-950">Eventos Mercado Pago</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">Últimos 120 eventos do filtro atual.</p>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Recebido</th>
                  <th className="text-left">Evento</th>
                  <th className="text-left">Payment ID</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Pedido</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-left">Erro</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => {
                  const status = statusLabel(event);
                  return (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(event.receivedAt)}</td>
                      <td><p className="font-black text-slate-950">{event.eventType || "evento"}</p><p className="text-[11px] font-bold text-slate-400">{shortId(event.eventId)}</p></td>
                      <td className="font-bold text-slate-700">{event.paymentId || "—"}</td>
                      <td><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span></td>
                      <td>{event.transactionId ? <Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(event.transactionId)}`, secret)} className="font-black text-orange-700">{shortId(event.transactionId)}</Link> : "—"}</td>
                      <td><p className="font-bold text-slate-700">{event.transaction?.user?.publicName || event.transaction?.user?.name || "—"}</p><p className="text-[11px] font-bold text-slate-400">{event.transaction?.user?.email || ""}</p></td>
                      <td className="max-w-[260px] truncate text-[11px] font-bold text-red-600">{event.error || "—"}</td>
                    </tr>
                  );
                })}
                {events.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center font-bold text-slate-500">Nenhum webhook encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
