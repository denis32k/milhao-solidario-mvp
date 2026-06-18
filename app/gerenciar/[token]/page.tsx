import Link from "next/link";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getManagementUrl, hashManagementToken } from "@/lib/customer-access";
import CopyTextButton from "@/components/CopyTextButton";
import { dateTime, money, safeValueQuery } from "@/lib/admin";
import { findBlockedDomain, getHostnameFromUrl, normalizePublicUrl, validateImageFile } from "@/lib/content-validation";
import { getOperationalSettings } from "@/lib/system-settings";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type ManagePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const filename = url.split("/").pop();
    return filename ? `/api/uploads/file/${encodeURIComponent(filename)}` : url;
  }
  return url;
}

function safeText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function statusLabel(status: string | null | undefined) {
  if (status === "APPROVED") return "Pagamento confirmado";
  if (status === "PENDING") return "Aguardando pagamento";
  if (status === "REJECTED") return "Pagamento não aprovado";
  if (status === "CANCELLED" || status === "CANCELED") return "Compra cancelada";
  if (status === "EXPIRED") return "Reserva expirada";
  if (status === "REFUNDED") return "Reembolso processado";
  return "Em acompanhamento";
}

function editStatusLabel(status: string | null | undefined) {
  if (status === "PENDING") return "Em análise";
  if (status === "APPROVED") return "Aprovada";
  if (status === "REJECTED") return "Rejeitada";
  return "Em análise";
}

function summarizeCoordinates(items: any[]) {
  if (!items.length) return "Coordenadas indisponíveis";
  const xs = items.map((item: any) => Number(item.gridX)).filter(Number.isFinite);
  const ys = items.map((item: any) => Number(item.gridY)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return "Coordenadas indisponíveis";

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (minX === maxX && minY === maxY) return `X:${minX} · Y:${minY}`;
  return `X:${minX}-${maxX} · Y:${minY}-${maxY}`;
}

function timelineTone(done: boolean, current = false) {
  if (done) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (current) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-500";
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
  const uploadDir = getUploadDir();
  const filepath = path.join(uploadDir, filename);
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  return `/api/uploads/file/${filename}`;
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
  const areaName = getAreaName((transaction as any).kind);
  const coordinateSummary = summarizeCoordinates(items);
  const displayName = placement?.displayName || placement?.title || "Espaço comprado";
  const isWaitingPersonalization = displayName === "Espaço comprado";
  const status = String((transaction as any).status || "");
  const isPendingPayment = status === "PENDING";
  const isPaymentConfirmed = status === "APPROVED";
  const isPublished = Boolean(placement && !isWaitingPersonalization && isPaymentConfirmed);
  const firstBlockId = placement?.blocks?.[0]?.id || items?.[0]?.blockId || null;
  const publicBlockHref = firstBlockId ? `/bloco/${firstBlockId}` : "/";
  const purchaseTitle = `Seu espaço — ${areaName} — ${coordinateSummary}`;
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const managementUrl = getManagementUrl(token, appUrl || null);
  const timelineSteps = [
    { title: "Compra criada", description: dateTime((transaction as any).createdAt), done: true },
    { title: "PIX gerado", description: "Pagamento criado com segurança", done: Boolean((transaction as any).mpPaymentId || (transaction as any).pixCopyPaste) },
    { title: "Pagamento confirmado", description: isPaymentConfirmed ? dateTime((transaction as any).approvedAt) : "Aguardando confirmação", done: isPaymentConfirmed, current: isPendingPayment },
    { title: "Personalização recebida", description: isWaitingPersonalization ? "Envie nome, link e imagem abaixo" : "Conteúdo recebido", done: !isWaitingPersonalization && isPaymentConfirmed, current: isPaymentConfirmed && isWaitingPersonalization },
    { title: "Publicado no mural", description: isPublished ? "Seu espaço já está disponível" : "Será publicado após a personalização", done: isPublished },
  ];


  return (
    <main className="saas-page px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="saas-button-secondary">← Voltar ao mural</Link>
          <Link href="/recuperar-link" className="saas-button-secondary">Área do Cliente</Link>
        </div>

        <section className="saas-card overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#f97316)] px-5 py-6 text-white sm:px-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-200">Portal do Cliente</p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Gerencie sua compra no Mural29</h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-200">Acompanhe o pagamento, personalize seu espaço, solicite alterações e volte ao seu bloco sempre que precisar.</p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black backdrop-blur">{statusLabel(status)}</span>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
            <section className="saas-card-soft p-5">
              <p className="saas-kicker">Resumo da compra</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{purchaseTitle}</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                {isPublished
                  ? "Seu espaço está publicado no mural. Você pode abrir a página pública, copiar seu acesso ou solicitar uma alteração."
                  : isPaymentConfirmed
                    ? "Pagamento confirmado. Complete a personalização para publicar seu espaço no mural."
                    : "Aguardando confirmação do pagamento para liberar a personalização."}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Bairro</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{areaName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Coordenadas</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{coordinateSummary}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Blocos</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{items.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Valor</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{money((transaction as any).totalPaidCents)}</p>
                </div>
              </div>
            </section>

            <aside className="saas-card-soft p-5">
              <p className="saas-kicker">Ações rápidas</p>
              <div className="mt-4 grid gap-2">
                <Link href={publicBlockHref} className="saas-button-primary">Ver meu espaço no mural</Link>
                <CopyTextButton text={managementUrl} label="Copiar meu acesso" copiedLabel="Acesso copiado" />
                <Link href={managementUrl} className="saas-button-secondary">Abrir este acesso</Link>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-500">Guarde este acesso. Ele permite voltar para acompanhar a compra, personalizar ou solicitar alterações.</div>
            </aside>
          </div>
        </section>

        {sent && <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Solicitação enviada. O conteúdo atual continua no mural enquanto a nova versão é analisada.</div>}
        {updated && <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">Pagamento atualizado. Quando confirmado, a personalização fica liberada automaticamente.</div>}
        {errorText && <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText}</div>}

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
          <section className="saas-card-soft p-5">
            <p className="saas-kicker">Conteúdo atual</p>
            <div className="mt-4 grid gap-5 md:grid-cols-[190px_1fr]">
              <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 md:w-48">
                {placement?.imageUrl ? <img src={normalizeImageUrl(placement.imageUrl)} alt={displayName} className="h-full w-full object-cover" /> : <span className="px-5 text-center text-xs font-bold text-slate-400">{isWaitingPersonalization ? "Aguardando imagem" : "Sem imagem"}</span>}
              </div>
              <div>
                <span className="saas-status">{areaName}</span>
                <h2 className="mt-3 text-2xl font-black text-slate-950">{displayName}</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">{isWaitingPersonalization ? "Sua compra está confirmada. Envie a primeira personalização para aparecer no mural." : "Este é o conteúdo publicado atualmente no mural."}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {placement?.redirectUrl && !placement?.linkDisabled ? <a href={placement.redirectUrl} target="_blank" rel="noopener noreferrer" className="saas-button-primary">Abrir link público</a> : <div className="saas-button-secondary text-slate-500">Sem link público</div>}
                  {firstBlockId && <Link href={publicBlockHref} className="saas-button-secondary">Ver página pública</Link>}
                </div>
              </div>
            </div>
          </section>

          <aside className="saas-card-soft p-5">
            <p className="saas-kicker">Linha do tempo</p>
            <div className="mt-4 space-y-3">
              {timelineSteps.map((step, index) => (
                <div key={step.title} className={`rounded-2xl border p-3 ${timelineTone(step.done, step.current)}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">{step.done ? "✓" : index + 1}</span>
                    <div>
                      <p className="text-sm font-black">{step.title}</p>
                      <p className="mt-0.5 text-xs font-semibold opacity-80">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {isPendingPayment && (
          <section className="saas-card-soft mt-5 p-5">
            <p className="saas-kicker">Pagamento</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Já pagou o PIX?</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Atualize a compra para confirmar o pagamento. Assim que o Mercado Pago confirmar, a personalização será liberada.</p>
            <form action={refreshPaymentStatus} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button className="saas-button-success w-full">Atualizar pagamento</button>
            </form>
          </section>
        )}

        {isWaitingPersonalization && isPaymentConfirmed ? (
          <section className="saas-card-soft mt-5 p-5">
            <p className="saas-kicker">Primeira personalização</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Publicar meu espaço no mural</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Envie o nome público, link e imagem. Depois de salvar, você poderá abrir seu espaço no mural.</p>

            <form action={publishInitialPersonalization} className="mt-5 grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="token" value={token} />
              <label className="block"><span className="text-xs font-bold text-slate-600">Nome público</span><input name="displayName" placeholder="Nome que aparece no mural" className="saas-input mt-2" required /></label>
              <label className="block"><span className="text-xs font-bold text-slate-600">Link público</span><input name="redirectUrl" placeholder="https://instagram.com/meuusuario" className="saas-input mt-2" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-bold text-slate-600">Imagem do mural</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="saas-input mt-2 py-3" /></label>
              <button className="saas-button-success w-full lg:col-span-2">Salvar e abrir no mural</button>
            </form>
          </section>
        ) : (
          !isPendingPayment && (
          <section className="saas-card-soft mt-5 p-5">
            <p className="saas-kicker">Solicitar alteração</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Alterar nome, link ou imagem</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Seu conteúdo atual continua publicado enquanto a nova versão é analisada pela administração.</p>

            <form action={requestEdit} className="mt-5 grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="token" value={token} />
              <label className="block"><span className="text-xs font-bold text-slate-600">Novo nome público</span><input name="displayName" placeholder="Nome que aparece no mural" className="saas-input mt-2" /></label>
              <label className="block"><span className="text-xs font-bold text-slate-600">Novo link público</span><input name="redirectUrl" placeholder="https://instagram.com/meuusuario" className="saas-input mt-2" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-bold text-slate-600">Nova imagem</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="saas-input mt-2 py-3" /></label>
              <label className="block lg:col-span-2"><span className="text-xs font-bold text-slate-600">Motivo da alteração</span><textarea name="reason" rows={4} placeholder="Explique rapidamente por que deseja alterar o conteúdo" className="saas-input mt-2 min-h-[120px] resize-none py-3" required /></label>
              <button className="saas-button-success w-full lg:col-span-2">Enviar para análise</button>
            </form>
          </section>
          )
        )}

        <section className="saas-card-soft mt-5 p-5">
          <p className="saas-kicker">Histórico de alterações</p>
          <div className="mt-4 space-y-3">
            {(editRequests as any[]).length === 0 && <p className="text-sm font-semibold text-slate-500">Nenhuma alteração solicitada ainda.</p>}
            {(editRequests as any[]).map((request: any) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">{editStatusLabel(request.status)} • {dateTime(request.createdAt)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{request.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                  {request.requestedDisplayName && <span className="rounded-full bg-white px-2 py-1">Nome</span>}
                  {request.requestedRedirectUrl && <span className="rounded-full bg-white px-2 py-1">Link</span>}
                  {request.requestedImageUrl && <span className="rounded-full bg-white px-2 py-1">Imagem</span>}
                </div>
                {request.adminNote && <p className="mt-2 text-xs font-semibold text-slate-500">Resposta do suporte: {request.adminNote}</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );

}
