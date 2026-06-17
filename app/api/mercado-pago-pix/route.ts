import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { siteConfig } from "@/lib/site-config";
import { createManagementToken, getManagementPath, getManagementUrl, hashManagementToken } from "@/lib/customer-access";
import { findBlockedDomain, getHostnameFromUrl, normalizePublicUrl } from "@/lib/content-validation";
import { getOperationalSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

type SelectedBlockInput = {
  gridX: number;
  gridY: number;
};

const TERMS_VERSION = "mural29-2026-06-17";
const PRIVACY_VERSION = "mural29-privacy-2026-06-17";
const CONTENT_RULES_VERSION = "mural29-content-2026-06-17";
const ALLOWED_COLORS = new Set(siteConfig.mosaicColors.map((color) => color.value));

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function centsToReais(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getFirstName(fullName: string) {
  return fullName.trim().split(" ")[0] || fullName.trim();
}

function getCleanAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}

function hashCpf(cpf: string) {
  return createHash("sha256").update(cpf).digest("hex");
}

function getRequestIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function safeText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeSelectedBlocks(value: unknown): SelectedBlockInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Map<string, SelectedBlockInput>();

  for (const item of value) {
    const gridX = Number(item?.gridX);
    const gridY = Number(item?.gridY);

    if (
      Number.isInteger(gridX) &&
      Number.isInteger(gridY) &&
      gridX >= 0 &&
      gridX < GRID_COLS &&
      gridY >= 0 &&
      gridY < GRID_ROWS
    ) {
      unique.set(`${gridX}:${gridY}`, { gridX, gridY });
    }
  }

  return Array.from(unique.values());
}

function areBlocksContiguous(blocks: SelectedBlockInput[]) {
  if (blocks.length <= 1) {
    return true;
  }

  const keys = new Set(blocks.map((block) => `${block.gridX}:${block.gridY}`));
  const visited = new Set<string>();
  const queue = [blocks[0]];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) continue;

    const currentKey = `${current.gridX}:${current.gridY}`;

    if (visited.has(currentKey)) continue;

    visited.add(currentKey);

    const neighbors = [
      { gridX: current.gridX + 1, gridY: current.gridY },
      { gridX: current.gridX - 1, gridY: current.gridY },
      { gridX: current.gridX, gridY: current.gridY + 1 },
      { gridX: current.gridX, gridY: current.gridY - 1 },
    ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.gridX}:${neighbor.gridY}`;
      if (keys.has(neighborKey) && !visited.has(neighborKey)) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === blocks.length;
}

function blocksFormRectangle(blocks: SelectedBlockInput[]) {
  if (blocks.length <= 1) {
    return true;
  }

  const minX = Math.min(...blocks.map((block) => block.gridX));
  const maxX = Math.max(...blocks.map((block) => block.gridX));
  const minY = Math.min(...blocks.map((block) => block.gridY));
  const maxY = Math.max(...blocks.map((block) => block.gridY));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  return width * height === blocks.length;
}

function mapCategoryToKind(category: BuyableCategory) {
  return category;
}

function getCategoryDescription(category: BuyableCategory, fullName: string) {
  return `Tijolinho digital em ${siteConfig.areas[category].name} - ${fullName}`;
}

export async function GET() {
  const cleanAppUrl = getCleanAppUrl();
  const settings = await getOperationalSettings();

  return NextResponse.json({
    ok: true,
    message: "API Mercado Pago PIX carregada.",
    hasAccessToken: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
    appUrl: cleanAppUrl || null,
    webhookPath: "/api/mercado-pago-pix/webhook",
    webhookUrl: cleanAppUrl
      ? `${cleanAppUrl}/api/mercado-pago-pix/webhook`
      : null,
    settings: { maintenanceMode: settings.maintenanceMode, blockNewPurchases: settings.blockNewPurchases, preorderMode: settings.preorderMode, uploadsEnabled: settings.uploadsEnabled, publicLinksEnabled: settings.publicLinksEnabled, checkoutNotice: settings.checkoutNotice, reservationMinutes: settings.reservationMinutes, maxImageMb: settings.maxImageMb },
    accepts: {
      fullName: "string",
      publicName: "string",
      whatsapp: "digits",
      cpf: "digits",
      selectedBlocks: [{ gridX: 7, gridY: 0 }],
      title: "public title/name",
      description: "short public description",
      redirectUrl: "optional public link with https:// or http://. Example: https://instagram.com/meuusuario",
      imageUrl: "optional premium/gold image url",
      fillColor: "optional block color",
      acceptedTerms: "boolean required",
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      contentRulesVersion: CONTENT_RULES_VERSION,
      managementUrl: "returned after PIX creation for post-purchase management",
    },
  });
}

export async function POST(request: Request) {
  let pendingTransactionId: string | null = null;
  let reservedBlockIds: string[] = [];

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "MERCADO_PAGO_ACCESS_TOKEN não configurado no EasyPanel." },
        { status: 500 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const settings = await getOperationalSettings();

    if (settings.maintenanceMode || settings.blockNewPurchases) {
      return NextResponse.json(
        { ok: false, message: settings.maintenanceMode ? "O Mural29 está em manutenção no momento." : "Novas compras estão temporariamente bloqueadas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const fullName = safeText(body.fullName, 120);
    const publicName = safeText(body.publicName || body.title || body.fullName, 60);
    const whatsapp = onlyDigits(String(body.whatsapp || ""));
    const cpf = onlyDigits(String(body.cpf || ""));
    const selectedBlocksInput = normalizeSelectedBlocks(body.selectedBlocks);

    const title = safeText(body.title || publicName, 80);
    const description = safeText(body.description, 180);
    const rawRedirectUrl = body.redirectUrl || body.publicLink;
    const redirectUrl = normalizePublicUrl(rawRedirectUrl);
    const imageUrl = safeText(body.imageUrl, 500);
    const requestedFillColor = safeText(body.fillColor, 20);
    const acceptedTerms = body.acceptedTerms === true;
    const fillColor = ALLOWED_COLORS.has(requestedFillColor)
      ? requestedFillColor
      : "#22c55e";

    const rawRedirectText = String(rawRedirectUrl || "").trim();
    if (rawRedirectText && !settings.publicLinksEnabled) {
      return NextResponse.json({ ok: false, message: "Links públicos estão temporariamente desativados." }, { status: 400 });
    }

    if (rawRedirectText && !redirectUrl) {
      return NextResponse.json({ ok: false, message: "Link inválido. Use o link completo com https:// ou http://. Exemplo: https://instagram.com/meuusuario" }, { status: 400 });
    }

    if (redirectUrl) {
      const blockedDomain = await findBlockedDomain(prisma, redirectUrl);
      if (blockedDomain) {
        await (prisma as any).linkModerationLog.create({
          data: {
            url: redirectUrl,
            domain: getHostnameFromUrl(redirectUrl),
            action: "BLOCKED_CHECKOUT",
            reason: blockedDomain.reason || "Domínio bloqueado no admin.",
          },
        }).catch(() => null);

        return NextResponse.json(
          { ok: false, message: "Esse link não pode ser usado no Mural29. Tente outro domínio." },
          { status: 400 }
        );
      }
    }

    if (!fullName || fullName.length < 3) {
      return NextResponse.json({ ok: false, message: "Informe um nome completo válido." }, { status: 400 });
    }

    if (!publicName || publicName.length < 2) {
      return NextResponse.json({ ok: false, message: "Informe um nome público válido." }, { status: 400 });
    }

    if (whatsapp.length < 10) {
      return NextResponse.json({ ok: false, message: "Informe um WhatsApp válido." }, { status: 400 });
    }

    if (cpf.length !== 11) {
      return NextResponse.json({ ok: false, message: "Informe um CPF válido com 11 números." }, { status: 400 });
    }

    if (selectedBlocksInput.length === 0) {
      return NextResponse.json({ ok: false, message: "Selecione pelo menos um tijolinho no mural." }, { status: 400 });
    }

    if (!acceptedTerms) {
      return NextResponse.json({ ok: false, message: "Aceite os termos para gerar o PIX." }, { status: 400 });
    }

    if (!areBlocksContiguous(selectedBlocksInput)) {
      return NextResponse.json({ ok: false, message: "Os tijolinhos selecionados precisam estar encostados." }, { status: 400 });
    }

    const consentIpHash = getRequestIpHash(request);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (settings.perCustomerLimitPerDay > 0) {
      const customerPurchasesToday = await (prisma as any).transaction.count({
        where: { checkoutWhatsapp: whatsapp, createdAt: { gte: todayStart } },
      }).catch(() => 0);

      if (customerPurchasesToday >= settings.perCustomerLimitPerDay) {
        return NextResponse.json({ ok: false, message: "Limite diário de compras por cliente atingido." }, { status: 429 });
      }
    }

    if (settings.perIpLimitPerDay > 0) {
      const ipPurchasesToday = await (prisma as any).consentLog.count({
        where: { ipHash: consentIpHash, createdAt: { gte: todayStart } },
      }).catch(() => 0);

      if (ipPurchasesToday >= settings.perIpLimitPerDay) {
        return NextResponse.json({ ok: false, message: "Limite diário de compras por IP atingido." }, { status: 429 });
      }
    }

    const uniqueId = Date.now();
    const externalReference = `mp-pix-${uniqueId}`;
    const reservedUntil = new Date(Date.now() + settings.reservationMinutes * 60 * 1000);

    const pendingData = await prisma.$transaction(async (tx: any) => {
      const foundBlocks = await tx.block.findMany({
        where: {
          OR: selectedBlocksInput.map((block) => ({
            gridX: block.gridX,
            gridY: block.gridY,
          })),
          status: "AVAILABLE",
          available: true,
          category: {
            in: ["SOLIDARITY", "PREMIUM", "GOLD", "GRAND_CENTER"],
          },
        },
        orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
      });

      if (foundBlocks.length !== selectedBlocksInput.length) {
        throw new Error("Um ou mais tijolinhos selecionados não estão disponíveis.");
      }

      const categories = Array.from(new Set(foundBlocks.map((block) => block.category)));

      if (categories.length !== 1) {
        throw new Error("Não misture áreas diferentes na mesma compra.");
      }

      const category = categories[0] as BuyableCategory;

      if ((category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER") && !blocksFormRectangle(selectedBlocksInput)) {
        throw new Error("Para usar imagem, selecione uma área retangular.");
      }

      if ((category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER") && !title.trim()) {
        throw new Error("Informe um título público para essa área.");
      }

      const subtotalCents = foundBlocks.reduce((total, block) => total + block.priceCents, 0);
      const operatorFeeCents = Math.ceil(subtotalCents * (siteConfig.operationalFeePercent / 100));
      const totalPaidCents = subtotalCents + operatorFeeCents;
      const creatorShareCents = Math.floor(subtotalCents / 2);
      const hospitalShareCents = subtotalCents - creatorShareCents;

      const managementToken = createManagementToken();
      const managementTokenHash = hashManagementToken(managementToken);

      const user = await tx.user.create({
        data: {
          name: fullName,
          publicName,
          email: `mp-pix-${uniqueId}@example.com`,
          whatsapp,
          cpfHash: hashCpf(cpf),
          cpfLast4: cpf.slice(-4),
          totalApprovedCents: 0,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          kind: mapCategoryToKind(category),
          status: "PENDING",
          userId: user.id,

          subtotalCents,
          operatorFeeCents,
          totalPaidCents,

          creatorShareCents,
          hospitalShareCents,

          checkoutWhatsapp: whatsapp,
          checkoutCpfHash: hashCpf(cpf),
          checkoutCpfLast4: cpf.slice(-4),

          placementTitle: title || publicName,
          placementDescription: description || null,
          placementRedirectUrl: redirectUrl || null,
          placementImageUrl: imageUrl || null,
          placementFillColor: fillColor || null,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          managementTokenHash,
          managementTokenCreatedAt: new Date(),

          mpExternalReference: externalReference,
          mpStatus: "pending",
          mpStatusDetail: "waiting_pix_payment",

          expiresAt: reservedUntil,
        },
      });

      await tx.consentLog.create({
        data: {
          userId: user.id,
          transactionId: transaction.id,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          contentRulesVersion: CONTENT_RULES_VERSION,
          acceptedAt: new Date(),
          ipHash: consentIpHash,
          channel: "checkout_pix",
          purpose: "Compra de espaço personalizado no Mural29 e publicação de conteúdo público conforme regras aceitas.",
        },
      });

      await tx.block.updateMany({
        where: {
          id: {
            in: foundBlocks.map((block) => block.id),
          },
        },
        data: {
          status: "RESERVED",
          available: false,
          ownerId: user.id,
          currentTransactionId: transaction.id,
          reservationToken: externalReference,
          reservedUntil,
        },
      });

      await tx.transactionBlock.createMany({
        data: foundBlocks.map((block) => ({
          transactionId: transaction.id,
          blockId: block.id,
          gridX: block.gridX,
          gridY: block.gridY,
          category: block.category,
          priceCents: block.priceCents,
        })),
      });

      return {
        user,
        transaction,
        blocks: foundBlocks,
        category,
        managementToken,
      };
    });

    pendingTransactionId = pendingData.transaction.id;
    reservedBlockIds = pendingData.blocks.map((block) => block.id);

    const cleanAppUrl = getCleanAppUrl();
    const notificationUrl = cleanAppUrl
      ? `${cleanAppUrl}/api/mercado-pago-pix/webhook`
      : undefined;

    const mercadoPagoPayload = {
      transaction_amount: centsToReais(pendingData.transaction.totalPaidCents),
      description: getCategoryDescription(pendingData.category, fullName),
      payment_method_id: "pix",
      external_reference: externalReference,
      payer: {
        email: pendingData.user.email,
        first_name: getFirstName(fullName),
        identification: {
          type: "CPF",
          number: cpf,
        },
      },
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    };

    const mercadoPagoResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(mercadoPagoPayload),
    });

    const responseText = await mercadoPagoResponse.text();
    let paymentData: any = null;

    try {
      paymentData = JSON.parse(responseText);
    } catch {
      throw new Error(responseText);
    }

    if (!mercadoPagoResponse.ok) {
      throw new Error(
        paymentData?.message || paymentData?.error || "Mercado Pago recusou a criação do PIX."
      );
    }

    const transactionData = paymentData?.point_of_interaction?.transaction_data;
    const qrCode = transactionData?.qr_code || null;
    const qrCodeBase64 = transactionData?.qr_code_base64 || null;
    const ticketUrl = transactionData?.ticket_url || null;

    if (!qrCode && !qrCodeBase64 && !ticketUrl) {
      throw new Error("Mercado Pago não retornou os dados do QR Code PIX.");
    }

    await prisma.transaction.update({
      where: { id: pendingData.transaction.id },
      data: {
        mpPaymentId: String(paymentData.id),
        mpStatus: paymentData.status || "pending",
        mpStatusDetail: paymentData.status_detail || "pending_waiting_payment",
        pixQrCode: ticketUrl,
        pixQrCodeBase64: qrCodeBase64,
        pixCopyPaste: qrCode,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "PIX criado com sucesso.",
      category: pendingData.category,
      webhookUrl: notificationUrl,
      managementPath: getManagementPath(pendingData.managementToken),
      managementUrl: getManagementUrl(pendingData.managementToken, cleanAppUrl),
      payment: {
        id: paymentData.id,
        status: paymentData.status,
        statusDetail: paymentData.status_detail,
      },
      pix: { qrCode, qrCodeBase64, ticketUrl },
      transaction: {
        id: pendingData.transaction.id,
        subtotalCents: pendingData.transaction.subtotalCents,
        operatorFeeCents: pendingData.transaction.operatorFeeCents,
        totalPaidCents: pendingData.transaction.totalPaidCents,
      },
      blocks: pendingData.blocks.map((block) => ({
        id: block.id,
        gridX: block.gridX,
        gridY: block.gridY,
        category: block.category,
        priceCents: block.priceCents,
      })),
      block: {
        id: pendingData.blocks[0].id,
        gridX: pendingData.blocks[0].gridX,
        gridY: pendingData.blocks[0].gridY,
      },
    });
  } catch (error) {
    try {
      if (pendingTransactionId || reservedBlockIds.length > 0) {
        const { prisma } = await import("@/lib/prisma");

        await prisma.$transaction(async (tx: any) => {
          if (pendingTransactionId) {
            await tx.transaction.updateMany({
              where: { id: pendingTransactionId, status: "PENDING" },
              data: { status: "CANCELLED", mpStatusDetail: "pix_creation_failed" },
            });
          }

          if (reservedBlockIds.length > 0) {
            await tx.block.updateMany({
              where: { id: { in: reservedBlockIds }, status: "RESERVED" },
              data: {
                status: "AVAILABLE",
                available: true,
                ownerId: null,
                currentTransactionId: null,
                reservationToken: null,
                reservedUntil: null,
              },
            });
          }
        });
      }
    } catch (cleanupError) {
      console.error("Erro ao limpar reserva após falha no PIX:", cleanupError);
    }

    return NextResponse.json(
      { ok: false, message: "Erro ao criar PIX Mercado Pago.", error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
