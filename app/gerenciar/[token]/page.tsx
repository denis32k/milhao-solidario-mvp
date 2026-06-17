import Link from "next/link";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashManagementToken } from "@/lib/customer-access";
import { dateTime, money, safeValueQuery } from "@/lib/admin";
import { findBlockedDomain, getHostnameFromUrl, normalizePublicUrl, validateImageFile } from "@/lib/content-validation";

export const dynamic = "force-dynamic";

type ManagePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeExternalUrl(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw.slice(0, 300);
  if (raw.startsWith("@")) {
    const handle = raw.replace("@", "").replace(/[^a-zA-Z0-9._]/g, "");
    return handle ? `https://instagram.com/${handle}` : "";
  }
  if (/^[a-zA-Z0-9._-]+$/.test(raw)) return `https://instagram.com/${raw}`;
  if (raw.includes(".") && !raw.includes(" ")) return `https://${raw}`.slice(0, 300);
  return "";
}

async function savePendingImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) return null;
  if (!file.size) return null;

  const validation = validateImageFile(file);
  if (!validation.ok || !validation.extension) {
    throw new Error(validation.message);
  }

  const filename = `edicao-${Date.now()}-${randomUUID()}.${validation.extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filepath = path.join(uploadDir, filename);
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  return `/uploads/${filename}`;
}

async function requestEdit(formData: FormData) {
  "use server";

  const token = safeText(formData.get("token"), 200);
  const reason = safeText(formData.get("reason"), 500);

  if (!token || reason.length < 5) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=motivo`);
  }

  const transaction = await prisma.transaction.findUnique({
    where: { managementTokenHash: hashManagementToken(token) },
    include: { user: true, placement: true },
  });

  if (!transaction || !transaction.placement) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);
  }

  if (transaction.status !== "APPROVED") {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pagamento`);
  }

  let requestedImageUrl: string | null = null;
  try {
    requestedImageUrl = await savePendingImage(formData.get("image"));
  } catch {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=imagem`);
  }
  const requestedTitle = safeText(formData.get("title"), 80) || null;
  const requestedDisplayName = safeText(formData.get("displayName"), 80) || null;
  const requestedDescription = safeText(formData.get("description"), 240) || null;
  const rawRequestedRedirectUrl = formData.get("redirectUrl");
  const requestedRedirectUrl = normalizePublicUrl(rawRequestedRedirectUrl) || null;
  const requestedTextLabel = requestedTitle || requestedDisplayName || null;

  const rawRequestedRedirectText = String(rawRequestedRedirectUrl || "").trim();
  if (rawRequestedRedirectText && !requestedRedirectUrl) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_invalido`);
  }

  if (requestedRedirectUrl) {
    const blockedDomain = await findBlockedDomain(prisma, requestedRedirectUrl);
    if (blockedDomain) {
      await (prisma as any).linkModerationLog.create({
        data: {
          url: requestedRedirectUrl,
          domain: getHostnameFromUrl(requestedRedirectUrl),
          action: "BLOCKED_EDIT_REQUEST",
          reason: blockedDomain.reason || "Domínio bloqueado no admin.",
          transactionId: transaction.id,
          placementId: transaction.placement.id,
        },
      }).catch(() => null);
      redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_bloqueado`);
    }
  }

  if (!requestedTitle && !requestedDisplayName && !requestedDescription && !requestedRedirectUrl && !requestedImageUrl) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=sem_alteracao`);
  }

  await prisma.contentEditRequest.create({
    data: {
      placementId: transaction.placement.id,
      userId: transaction.userId,
      reason,
      status: "PENDING",
      requestedTitle,
      requestedDisplayName,
      requestedDescription,
      requestedRedirectUrl,
      requestedImageUrl,
      requestedTextLabel,
    },
  });

  redirect(`/gerenciar/${encodeURIComponent(token)}?sent=1`);
}

export default async function ManageOrderPage({ params, searchParams }: ManagePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const tokenHash = hashManagementToken(token);

  const transaction = await safeValueQuery(() =>
    prisma.transaction.findUnique({
      where: { managementTokenHash: tokenHash },
      include: {
        user: true,
        placement: { include: { blocks: { take: 10 } } },
        items: true,
      },
    }),
    null
  );

  if (!transaction) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Link inválido</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Não encontramos esse link de gerenciamento. Confira se ele foi copiado inteiro.</p>
          <Link href="/" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const placement = (transaction as any).placement;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const sent = query.sent === "1";
  const editRequests = await safeValueQuery(() =>
    prisma.contentEditRequest.findMany({
      where: { placementId: placement?.id || "" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    []
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>

        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Gerenciar conteúdo</p>
          <h1 className="mt-2 text-3xl font-black">Seu espaço no Mural29</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-300">Aqui você vê o conteúdo atual e solicita alterações. O conteúdo publicado continua no mural até uma nova versão ser aprovada.</p>
        </section>

        {sent && <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">Solicitação enviada. Vamos analisar sua alteração.</div>}
        {error && <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">Não foi possível enviar: {error === "motivo" ? "informe um motivo com pelo menos 5 caracteres." : error === "sem_alteracao" ? "preencha pelo menos uma alteração." : error === "pagamento" ? "o pagamento ainda não está aprovado." : error === "imagem" ? "a imagem precisa ser JPG, PNG ou WEBP e ter até 5MB." : error === "link_invalido" ? "o link informado não é válido." : error === "link_bloqueado" ? "esse domínio está bloqueado para publicação." : "pedido não encontrado."}</div>}

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-slate-500">Pedido</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{(transaction as any).user?.name || "Cliente"}</h2>
            <p className="mt-2 text-sm font-bold text-slate-600">Status do pagamento: {(transaction as any).status}</p>
            <p className="mt-1 text-sm font-bold text-slate-600">Valor: {money((transaction as any).totalPaidCents)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Criado: {dateTime((transaction as any).createdAt)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Aprovado: {dateTime((transaction as any).approvedAt)}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-slate-500">Blocos</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{(transaction as any).items?.length || 0} tijolinho(s)</h2>
            <p className="mt-2 text-sm font-bold text-slate-600">Área: {(transaction as any).kind}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{((transaction as any).items || []).slice(0, 12).map((item: any) => `x${item.gridX}/y${item.gridY}`).join(", ")}</p>
          </div>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase text-slate-500">Conteúdo atual publicado</p>
          {!placement && <p className="mt-3 text-sm font-bold text-slate-500">O conteúdo ainda não foi publicado. Aguarde a confirmação do pagamento/webhook.</p>}
          {placement && (
            <div className="mt-4 grid gap-4 md:grid-cols-[120px_1fr]">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-slate-100">
                {placement.imageUrl ? <img src={placement.imageUrl} alt="Conteúdo atual" className="h-full w-full object-cover" /> : <span className="text-xs font-black text-slate-400">Sem imagem</span>}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">{placement.title || placement.displayName || "Sem título"}</h2>
                <p className="mt-1 text-sm font-bold text-slate-600">Nome público: {placement.displayName || "—"}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Link: {placement.linkDisabled ? "bloqueado" : placement.redirectUrl || "sem link"}</p>
                <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">{placement.description || "Sem descrição."}</p>
                <p className="mt-2 text-xs font-black text-yellow-700">Status interno: {placement.reviewStatus}</p>
              </div>
            </div>
          )}
        </section>

        {placement && (transaction as any).status === "APPROVED" && (
          <section className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-slate-500">Solicitar alteração</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Nova versão para aprovação</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Sua alteração será enviada para análise. O conteúdo atual continuará aparecendo no mural até que a nova versão seja aprovada.</p>

            <form action={requestEdit} encType="multipart/form-data" className="mt-5 space-y-3">
              <input type="hidden" name="token" value={token} />
              <input name="title" placeholder="Novo título/nome do bloco" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
              <input name="displayName" placeholder="Novo nome público" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
              <input name="redirectUrl" placeholder="Novo link ou @instagram" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
              <textarea name="description" rows={3} placeholder="Nova frase/descrição" className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Nova imagem/logo</p>
                <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 w-full rounded-2xl bg-white px-3 py-3 text-sm font-bold" />
              </div>
              <textarea name="reason" required minLength={5} rows={3} placeholder="Motivo da alteração obrigatório. Ex: escrevi o nome errado, quero atualizar a logo, link antigo não funciona..." className="w-full resize-none rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-bold outline-none focus:border-yellow-600" />
              <button className="w-full rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Enviar alteração para aprovação</button>
            </form>
          </section>
        )}

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase text-slate-500">Histórico de solicitações</p>
          <div className="mt-4 space-y-2">
            {(editRequests as any[]).length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma alteração solicitada ainda.</p>}
            {(editRequests as any[]).map((request: any) => (
              <article key={request.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">{request.status} • {dateTime(request.createdAt)}</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{request.reason}</p>
                {request.adminNote && <p className="mt-1 text-xs font-bold text-slate-500">Resposta admin: {request.adminNote}</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
