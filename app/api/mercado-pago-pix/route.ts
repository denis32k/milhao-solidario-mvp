import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD";

type SelectedBlockInput = {
  gridX: number;
  gridY: number;
};

const RESERVATION_MINUTES = 30;
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

function safeText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePublicLink(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (raw.startsWith("@")) {
    const handle = raw.replace("@", "").replace(/[^a-zA-Z0-9._]/g, "");
    return handle ? `https://instagram.com/${handle}` : "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw.slice(0, 300);
  }

  if (/^[a-zA-Z0-9._-]+$/.test(raw)) {
    return `https://instagram.com/${raw}`;
  }

  if (raw.includes(".") && !raw.includes(" ")) {
    return `https://${raw}`.slice(0, 300);
  }

  return "";
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
      gridX <= 199 &&
      gridY >= 0 &&
      gridY <= 144
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
  if (category === "GOLD") return "GOLD";
  if (category === "PREMIUM") return "PREMIUM";
  return "SOLIDARITY";
}

function getCategoryDescription(category: BuyableCategory, fullName: string) {
  return `Tijolinho digital em ${siteConfig.areas[category].name} - ${fullName}`;
}

export async function GET() {
  const cleanAppUrl = getCleanAppUrl();

  return NextResponse.json({
    ok: true,
    message: "API Mercado Pago PIX carregada.",
    hasAccessToken: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
    appUrl: cleanAppUrl || null,
    webhookPath: "/api/mercado-pago-pix/webhook",
    webhookUrl: cleanAppUrl
      ? `${cleanAppUrl}/api/mercado-pago-pix/webhook`
      : null,
    accepts: {
      fullName: "string",
      publicName: "string",
      whatsapp: "digits",
      cpf: "digits",
      selectedBlocks: [{ gridX: 7, gridY: 0 }],
      title: "public title/name",
      description: "short public description",
      redirectUrl: "optional public link or instagram",
      imageUrl: "optional premium/gold image url",
      fillColor: "optional solidarity color",
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

    const body = await request.json();
    const fullName = safeText(body.fullName, 120);
    const publicName = safeText(body.publicName || body.title || body.fullName, 60);
    const whatsapp = onlyDigits(String(body.whatsapp || ""));
    const cpf = onlyDigits(String(body.cpf || ""));
    const selectedBlocksInput = normalizeSelectedBlocks(body.selectedBlocks);

    const title = safeText(body.title || publicName, 80);
    const description = safeText(body.description, 180);
    const redirectUrl = normalizePublicLink(body.redirectUrl || body.instagram || body.publicLink);
    const imageUrl = safeText(body.imageUrl, 500);
    const requestedFillColor = safeText(body.fillColor, 20);
    const fillColor = ALLOWED_COLORS.has(requestedFillColor)
      ? requestedFillColor
      : "#22c55e";

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

    if (!areBlocksContiguous(selectedBlocksInput)) {
      return NextResponse.json({ ok: false, message: "Os tijolinhos selecionados precisam estar encostados." }, { status: 400 });
    }

    const uniqueId = Date.now();
    const externalReference = `mp-pix-${uniqueId}`;
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

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
            in: ["SOLIDARITY", "PREMIUM", "GOLD"],
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

      if ((category === "PREMIUM" || category === "GOLD") && !blocksFormRectangle(selectedBlocksInput)) {
        throw new Error("Para usar imagem, selecione uma área retangular.");
      }

      if ((category === "PREMIUM" || category === "GOLD") && !title.trim()) {
        throw new Error("Informe um título público para essa área.");
      }

      const subtotalCents = foundBlocks.reduce((total, block) => total + block.priceCents, 0);
      const operatorFeeCents = Math.ceil(subtotalCents * (siteConfig.operationalFeePercent / 100));
      const totalPaidCents = subtotalCents + operatorFeeCents;
      const creatorShareCents = Math.floor(subtotalCents / 2);
      const hospitalShareCents = subtotalCents - creatorShareCents;

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
          placementImageUrl: category === "SOLIDARITY" ? null : imageUrl || null,
          placementFillColor: category === "SOLIDARITY" ? fillColor : null,

          mpExternalReference: externalReference,
          mpStatus: "pending",
          mpStatusDetail: "waiting_pix_payment",

          expiresAt: reservedUntil,
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
