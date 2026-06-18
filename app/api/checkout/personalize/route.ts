import { NextResponse } from "next/server";
import { hashManagementToken } from "@/lib/customer-access";
import { findBlockedDomain, getHostnameFromUrl, normalizePublicUrl } from "@/lib/content-validation";
import { getOperationalSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

function safeText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getDefaultFillColor(kind: string) {
  if (kind === "GRAND_CENTER") return "#c026d3";
  if (kind === "GOLD") return "#f59e0b";
  if (kind === "PREMIUM") return "#0f172a";
  return "#22c55e";
}

export async function POST(request: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await getOperationalSettings();

    if (settings.maintenanceMode) {
      return NextResponse.json({ ok: false, message: "O Mural29 está em manutenção no momento." }, { status: 403 });
    }

    const body = await request.json();
    const managementToken = safeText(body.managementToken, 240);
    const transactionId = safeText(body.transactionId, 120);
    const displayName = safeText(body.displayName, 60);
    const imageUrl = safeText(body.imageUrl, 500);
    const rawRedirectUrl = safeText(body.redirectUrl || body.publicLink, 500);
    const redirectUrl = normalizePublicUrl(rawRedirectUrl);

    if (!managementToken) {
      return NextResponse.json({ ok: false, message: "Token de gerenciamento ausente." }, { status: 400 });
    }

    if (!displayName || displayName.length < 2) {
      return NextResponse.json({ ok: false, message: "Informe o nome público que aparecerá no mural." }, { status: 400 });
    }

    if (rawRedirectUrl && !settings.publicLinksEnabled) {
      return NextResponse.json({ ok: false, message: "Links públicos estão temporariamente desativados." }, { status: 400 });
    }

    if (rawRedirectUrl && !redirectUrl) {
      return NextResponse.json({ ok: false, message: "Use o link completo com https:// ou http://. Ex: https://instagram.com/meuusuario" }, { status: 400 });
    }

    if (redirectUrl) {
      const blockedDomain = await findBlockedDomain(prisma, redirectUrl);
      if (blockedDomain) {
        await (prisma as any).linkModerationLog.create({
          data: {
            url: redirectUrl,
            domain: getHostnameFromUrl(redirectUrl),
            action: "BLOCKED_POST_PAYMENT_PERSONALIZATION",
            reason: blockedDomain.reason || "Domínio bloqueado no admin.",
          },
        }).catch(() => null);

        return NextResponse.json({ ok: false, message: "Esse link não pode ser usado no Mural29. Tente outro domínio." }, { status: 400 });
      }
    }

    if (imageUrl && !settings.uploadsEnabled) {
      return NextResponse.json({ ok: false, message: "Uploads estão temporariamente desativados." }, { status: 400 });
    }

    const where: any = { managementTokenHash: hashManagementToken(managementToken) };
    if (transactionId) where.id = transactionId;

    const transaction = await (prisma as any).transaction.findFirst({
      where,
      include: { user: true, items: true, placement: true },
    });

    if (!transaction) {
      return NextResponse.json({ ok: false, message: "Compra não encontrada ou link expirado." }, { status: 404 });
    }

    if (transaction.status !== "APPROVED") {
      return NextResponse.json({ ok: false, message: "A personalização fica liberada após o pagamento aprovado." }, { status: 409 });
    }

    const minX = Math.min(...transaction.items.map((item: any) => item.gridX));
    const maxX = Math.max(...transaction.items.map((item: any) => item.gridX));
    const minY = Math.min(...transaction.items.map((item: any) => item.gridY));
    const maxY = Math.max(...transaction.items.map((item: any) => item.gridY));
    const widthBlocks = maxX - minX + 1;
    const heightBlocks = maxY - minY + 1;
    const fillColor = transaction.placementFillColor || transaction.placement?.fillColor || getDefaultFillColor(transaction.kind);

    const result = await (prisma as any).$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: transaction.userId },
        data: { publicName: displayName },
      });

      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          placementTitle: displayName,
          placementDescription: null,
          placementRedirectUrl: redirectUrl || null,
          placementImageUrl: imageUrl || null,
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
          imageUrl: imageUrl || null,
          redirectUrl: redirectUrl || null,
          linkDisabled: false,
          placeholderReason: null,
          fillColor,
          originX: minX,
          originY: minY,
          widthBlocks,
          heightBlocks,
        },
        create: {
          kind: transaction.kind,
          status: "ACTIVE",
          reviewStatus: "PUBLISHED_NOT_REVIEWED",
          userId: transaction.userId,
          transactionId: transaction.id,
          title: displayName,
          description: null,
          displayName,
          textLabel: displayName,
          imageUrl: imageUrl || null,
          redirectUrl: redirectUrl || null,
          fillColor,
          originX: minX,
          originY: minY,
          widthBlocks,
          heightBlocks,
        },
      });

      await tx.block.updateMany({
        where: { currentTransactionId: transaction.id },
        data: { placementId: placement.id },
      });

      return { transaction: updatedTransaction, placement };
    });

    return NextResponse.json({
      ok: true,
      message: "Personalização salva. Seu espaço já aparece no Mural29.",
      placement: { id: result.placement.id, displayName: result.placement.displayName, imageUrl: result.placement.imageUrl, redirectUrl: result.placement.redirectUrl },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: "Erro ao salvar personalização.", error: getErrorMessage(error) }, { status: 500 });
  }
}
