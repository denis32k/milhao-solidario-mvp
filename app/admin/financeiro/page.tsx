import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, safeValueQuery, muralBlockHref, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AreaKey = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

const areaNames: Record<string, string> = {
  SOLIDARITY: "Copacabana",
  PREMIUM: "Ipanema",
  GOLD: "Leblon",
  GRAND_CENTER: "Tom Delfim",
};

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string, fallback: Date, endOfDay = false) {
  if (!value) return fallback;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function statusBadge(status: string | null | undefined) {
  const value = status || "—";
  const color = value === "APPROVED" || value === "approved" ? "bg-emerald-50 text-emerald-700" : value === "PENDING" || value === "pending" ? "bg-yellow-50 text-yellow-700" : value === "REFUNDED" || value === "refunded" ? "bg-purple-50 text-purple-700" : "bg-red-50 text-red-700";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${color}`}>{value}</span>;
}

function sum<T>(items: T[], picker: (item: T) => number) {
  return items.reduce((total, item) => total + (Number(picker(item)) || 0), 0);
}

export default async function AdminFinanceiroPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;

  if (!access.authorized) return <AdminLocked nextPath="/admin/financeiro" />;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromParam = normalizeSearch(params.from) || inputDate(monthStart);
  const toParam = normalizeSearch(params.to) || inputDate(now);
  const area = normalizeSearch(params.area);
  const status = normalizeSearch(params.status);
  const from = parseDate(fromParam, monthStart);
  const to = parseDate(toParam, now, true);

  const where: any = {
    createdAt: { gte: from, lte: to },
  };

  if (area && area !== "ALL") where.kind = area;
  if (status && status !== "ALL") where.status = status;

  const [transactions, stuckReservations, webhookErrors, pendingPix, approvedToday] = (await Promise.all([
    safeListQuery(() => (prisma as any).transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1500,
      include: { user: true, items: true, placement: true, webhookEvents: { orderBy: { receivedAt: "desc" }, take: 2 }, disputeCases: { orderBy: { createdAt: "desc" }, take: 2 } },
    })),
    safeListQuery(() => (prisma as any).block.findMany({
      where: { status: "RESERVED", reservedUntil: { lt: now } },
      orderBy: { reservedUntil: "asc" },
      take: 80,
      include: { owner: true, currentTransaction: true },
    })),
    safeListQuery(() => (prisma as any).paymentWebhookEvent.findMany({
      where: { OR: [{ error: { not: null } }, { processed: false, ignored: false }] },
      orderBy: { receivedAt: "desc" },
      take: 30,
      include: { transaction: { include: { user: true } } },
    })),
    safeListQuery(() => (prisma as any).transaction.findMany({
      where: { status: "PENDING", createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: true, items: true },
    })),
    safeValueQuery(() => (prisma as any).transaction.count({
      where: { status: "APPROVED", approvedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lte: now } },
    }), 0),
  ])) as [any[], any[], any[], any[], number];

  const approved = transactions.filter((t: any) => t.status === "APPROVED");
  const disputes = transactions.filter((t: any) => (t.disputeCases || []).length > 0);
  const expiredPending = pendingPix.filter((t: any) => t.expiresAt && new Date(t.expiresAt) < now);

  const totalApprovedCents = sum(approved, (t: any) => t.totalPaidCents);
  const subtotalApprovedCents = sum(approved, (t: any) => t.subtotalCents);
  const feesApprovedCents = sum(approved, (t: any) => t.operatorFeeCents);
  const avgTicketCents = approved.length ? Math.round(totalApprovedCents / approved.length) : 0;
  const soldBlocks = sum(approved, (t: any) => t.items?.length || 0);

  const byArea = (Object.values(transactions.reduce((acc: Record<string, any>, transaction: any) => {
    const key = transaction.kind || "UNKNOWN";
    if (!acc[key]) acc[key] = { key, name: areaNames[key] || key, count: 0, blocks: 0, approved: 0, totalCents: 0 };
    acc[key].count += 1;
    acc[key].blocks += transaction.items?.length || 0;
    if (transaction.status === "APPROVED") {
      acc[key].approved += 1;
      acc[key].totalCents += transaction.totalPaidCents || 0;
    }
    return acc;
  }, {} as Record<string, any>)) as any[]).sort((a: any, b: any) => b.totalCents - a.totalCents);

  const byStatus = (Object.values(transactions.reduce((acc: Record<string, any>, transaction: any) => {
    const key = transaction.status || "UNKNOWN";
    if (!acc[key]) acc[key] = { key, count: 0, totalCents: 0 };
    acc[key].count += 1;
    acc[key].totalCents += transaction.totalPaidCents || 0;
    return acc;
  }, {} as Record<string, any>)) as any[]).sort((a: any, b: any) => b.count - a.count);

  const healthAlerts = [
    ...(stuckReservations.length ? [`${stuckReservations.length} reserva(s) travada(s) ou expirada(s).`] : []),
    ...(webhookErrors.length ? [`${webhookErrors.length} webhook(s) com erro/pendente.`] : []),
    ...(expiredPending.length ? [`${expiredPending.length} PIX pendente já passou do prazo.`] : []),
    ...(disputes.length ? [`${disputes.length} pedido(s) com disputa interna.`] : []),
  ];

  const exportQuery = `type=financial&from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}${area ? `&area=${encodeURIComponent(area)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}${secret ? `&secret=${encodeURIComponent(secret)}` : ""}`;

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-7xl">
        <AdminPageHeader secret={secret} active="financeiro" title="Financeiro" description="Conferência de vendas, pagamentos, reservas perdidas, ticket médio e saúde financeira do Mural29." />

        <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl md:grid-cols-[1fr_1fr_1fr_1fr_140px]">
          <input type="hidden" name="secret" value={secret} />
          <label className="text-xs font-black uppercase text-slate-500">De<input name="from" type="date" defaultValue={fromParam} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800" /></label>
          <label className="text-xs font-black uppercase text-slate-500">Até<input name="to" type="date" defaultValue={toParam} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800" /></label>
          <label className="text-xs font-black uppercase text-slate-500">Área<select name="area" defaultValue={area || "ALL"} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"><option value="ALL">Todas</option><option value="SOLIDARITY">Copacabana</option><option value="PREMIUM">Ipanema</option><option value="GOLD">Leblon</option><option value="GRAND_CENTER">Tom Delfim</option></select></label>
          <label className="text-xs font-black uppercase text-slate-500">Status<select name="status" defaultValue={status || "ALL"} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800"><option value="ALL">Todos</option><option value="APPROVED">Aprovados</option><option value="PENDING">Pendentes</option><option value="REJECTED">Recusados</option><option value="EXPIRED">Expirados</option><option value="REFUNDED">Reembolsados</option><option value="CANCELLED">Cancelados</option></select></label>
          <button className="self-end rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button>
        </form>

        <section className="mb-5 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Aprovado no período</p><p className="mt-1 text-2xl font-black text-slate-950">{money(totalApprovedCents)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Subtotal vendido</p><p className="mt-1 text-2xl font-black text-slate-950">{money(subtotalApprovedCents)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Taxas operacionais</p><p className="mt-1 text-2xl font-black text-slate-950">{money(feesApprovedCents)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Ticket médio</p><p className="mt-1 text-2xl font-black text-slate-950">{money(avgTicketCents)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Blocos vendidos</p><p className="mt-1 text-2xl font-black text-slate-950">{soldBlocks}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Aprovados hoje</p><p className="mt-1 text-2xl font-black text-slate-950">{approvedToday}</p></div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-500">Saúde financeira</p><h2 className="mt-1 text-xl font-black text-slate-950">Alertas do período</h2></div><a href={`/api/admin/export?${exportQuery}`} className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Exportar CSV</a></div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-yellow-50 p-3"><p className="text-xs font-black text-yellow-700">PIX pendentes</p><p className="mt-1 text-2xl font-black text-yellow-950">{pendingPix.length}</p></div>
              <div className="rounded-2xl bg-red-50 p-3"><p className="text-xs font-black text-red-700">Reservas travadas</p><p className="mt-1 text-2xl font-black text-red-950">{stuckReservations.length}</p></div>
              <div className="rounded-2xl bg-purple-50 p-3"><p className="text-xs font-black text-purple-700">Disputas</p><p className="mt-1 text-2xl font-black text-purple-950">{disputes.length}</p></div>
              <div className="rounded-2xl bg-orange-50 p-3"><p className="text-xs font-black text-orange-700">Webhook alerta</p><p className="mt-1 text-2xl font-black text-orange-950">{webhookErrors.length}</p></div>
            </div>
            <div className="mt-4 space-y-2">{healthAlerts.length === 0 ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">Tudo saudável dentro dos filtros atuais.</p> : healthAlerts.map((alert) => <p key={alert} className="rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700">{alert}</p>)}</div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-slate-500">Resumo por status</p>
            <div className="mt-4 space-y-3">{byStatus.map((item: any) => <div key={item.key} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-950">{item.key}</p><p className="text-xs font-black text-slate-500">{percent(item.count, transactions.length)}</p></div><p className="mt-1 text-xs font-bold text-slate-500">{item.count} pedido(s) • {money(item.totalCents)}</p></div>)}{byStatus.length === 0 && <p className="text-sm font-bold text-slate-500">Sem pedidos nesse período.</p>}</div>
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">Áreas que mais venderam</p><div className="mt-4 space-y-3">{byArea.map((item: any) => <div key={item.key} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-950">{item.name}</p><p className="text-sm font-black text-slate-950">{money(item.totalCents)}</p></div><p className="mt-1 text-xs font-bold text-slate-500">{item.approved} compra(s) aprovada(s) • {item.blocks} bloco(s) • {percent(item.totalCents, totalApprovedCents)} da receita aprovada</p></div>)}{byArea.length === 0 && <p className="text-sm font-bold text-slate-500">Sem vendas por área nesse período.</p>}</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">Reservas perdidas/travadas</p><div className="mt-4 space-y-3">{stuckReservations.slice(0, 10).map((block: any) => <div key={block.id} className="rounded-2xl bg-red-50 p-3"><p><a href={muralBlockHref(block.id)} className="text-sm font-black text-red-950 underline decoration-red-300 underline-offset-4">x{block.gridX}/y{block.gridY}</a> <span className="text-sm font-black text-red-950">• {block.category}</span></p><p className="mt-1 text-xs font-bold text-red-800">Reservado até: {dateTime(block.reservedUntil)} • Cliente: {block.owner?.name || "—"}</p></div>)}{stuckReservations.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma reserva travada agora.</p>}</div></div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase text-slate-500">Últimos pedidos do filtro</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="text-slate-500"><tr><th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">MP Status</th><th className="p-3">Valor</th><th className="p-3">Blocos</th><th className="p-3">Criado</th><th className="p-3">Ações</th></tr></thead><tbody>{transactions.slice(0, 80).map((t: any) => <tr key={t.id} className="border-t border-slate-100"><td className="p-3 font-black text-slate-950">{t.id.slice(0, 8)}...</td><td className="p-3 font-bold text-slate-700">{t.user?.name || "—"}</td><td className="p-3">{statusBadge(t.status)}</td><td className="p-3 text-slate-600">{t.mpStatus || "—"}</td><td className="p-3 font-black text-slate-950">{money(t.totalPaidCents)}</td><td className="p-3 text-slate-600">{t.items?.length || 0}</td><td className="p-3 text-slate-600">{dateTime(t.createdAt)}</td><td className="p-3"><a className="rounded-full bg-slate-100 px-3 py-2 font-black text-slate-700" href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(t.id)}`, secret)}>Suporte</a></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}
