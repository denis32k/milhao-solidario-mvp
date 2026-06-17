import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function isSecretAuthorized(secret: string | null) {
  const expected = process.env.ADMIN_API_SECRET;
  return Boolean(expected && secret === expected);
}

async function isAuthorized(request: Request) {
  const url = new URL(request.url);
  if (isSecretAuthorized(url.searchParams.get("secret"))) return true;
  const session = await getAdminSession();
  return Boolean(session?.user);
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "sem_dados\n";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "orders";
  const now = new Date();
  let rows: Array<Record<string, unknown>> = [];

  if (type === "orders") {
    const data = await (prisma as any).transaction.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: true, items: true } });
    rows = data.map((t: any) => ({ pedido: t.id, status: t.status, area: t.kind, cliente: t.user?.name, email: t.user?.email, whatsapp: t.checkoutWhatsapp || t.user?.whatsapp, valor_centavos: t.totalPaidCents, mp_payment_id: t.mpPaymentId, criado_em: t.createdAt, aprovado_em: t.approvedAt, blocos: t.items?.length || 0 }));
  } else if (type === "payments") {
    const data = await (prisma as any).transaction.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: true } });
    rows = data.map((t: any) => ({ pedido: t.id, status: t.status, mp_status: t.mpStatus, mp_status_detail: t.mpStatusDetail, payment_id: t.mpPaymentId, cliente: t.user?.name, valor_centavos: t.totalPaidCents, criado_em: t.createdAt, pago_em: t.paidAt, aprovado_em: t.approvedAt }));
  } else if (type === "clients") {
    const data = await (prisma as any).user.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
    rows = data.map((u: any) => ({ id: u.id, nome: u.name, nome_publico: u.publicName, email: u.email, whatsapp: u.whatsapp, total_aprovado_centavos: u.totalApprovedCents, role: u.role, banido: u.isBanned, criado_em: u.createdAt }));
  } else if (type === "blocks") {
    const data = await (prisma as any).block.findMany({ where: { status: { in: ["SOLD", "RESERVED", "LOCKED", "BLOCKED"] } }, orderBy: [{ gridY: "asc" }, { gridX: "asc" }], take: 29000, include: { owner: true, placement: true } });
    rows = data.map((b: any) => ({ id: b.id, x: b.gridX, y: b.gridY, area: b.category, status: b.status, disponivel: b.available, dono: b.owner?.name, conteudo: b.placement?.title || b.placement?.displayName, review: b.placement?.reviewStatus }));
  } else if (type === "logs") {
    const data = await (prisma as any).adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { admin: true } });
    rows = data.map((a: any) => ({ id: a.id, tipo: a.type, admin: a.admin?.email || a.admin?.name, nota: a.note, placement_id: a.placementId, block_id: a.blockId, report_id: a.reportId, criado_em: a.createdAt }));
  } else if (type === "webhooks") {
    const data = await (prisma as any).paymentWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 5000 });
    rows = data.map((e: any) => ({ id: e.id, event_id: e.eventId, tipo: e.eventType, payment_id: e.paymentId, status_anterior: e.previousStatus, status_novo: e.newStatus, processado: e.processed, ignorado: e.ignored, erro: e.error, recebido_em: e.receivedAt }));
  } else if (type === "consents") {
    const data = await (prisma as any).consentLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: true, transaction: true } });
    rows = data.map((c: any) => ({ id: c.id, usuario: c.user?.email || c.user?.name, pedido: c.transactionId, termos: c.termsVersion, privacidade: c.privacyVersion, regras: c.contentRulesVersion, canal: c.channel, aceite_em: c.acceptedAt, ip_hash_registrado: Boolean(c.ipHash) }));
  } else if (type === "blocked-links") {
    const domains = await (prisma as any).blockedDomain.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }], take: 5000, include: { createdByAdmin: true } });
    const logs = await (prisma as any).linkModerationLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
    rows = [
      ...domains.map((d: any) => ({ tipo: "dominio", id: d.id, dominio: d.domain, ativo: d.active, acao: "BLOCKED_DOMAIN", motivo: d.reason, admin: d.createdByAdmin?.email || d.createdByAdmin?.name, criado_em: d.createdAt, atualizado_em: d.updatedAt })),
      ...logs.map((l: any) => ({ tipo: "log", id: l.id, dominio: l.domain, ativo: "", acao: l.action, motivo: l.reason, url: l.url, pedido: l.transactionId, conteudo: l.placementId, criado_em: l.createdAt })),
    ];
  } else if (type === "support") {
    const data = await (prisma as any).supportNote.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { transaction: { include: { user: true } }, customer: true, admin: true } });
    rows = data.map((n: any) => ({ id: n.id, categoria: n.category, nota: n.note, pedido: n.transactionId, cliente: n.customer?.email || n.customer?.name || n.transaction?.user?.name, admin: n.admin?.email || n.admin?.name, criado_em: n.createdAt }));
  } else {
    rows = [{ erro: "tipo de exportação inválido" }];
  }

  await (prisma as any).exportLog.create({ data: { type, format: "csv", filters: Object.fromEntries(url.searchParams.entries()) } }).catch(() => null);

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mural29-${type}-${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
