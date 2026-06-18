import Link from "next/link";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashManagementToken } from "@/lib/customer-access";
import { dateTime, money, safeValueQuery } from "@/lib/admin";
import { findBlockedDomain, getHostnameFromUrl, normalizePublicUrl, validateImageFile } from "@/lib/content-validation";
import { getOperationalSettings } from "@/lib/system-settings";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type ManagePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function statusLabel(status: string | null | undefined) {
  if (status === "APPROVED") return "Pagamento aprovado";
  if (status === "PENDING") return "Aguardando PIX";
  if (status === "REJECTED") return "Pagamento recusado";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "EXPIRED") return "Expirado";
  if (status === "REFUNDED") return "Reembolsado";
  return status || "Status não informado";
}

function editStatusLabel(status: string | null | undefined) {
  if (status === "PENDING") return "Em análise";
  if (status === "APPROVED") return "Aprovada";
  if (status === "REJECTED") return "Rejeitada";
  return status || "Pendente";
}

function getDefaultFillColor(kind: string) {
  if (kind === "GRAND_CENTER") return "#c026d3";
  if (kind === "GOLD") return "#f59e0b";
  if (kind === "PREMIUM") return "#0f172a";
  return "#22c55e";
}

async function savePendingImage(file: FormDataEntryValue | null, maxImageMb: number) {
  if (!(file instanceof File)) return null;
  if (!file.size) return null;

  const validation = validateImageFile(file, maxImageMb * 1024 * 1024);
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

async function refreshPaymentStatus(formData: FormData) {
  "use server";

  const token = safeText(formData.get("token"), 240);
  if (!token) redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);

  const transaction = await prisma.transaction.findUnique({
    where: { managementTokenHash: hashManagementToken(token) },
    select: { mpPaymentId: true },
  });

  if (!transaction?.mpPaymentId) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);
  }

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (!appUrl) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=app_url`);
  }

  await fetch(`${appUrl}/api/mercado-pago-pix/webhook?type=payment&data.id=${encodeURIComponent(transaction.mpPaymentId)}`, { cache: "no-store" }).catch(() => null);
  redirect(`/gerenciar/${encodeURIComponent(token)}?updated=1`);
}

async function publishInitialPersonalization(formData: FormData) {
  "use server";

  const token = safeText(formData.get("token"), 240);
  const displayName = safeText(formData.get("displayName"), 60);

  if (!token) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);
  }

  if (!displayName || displayName.length < 2) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=nome`);
  }

  const transaction = await prisma.transaction.findUnique({
    where: { managementTokenHash: hashManagementToken(token) },
    include: { user: true, placement: true, items: true },
  });

  if (!transaction) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);
  }

  if (transaction.status !== "APPROVED") {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pagamento`);
  }

  const settings = await getOperationalSettings();
  if (settings.maintenanceMode) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=manutencao`);
  }

  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size && !settings.uploadsEnabled) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=upload_desativado`);
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await savePendingImage(imageFile, settings.maxImageMb);
  } catch {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=imagem`);
  }

  const rawRedirectUrl = formData.get("redirectUrl");
  const rawRedirectText = String(rawRedirectUrl || "").trim();
  const redirectUrl = normalizePublicUrl(rawRedirectUrl) || null;

  if (rawRedirectText && !settings.publicLinksEnabled) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_desativado`);
  }

  if (rawRedirectText && !redirectUrl) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_invalido`);
  }

  if (redirectUrl) {
    const blockedDomain = await findBlockedDomain(prisma, redirectUrl);
    if (blockedDomain) {
      await (prisma as any).linkModerationLog.create({
        data: {
          url: redirectUrl,
          domain: getHostnameFromUrl(redirectUrl),
          action: "BLOCKED_INITIAL_PERSONALIZATION",
          reason: blockedDomain.reason || "Domínio bloqueado no admin.",
          transactionId: transaction.id,
          placementId: transaction.placement?.id || null,
        },
      }).catch(() => null);
      redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_bloqueado`);
    }
  }

  const items = (transaction as any).items || [];
  const blockIds = items.map((item: any) => item.blockId).filter(Boolean);
  const primaryBlockId = blockIds[0] || null;

  if (!items.length || !primaryBlockId) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=pedido`);
  }

  const minX = Math.min(...items.map((item: any) => item.gridX));
  const maxX = Math.max(...items.map((item: any) => item.gridX));
  const minY = Math.min(...items.map((item: any) => item.gridY));
  const maxY = Math.max(...items.map((item: any) => item.gridY));
  const widthBlocks = maxX - minX + 1;
  const heightBlocks = maxY - minY + 1;
  const fillColor = (transaction as any).placementFillColor || transaction.placement?.fillColor || getDefaultFillColor((transaction as any).kind);

  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({
      where: { id: transaction.userId },
      data: { publicName: displayName },
    });

    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        placementTitle: displayName,
        placementDescription: null,
        placementRedirectUrl: redirectUrl,
        placementImageUrl: imageUrl,
        placementFillColor: fillColor,
      },
    });

    const placement = await tx.placement.upsert({
      where: { transactionId: transaction.id },
      update: {
        status: "ACTIVE",
        reviewStatus: "PUBLISHED_NOT_REVIEWED",
        title: displayName,
        description: null,
        displayName,
        textLabel: displayName,
        imageUrl,
        redirectUrl,
        linkDisabled: false,
        placeholderReason: null,
        fillColor,
        originX: minX,
        originY: minY,
        widthBlocks,
        heightBlocks,
      },
      create: {
        kind: (transaction as any).kind,
        status: "ACTIVE",
        reviewStatus: "PUBLISHED_NOT_REVIEWED",
        userId: transaction.userId,
        transactionId: transaction.id,
        title: displayName,
        description: null,
        displayName,
        textLabel: displayName,
        imageUrl,
        redirectUrl,
        fillColor,
        originX: minX,
        originY: minY,
        widthBlocks,
        heightBlocks,
      },
    });

    await tx.block.updateMany({
      where: { id: { in: blockIds } },
      data: {
        status: "SOLD",
        available: false,
        ownerId: transaction.userId,
        currentTransactionId: transaction.id,
        placementId: placement.id,
        reservationToken: null,
        reservedUntil: null,
      },
    });
  });

  redirect(`/?bloco=${encodeURIComponent(primaryBlockId)}&publicado=1`);
}

async function requestEdit(formData: FormData) {
  "use server";

  const token = safeText(formData.get("token"), 240);
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

  const settings = await getOperationalSettings();
  if (settings.maintenanceMode) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=manutencao`);
  }

  const requestedDisplayName = safeText(formData.get("displayName"), 80) || null;
  const imageFile = formData.get("image");

  if (imageFile instanceof File && imageFile.size && !settings.uploadsEnabled) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=upload_desativado`);
  }

  let requestedImageUrl: string | null = null;
  try {
    requestedImageUrl = await savePendingImage(imageFile, settings.maxImageMb);
  } catch {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=imagem`);
  }

  const rawRequestedRedirectUrl = formData.get("redirectUrl");
  const rawRequestedRedirectText = String(rawRequestedRedirectUrl || "").trim();
  const requestedRedirectUrl = normalizePublicUrl(rawRequestedRedirectUrl) || null;

  if (rawRequestedRedirectText && !settings.publicLinksEnabled) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=link_desativado`);
  }

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

  if (!requestedDisplayName && !requestedRedirectUrl && !requestedImageUrl) {
    redirect(`/gerenciar/${encodeURIComponent(token)}?error=sem_alteracao`);
  }

  await prisma.contentEditRequest.create({
    data: {
      placementId: transaction.placement.id,
      userId: transaction.userId,
      reason,
      status: "PENDING",
      requestedTitle: requestedDisplayName,
      requestedDisplayName,
      requestedDescription: null,
      requestedRedirectUrl,
      requestedImageUrl,
      requestedTextLabel: requestedDisplayName,
    },
  });

  redirect(`/gerenciar/${encodeURIComponent(token)}?sent=1`);
}

function getErrorText(error: string | string[] | undefined) {
  const value = Array.isArray(error) ? error[0] : error;
  if (value === "motivo") return "Informe um motivo com pelo menos 5 caracteres.";
  if (value === "nome") return "Informe o nome público que aparecerá no mural.";
  if (value === "sem_alteracao") return "Preencha pelo menos nome, link ou imagem para solicitar alteração.";
  if (value === "pagamento") return "O pagamento ainda não está aprovado.";
  if (value === "imagem") return "A imagem precisa ser JPG, PNG ou WEBP e respeitar o limite configurado.";
  if (value === "link_invalido") return "Use o link completo com https:// ou http://. Ex: https://instagram.com/meuusuario.";
  if (value === "link_desativado") return "Links públicos estão temporariamente desativados.";
  if (value === "upload_desativado") return "Uploads estão temporariamente desativados.";
  if (value === "manutencao") return "O Mural29 está em manutenção no momento.";
  if (value === "app_url") return "APP_URL/NEXT_PUBLIC_APP_URL não está configurado para atualizar o pagamento automaticamente.";
  if (value === "link_bloqueado") return "Esse domínio está bloqueado para publicação.";
  if (value) return "Não foi possível enviar a solicitação. Confira os dados e tente novamente.";
  return "";
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
        placement: { include: { blocks: { take: 10, orderBy: [{ gridY: "asc" }, { gridX: "asc" }] } } },
        items: { orderBy: [{ gridY: "asc" }, { gridX: "asc" }] },
      },
    }),
    null
  );

  if (!transaction) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8">
        <div className="pixel-panel mx-auto max-w-md p-6 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Link inválido</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Não encontramos esse link de gerenciamento. Confira se ele foi copiado inteiro.</p>
          <Link href="/" className="pixel-btn pixel-btn--dark mt-5 flex justify-center !rounded-2xl !py-4 !text-sm">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const placement = (transaction as any).placement;
  const sent = query.sent === "1";
  const updated = query.updated === "1";
  const errorText = getErrorText(query.error);
  const editRequests = await safeValueQuery(() =>
    prisma.contentEditRequest.findMany({
      where: { placementId: placement?.id || "" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    []
  );

  const items = (transaction as any).items || [];
  const coordinates = items.slice(0, 14).map((item: any) => `x${item.gridX}/y${item.gridY}`).join(" • ");
  const extra = items.length > 14 ? ` +${items.length - 14}` : "";
  const displayName = placement?.displayName || placement?.title || "Espaço comprado";
  const isWaitingPersonalization = displayName === "Espaço comprado";

  return (
    <main className="min-h-screen bg-transparent px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="pixel-btn pixel-btn--light mb-5 !rounded-2xl !px-4 !py-2 !text-sm">← Voltar ao mural</Link>

        <section className="rounded-[2rem] border-2 border-slate-950 bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#f97316)] p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Área do comprador</p>
          <h1 className="mt-2 text-3xl font-black">Gerencie seu espaço no Mural29</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-slate-300">Aqui você acompanha o pedido e, se fechar o checkout sem querer, consegue personalizar seu espaço depois do pagamento aprovado.</p>
        </section>

        {sent && <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">Solicitação enviada. O conteúdo atual continua no mural enquanto a nova versão é analisada.</div>}
        {updated && <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-black text-blue-800">Status do pagamento atualizado. Se já foi aprovado, a personalização fica liberada abaixo.</div>}
        {errorText && <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">{errorText}</div>}

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="pixel-panel p-5">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Conteúdo atual</p>
            <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr]">
              <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 md:w-44">
                {placement?.imageUrl ? <img src={placement.imageUrl} alt={displayName} className="h-full w-full object-cover" /> : <span className="px-5 text-center text-xs font-black text-slate-400">{isWaitingPersonalization ? "Aguardando imagem" : "Sem imagem"}</span>}
              </div>
              <div>
                <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase text-white">{getAreaName((transaction as any).kind)}</span>
                <h2 className="mt-3 text-2xl font-black text-slate-950">{displayName}</h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{isWaitingPersonalization ? "Seu espaço já foi comprado. Publique a primeira personalização abaixo para aparecer bonito no mural." : "Este é o conteúdo que aparece no mural agora."}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {placement?.redirectUrl && !placement?.linkDisabled ? <a href={placement.redirectUrl} target="_blank" rel="noopener noreferrer" className="pixel-btn pixel-btn--dark justify-center !rounded-2xl !py-3 !text-xs">Abrir link público</a> : <div className="rounded-2xl bg-slate-100 py-3 text-center text-xs font-black text-slate-500">Sem link público</div>}
                  {placement?.blocks?.[0]?.id && <Link href={`/bloco/${placement.blocks[0].id}`} className="pixel-btn pixel-btn--light justify-center !rounded-2xl !py-3 !text-xs">Ver página pública</Link>}
                </div>
              </div>
            </div>
          </div>

          <aside className="pixel-panel p-5">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Resumo do pedido</p>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
              <div className="flex justify-between gap-3"><span>Status</span><strong className="text-right text-slate-950">{statusLabel((transaction as any).status)}</strong></div>
              <div className="flex justify-between gap-3"><span>Valor</span><strong className="text-slate-950">{money((transaction as any).totalPaidCents)}</strong></div>
              <div className="flex justify-between gap-3"><span>Tijolinhos</span><strong className="text-slate-950">{items.length}</strong></div>
              <div className="flex justify-between gap-3"><span>Criado</span><strong className="text-right text-slate-950">{dateTime((transaction as any).createdAt)}</strong></div>
              <div className="flex justify-between gap-3"><span>Aprovado</span><strong className="text-right text-slate-950">{dateTime((transaction as any).approvedAt)}</strong></div>
            </div>
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-relaxed text-slate-500">{coordinates}{extra}</p>
          </aside>
        </section>

        {(transaction as any).status === "PENDING" && (
          <section className="pixel-panel mt-5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-yellow-600">Pagamento pendente</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Já pagou o PIX?</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Se você saiu do checkout, toque abaixo para atualizar o status. Quando o pagamento for aprovado, a personalização será liberada aqui.</p>
            <form action={refreshPaymentStatus} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button className="pixel-btn pixel-btn--green w-full !rounded-2xl !py-4 !text-sm">Atualizar pagamento</button>
            </form>
          </section>
        )}

        {isWaitingPersonalization && (transaction as any).status === "APPROVED" ? (
          <section className="pixel-panel mt-5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">Primeira personalização</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Publicar meu espaço no mural</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Use este formulário caso tenha pago e fechado a tela do checkout. Ao salvar, você vai direto para o mural mostrando o espaço comprado.</p>

            <form action={publishInitialPersonalization} className="mt-5 grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="token" value={token} />
              <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Nome público</span><input name="displayName" placeholder="Nome que aparece no mural" className="pixel-input mt-2" required /></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Link público</span><input name="redirectUrl" placeholder="https://instagram.com/meuusuario" className="pixel-input mt-2" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Imagem do mural</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="pixel-input mt-2 bg-white" /></label>
              <button className="pixel-btn pixel-btn--green w-full !rounded-2xl !py-4 !text-sm lg:col-span-2">Salvar e abrir no mural</button>
            </form>
          </section>
        ) : (
          (transaction as any).status !== "PENDING" && (
          <section className="pixel-panel mt-5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-orange-600">Solicitar alteração</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Trocar nome, link ou imagem</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Edições futuras precisam de motivo e aprovação do admin. O conteúdo atual continua publicado até a aprovação.</p>

            <form action={requestEdit} className="mt-5 grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="token" value={token} />
              <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Novo nome público</span><input name="displayName" placeholder="Nome que aparece no mural" className="pixel-input mt-2" /></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Novo link público</span><input name="redirectUrl" placeholder="https://instagram.com/meuusuario" className="pixel-input mt-2" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Nova imagem</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="pixel-input mt-2 bg-white" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Motivo da alteração</span><textarea name="reason" rows={4} placeholder="Explique rapidamente por que deseja alterar o conteúdo" className="pixel-input mt-2 min-h-[120px] resize-none" required /></label>
              <button className="pixel-btn pixel-btn--green w-full !rounded-2xl !py-4 !text-sm lg:col-span-2">Enviar para análise</button>
            </form>
          </section>
          )
        )}

        <section className="pixel-panel mt-5 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Histórico de alterações</p>
          <div className="mt-4 space-y-3">
            {(editRequests as any[]).length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma alteração solicitada ainda.</p>}
            {(editRequests as any[]).map((request: any) => (
              <article key={request.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">{editStatusLabel(request.status)} • {dateTime(request.createdAt)}</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{request.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black uppercase text-slate-500">
                  {request.requestedDisplayName && <span className="rounded-full bg-white px-2 py-1">Nome</span>}
                  {request.requestedRedirectUrl && <span className="rounded-full bg-white px-2 py-1">Link</span>}
                  {request.requestedImageUrl && <span className="rounded-full bg-white px-2 py-1">Imagem</span>}
                </div>
                {request.adminNote && <p className="mt-2 text-xs font-bold text-slate-500">Resposta admin: {request.adminNote}</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
