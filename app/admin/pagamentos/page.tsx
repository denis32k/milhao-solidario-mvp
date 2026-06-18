import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { getAreaName, type AreaKey } from "@/lib/site-config";

export const dynamic = "force-dynamic";

function areaLabel(value: string | null | undefined) {
  if (value === "SOLIDARITY" || value === "PREMIUM" || value === "GOLD" || value === "GRAND_CENTER") return getAreaName(value as AreaKey);
  return "Área do mural";
}


function isSecretAuthorized(secretFromForm: string | undefined) {
  const secret = process.env.ADMIN_API_SECRET;
  return Boolean(secret && secretFromForm === secret);
}

async function getActionAdminId(secretFromForm: string | undefined) {
  if (isSecretAuthorized(secretFromForm)) return null;
  const session = await getAdminSession();
  return session?.user?.id || null;
}

function getCleanAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}

async function syncMercadoPagoPayment(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const paymentId = String(formData.get("paymentId") || "").trim();
  const transactionId = String(formData.get("transactionId") || "").trim();
  const status = String(formData.get("status") || "ALL").trim() || "ALL";
  const q = String(formData.get("q") || "").trim();

  const params = new URLSearchParams();
  if (secret) params.set("secret", secret);
  if (status) params.set("status", status);
  if (q) params.set("q", q);

  if (!paymentId) {
    params.set("sync", "missing_payment_id");
    redirect(`/admin/pagamentos?${params.toString()}`);
  }

  const appUrl = getCleanAppUrl();
  if (!appUrl) {
    params.set("sync", "missing_app_url");
    redirect(`/admin/pagamentos?${params.toString()}`);
  }

  const response = await fetch(`${appUrl}/api/mercado-pago-pix/webhook?type=payment&data.id=${encodeURIComponent(paymentId)}`, { cache: "no-store" }).catch((error) => ({ ok: false, status: 500, text: async () => String(error) } as any));
  const responseText = await (response as any).text().catch(() => "");
  let ok = Boolean((response as any).ok);
  try {
    const parsed = JSON.parse(responseText || "{}");
    if (parsed?.result?.ok === false || parsed?.ok === false) ok = false;
  } catch {
    // Mantém o status HTTP como fallback.
  }

  await (prisma as any).supportNote.create({
    data: {
      transactionId: transactionId || null,
      adminId,
      category: "PAYMENT_SYNC",
      note: ok ? `Sincronização Mercado Pago executada para payment_id ${paymentId}.` : `Falha ao sincronizar Mercado Pago para payment_id ${paymentId}: ${responseText.slice(0, 500)}`,
    },
  }).catch(() => null);

  params.set("sync", ok ? "ok" : "error");
  params.set("q", transactionId || paymentId || q);
  redirect(`/admin/pagamentos?${params.toString()}`);
}

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
  if (!access.authorized) return <AdminLocked nextPath="/admin/pagamentos" />;

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
        {params.sync === "ok" && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Sincronização Mercado Pago executada.</div>}
        {params.sync === "error" && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Falha ao sincronizar Mercado Pago. Veja webhooks/suporte.</div>}
        {params.sync === "missing_app_url" && <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-bold text-yellow-800">Configure APP_URL ou NEXT_PUBLIC_APP_URL para sincronizar.</div>}

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_170px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar payment_id, referência, pedido ou e-mail" />
          <select name="status" defaultValue={status}><option value="ALL">Todos</option><option value="PENDING">Aguardando pagamento</option><option value="APPROVED">Pagamento confirmado</option><option value="REJECTED">Pagamento não aprovado</option><option value="EXPIRED">Reserva expirada</option><option value="REFUNDED">Reembolso processado</option></select>
          <button>Filtrar</button>
        </form>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="admin-table-card">
            <div className="admin-table-header"><h2>Pedidos financeiros</h2><span className="text-xs font-bold text-slate-500">{payments.length} registros</span></div>
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th className="text-left">Pedido / área</th><th className="text-left">Cliente</th><th className="text-left">Status</th><th className="text-left">Valor</th><th className="text-left">Mercado Pago</th><th className="text-left">Datas</th><th className="text-right">Ações</th></tr></thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td><p className="font-black text-slate-950">{shortId(payment.id)}</p><p className="text-[11px] font-bold text-slate-400">{areaLabel(payment.kind)}</p></td>
                      <td><p className="font-black text-slate-800">{payment.user?.name || "Cliente"}</p><p className="text-[11px] font-bold text-slate-500">{payment.user?.email || "sem e-mail"}</p></td>
                      <td><AdminStatusBadge value={payment.status} /></td>
                      <td className="font-black text-slate-950">{money(payment.totalPaidCents)}</td>
                      <td><p className="font-bold text-slate-700">{payment.mpStatus || "sem status"}</p><p className="text-[11px] font-bold text-slate-400">{payment.mpPaymentId || "sem ID Mercado Pago"}</p><p className="text-[11px] font-bold text-slate-400">{shortId(payment.mpExternalReference)}</p></td>
                      <td><p className="text-[11px] font-bold text-slate-600">Criado: {dateTime(payment.createdAt)}</p><p className="text-[11px] font-bold text-slate-400">Pago: {dateTime(payment.paidAt || payment.approvedAt)}</p></td>
                      <td><div className="admin-row-actions"><Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(payment.id)}`, secret)} className="admin-row-link">Suporte</Link><Link href={withAdminSecret(`/admin/webhooks?q=${encodeURIComponent(payment.mpPaymentId || payment.id)}`, secret)} className="admin-row-link">Webhooks</Link>{payment.mpPaymentId && <form action={syncMercadoPagoPayment}><input type="hidden" name="secret" value={secret} /><input type="hidden" name="paymentId" value={payment.mpPaymentId} /><input type="hidden" name="transactionId" value={payment.id} /><input type="hidden" name="status" value={status} /><input type="hidden" name="q" value={q} /><button className="admin-row-link">Sincronizar</button></form>}</div></td>
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
                  <p className="mt-1 text-[11px] font-bold text-slate-500">ID Mercado Pago: {event.paymentId || "—"}</p>
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
