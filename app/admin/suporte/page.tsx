import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, money, safeListQuery, shortId, muralBlockHref, withAdminSecret } from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { createManagementToken, getManagementUrl, hashManagementToken } from "@/lib/customer-access";

export const dynamic = "force-dynamic";

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

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function parseCoordinate(query: string) {
  const text = query.toLowerCase().trim();
  const match = text.match(/x?\s*(\d{1,3})\s*[,/\- ]\s*y?\s*(\d{1,3})/) || text.match(/x\s*(\d{1,3}).*y\s*(\d{1,3})/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function addSupportNote(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const transactionId = String(formData.get("transactionId") || "");
  const customerId = String(formData.get("customerId") || "");
  const q = String(formData.get("q") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  const category = String(formData.get("category") || "SUPPORT").trim().slice(0, 40);

  if (!note || note.length < 3) return;

  await (prisma as any).supportNote.create({
    data: {
      transactionId: transactionId || null,
      customerId: customerId || null,
      adminId,
      category,
      note,
    },
  });

  revalidatePath("/admin/suporte");
  const query = q ? `?q=${encodeURIComponent(q)}${secret ? `&secret=${encodeURIComponent(secret)}` : ""}` : `${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;
  redirect(`/admin/suporte${query}`);
}

async function regenerateManagementLink(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const transactionId = String(formData.get("transactionId") || "");
  const q = String(formData.get("q") || "");
  if (!transactionId) return;

  const token = createManagementToken();
  await (prisma as any).transaction.update({
    where: { id: transactionId },
    data: {
      managementTokenHash: hashManagementToken(token),
      managementTokenCreatedAt: new Date(),
    },
  });

  await (prisma as any).supportNote.create({
    data: {
      transactionId,
      adminId,
      category: "MANAGEMENT_LINK",
      note: "Novo link de gerenciamento gerado pelo suporte.",
    },
  }).catch(() => null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (secret) params.set("secret", secret);
  params.set("generatedOrder", transactionId);
  params.set("generatedToken", token);

  redirect(`/admin/suporte?${params.toString()}`);
}

function statusPill(status: string | null | undefined) {
  const value = status || "—";
  const color = value === "APPROVED" ? "bg-emerald-50 text-emerald-700" : value === "PENDING" ? "bg-yellow-50 text-yellow-700" : value === "CANCELLED" || value === "REJECTED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${color}`}>{value}</span>;
}

export default async function AdminSuportePage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/suporte" />;

  const q = normalizeSearch(params.q);
  const generatedToken = normalizeSearch(params.generatedToken);
  const generatedOrder = normalizeSearch(params.generatedOrder);
  const coord = parseCoordinate(q);
  const digits = onlyDigits(q);

  const where: any = q
    ? {
        OR: [
          { id: { contains: q, mode: "insensitive" } },
          { mpPaymentId: { contains: q, mode: "insensitive" } },
          { mpExternalReference: { contains: q, mode: "insensitive" } },
          { placementTitle: { contains: q, mode: "insensitive" } },
          { placementRedirectUrl: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { publicName: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
          ...(digits.length >= 6 ? [{ checkoutWhatsapp: { contains: digits } }, { user: { whatsapp: { contains: digits } } }] : []),
          ...(coord ? [{ items: { some: { gridX: coord.x, gridY: coord.y } } }] : []),
        ],
      }
    : {};

  const transactions = await safeListQuery(() => (prisma as any).transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: q ? 30 : 20,
    include: {
      user: true,
      items: true,
      placement: { include: { blocks: { take: 6 }, reports: { orderBy: { createdAt: "desc" }, take: 5 }, editRequests: { orderBy: { createdAt: "desc" }, take: 5 } } },
      webhookEvents: { orderBy: { receivedAt: "desc" }, take: 3 },
      supportNotes: { orderBy: { createdAt: "desc" }, take: 6, include: { admin: true } },
      disputeCases: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  }));

  const generatedUrl = generatedToken ? getManagementUrl(generatedToken, getCleanAppUrl()) : "";

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="suporte" title="Suporte operacional" description="Busca rápida por pedido, cliente, WhatsApp, payment_id ou coordenada para resolver atendimento sem mexer no banco manualmente." />

        <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_140px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Busque por nome, WhatsApp, e-mail, payment_id, pedido ou x10/y20" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
          <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Buscar</button>
        </form>

        {generatedUrl && (
          <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-emerald-700">Link de gerenciamento gerado</p>
            <h2 className="mt-1 text-xl font-black text-emerald-950">Envie este link ao cliente</h2>
            <input readOnly value={generatedUrl} className="mt-3 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-bold text-emerald-950" />
            <p className="mt-2 text-xs font-bold text-emerald-800">Pedido: {shortId(generatedOrder)}. Esse link aparece só agora nesta tela por segurança.</p>
          </section>
        )}

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Resultados</p><p className="mt-1 text-2xl font-black">{transactions.length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Aprovados</p><p className="mt-1 text-2xl font-black">{transactions.filter((t: any) => t.status === "APPROVED").length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Pendentes</p><p className="mt-1 text-2xl font-black">{transactions.filter((t: any) => t.status === "PENDING").length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Com denúncia</p><p className="mt-1 text-2xl font-black">{transactions.filter((t: any) => (t.placement?.reports || []).length > 0).length}</p></div>
        </section>

        <section className="space-y-4">
          {transactions.map((transaction: any) => {
            const firstBlock = transaction.items?.[0];
            const publicBlockId = transaction.placement?.blocks?.[0]?.id || firstBlock?.blockId;
            const whatsapp = transaction.checkoutWhatsapp || transaction.user?.whatsapp || "";
            const email = transaction.user?.email || "";
            const manageCanGenerate = transaction.status === "APPROVED" && transaction.placement;
            return (
              <article key={transaction.id} className="rounded-3xl bg-white p-5 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusPill(transaction.status)}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">{transaction.kind}</span>
                      {transaction.isTest && <span className="rounded-full bg-purple-50 px-3 py-1 text-[10px] font-black uppercase text-purple-700">Teste</span>}
                    </div>
                    <h2 className="mt-2 text-xl font-black text-slate-950">{transaction.user?.name || transaction.placementTitle || "Cliente"}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-600">Nome público: {transaction.user?.publicName || transaction.placement?.displayName || transaction.placementTitle || "—"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Pedido: {transaction.id} • Payment ID: {transaction.mpPaymentId || "—"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Criado: {dateTime(transaction.createdAt)} • Aprovado: {dateTime(transaction.approvedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-right">
                    <p className="text-xs font-black text-slate-500">Valor</p>
                    <p className="text-xl font-black text-slate-950">{money(transaction.totalPaidCents)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{transaction.items?.length || 0} bloco(s)</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Contato</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">WhatsApp: {whatsapp || "—"}</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">E-mail: {email || "—"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {whatsapp && <a className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white" href={`https://wa.me/55${whatsapp}`} target="_blank">WhatsApp</a>}
                      {email && <a className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white" href={`mailto:${email}`}>E-mail</a>}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Blocos</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-sm font-bold">{(transaction.items || []).slice(0, 12).length ? (transaction.items || []).slice(0, 12).map((item: any) => <Link key={item.id || item.blockId} href={muralBlockHref(item.blockId)} className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">x{item.gridX}/y{item.gridY}</Link>) : <span className="text-slate-500">—</span>}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={withAdminSecret(`/admin/pedidos?q=${encodeURIComponent(transaction.id)}`, secret)} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Abrir pedido</Link>
                      {publicBlockId && <Link href={muralBlockHref(publicBlockId)} className="rounded-full bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">Ver no mural</Link>}
                      {publicBlockId && <Link href={`/bloco/${publicBlockId}`} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Página pública</Link>}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Gerenciamento</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">{transaction.managementTokenCreatedAt ? `Último token: ${dateTime(transaction.managementTokenCreatedAt)}` : "Sem link recente registrado"}</p>
                    {manageCanGenerate && (
                      <form action={regenerateManagementLink} className="mt-3">
                        <input type="hidden" name="secret" value={secret} />
                        <input type="hidden" name="transactionId" value={transaction.id} />
                        <input type="hidden" name="q" value={q || transaction.id} />
                        <button className="w-full rounded-full bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950">Gerar novo link</button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Conteúdo</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">{transaction.placement?.title || transaction.placement?.displayName || transaction.placementTitle || "—"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Review: {transaction.placement?.reviewStatus || "—"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Link: {transaction.placement?.linkDisabled ? "bloqueado" : transaction.placement?.redirectUrl || transaction.placementRedirectUrl || "—"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Pendências</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">Denúncias: {transaction.placement?.reports?.length || 0}</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">Edições: {transaction.placement?.editRequests?.length || 0}</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">Webhooks recentes: {transaction.webhookEvents?.length || 0}</p>
                  </div>

                  <form action={addSupportNote} className="rounded-2xl border border-slate-200 p-3">
                    <input type="hidden" name="secret" value={secret} />
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <input type="hidden" name="customerId" value={transaction.userId} />
                    <input type="hidden" name="q" value={q || transaction.id} />
                    <p className="text-xs font-black uppercase text-slate-500">Observação interna</p>
                    <select name="category" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                      <option value="SUPPORT">Suporte</option>
                      <option value="PAYMENT">Pagamento</option>
                      <option value="CONTENT">Conteúdo</option>
                      <option value="CUSTOMER_CONTACT">Contato</option>
                    </select>
                    <textarea name="note" required minLength={3} rows={3} placeholder="Ex: cliente chamou no WhatsApp pedindo novo link..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-slate-950" />
                    <button className="mt-2 w-full rounded-xl bg-slate-950 py-2 text-xs font-black text-white">Salvar nota</button>
                  </form>
                </div>

                {transaction.supportNotes?.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Histórico de suporte</p>
                    <div className="mt-2 space-y-2">
                      {transaction.supportNotes.map((note: any) => (
                        <div key={note.id} className="rounded-xl bg-white p-3 text-xs font-bold text-slate-600">
                          <p className="font-black text-slate-900">{note.category || "SUPORTE"} • {dateTime(note.createdAt)} • {note.admin?.email || note.admin?.name || "Admin"}</p>
                          <p className="mt-1">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {transactions.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum pedido encontrado para essa busca.</p>}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Respostas rápidas</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["Pagamento pendente", "Seu pagamento ainda está aparecendo como pendente. A confirmação real vem pelo Mercado Pago e pode levar alguns instantes."],
              ["Pagamento aprovado", "Pagamento confirmado! Seu espaço já foi reservado/publicado conforme o status do pedido."],
              ["Conteúdo em análise", "Seu conteúdo foi publicado automaticamente e pode passar por revisão conforme as regras do Mural29."],
              ["Edição enviada", "Sua alteração foi enviada para aprovação. O conteúdo atual continua no mural até a nova versão ser aprovada."],
              ["Link bloqueado", "O link enviado não pôde ser usado por regra de segurança/moderação. Envie outro link começando com https://."],
              ["Imagem recusada", "A imagem precisa seguir as regras de conteúdo e estar em JPG, PNG ou WEBP com até 5MB."],
            ].map(([title, text]) => <div key={title} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black text-slate-950">{title}</p><p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{text}</p></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
