import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AreaCode =
  | "TOP_LEFT"
  | "TOP_CENTER"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_CENTER"
  | "BOTTOM_RIGHT"
  | "SURPRISE";

const SUBTOTAL_CENTS = 1000;
const OPERATOR_FEE_CENTS = 100;
const TOTAL_PAID_CENTS = 1100;
const CREATOR_SHARE_CENTS = 500;
const HOSPITAL_SHARE_CENTS = 500;
const RESERVATION_MINUTES = 30;

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

function getAreaBounds(area: AreaCode) {
  const third = Math.floor(200 / 3);

  if (area === "TOP_LEFT") {
    return { minX: 0, maxX: third - 1, minY: 0, maxY: 24 };
  }

  if (area === "TOP_CENTER") {
    return { minX: third, maxX: third * 2 - 1, minY: 0, maxY: 24 };
  }

  if (area === "TOP_RIGHT") {
    return { minX: third * 2, maxX: 199, minY: 0, maxY: 24 };
  }

  if (area === "BOTTOM_LEFT") {
    return { minX: 0, maxX: third - 1, minY: 120, maxY: 144 };
  }

  if (area === "BOTTOM_CENTER") {
    return { minX: third, maxX: third * 2 - 1, minY: 120, maxY: 144 };
  }

  if (area === "BOTTOM_RIGHT") {
    return { minX: third * 2, maxX: 199, minY: 120, maxY: 144 };
  }

  return null;
}

function normalizeArea(area: unknown): AreaCode {
  const value = String(area || "SURPRISE").trim().toUpperCase();

  const allowed: AreaCode[] = [
    "TOP_LEFT",
    "TOP_CENTER",
    "TOP_RIGHT",
    "BOTTOM_LEFT",
    "BOTTOM_CENTER",
    "BOTTOM_RIGHT",
    "SURPRISE",
  ];

  if (allowed.includes(value as AreaCode)) {
    return value as AreaCode;
  }

  return "SURPRISE";
}

async function findAvailableBlock(tx: any, area: AreaCode, gridX: number | null, gridY: number | null) {
  if (typeof gridX === "number" && typeof gridY === "number") {
    const touchedBlock = await tx.block.findFirst({
      where: {
        gridX,
        gridY,
        category: "SOLIDARITY",
        status: "AVAILABLE",
        available: true,
      },
    });

    if (touchedBlock) {
      return touchedBlock;
    }
  }

  const bounds = getAreaBounds(area);

  if (!bounds) {
    return tx.block.findFirst({
      where: {
        category: "SOLIDARITY",
        status: "AVAILABLE",
        available: true,
      },
      orderBy: [
        {
          gridY: "asc",
        },
        {
          gridX: "asc",
        },
      ],
    });
  }

  return tx.block.findFirst({
    where: {
      category: "SOLIDARITY",
      status: "AVAILABLE",
      available: true,
      gridX: {
        gte: bounds.minX,
        lte: bounds.maxX,
      },
      gridY: {
        gte: bounds.minY,
        lte: bounds.maxY,
      },
    },
    orderBy: [
      {
        gridY: "asc",
      },
      {
        gridX: "asc",
      },
    ],
  });
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
      whatsapp: "digits",
      cpf: "digits",
      area: "TOP_LEFT | TOP_CENTER | TOP_RIGHT | BOTTOM_LEFT | BOTTOM_CENTER | BOTTOM_RIGHT | SURPRISE",
      gridX: "optional number",
      gridY: "optional number",
    },
  });
}

export async function POST(request: Request) {
  let pendingTransactionId: string | null = null;
  let reservedBlockId: string | null = null;

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          message: "MERCADO_PAGO_ACCESS_TOKEN não configurado no EasyPanel.",
        },
        {
          status: 500,
        }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const body = await request.json();

    const fullName = String(body.fullName || "").trim();
    const whatsapp = onlyDigits(String(body.whatsapp || ""));
    const cpf = onlyDigits(String(body.cpf || ""));
    const area = normalizeArea(body.area);

    const gridX = Number.isFinite(Number(body.gridX))
      ? Number(body.gridX)
      : null;

    const gridY = Number.isFinite(Number(body.gridY))
      ? Number(body.gridY)
      : null;

    if (!fullName || fullName.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe um nome completo válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (whatsapp.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe um WhatsApp válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (cpf.length !== 11) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe um CPF válido com 11 números.",
        },
        {
          status: 400,
        }
      );
    }

    const uniqueId = Date.now();
    const externalReference = `mp-pix-solidarity-${uniqueId}`;
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    const pendingData = await prisma.$transaction(async (tx) => {
      const availableBlock = await findAvailableBlock(tx, area, gridX, gridY);

      if (!availableBlock) {
        throw new Error("Nenhum bloco solidário disponível encontrado nessa região.");
      }

      const user = await tx.user.create({
        data: {
          name: fullName,
          publicName: fullName,
          email: `mp-pix-${uniqueId}@example.com`,
          whatsapp,
          cpfHash: hashCpf(cpf),
          cpfLast4: cpf.slice(-4),
          totalApprovedCents: 0,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          kind: "SOLIDARITY",
          status: "PENDING",
          userId: user.id,

          subtotalCents: SUBTOTAL_CENTS,
          operatorFeeCents: OPERATOR_FEE_CENTS,
          totalPaidCents: TOTAL_PAID_CENTS,

          creatorShareCents: CREATOR_SHARE_CENTS,
          hospitalShareCents: HOSPITAL_SHARE_CENTS,

          mpExternalReference: externalReference,
          mpStatus: "pending",
          mpStatusDetail: "waiting_pix_payment",

          expiresAt: reservedUntil,
        },
      });

      await tx.block.update({
        where: {
          id: availableBlock.id,
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

      await tx.transactionBlock.create({
        data: {
          transactionId: transaction.id,
          blockId: availableBlock.id,
          gridX: availableBlock.gridX,
          gridY: availableBlock.gridY,
          category: availableBlock.category,
          priceCents: availableBlock.priceCents,
        },
      });

      return {
        user,
        transaction,
        block: availableBlock,
      };
    });

    pendingTransactionId = pendingData.transaction.id;
    reservedBlockId = pendingData.block.id;

    const cleanAppUrl = getCleanAppUrl();
    const notificationUrl = cleanAppUrl
      ? `${cleanAppUrl}/api/mercado-pago-pix/webhook`
      : undefined;

    const mercadoPagoPayload = {
      transaction_amount: centsToReais(TOTAL_PAID_CENTS),
      description: `Milhão Solidário - ${fullName}`,
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
      ...(notificationUrl
        ? {
            notification_url: notificationUrl,
          }
        : {}),
    };

    const mercadoPagoResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(mercadoPagoPayload),
      }
    );

    const responseText = await mercadoPagoResponse.text();

    let paymentData: any = null;

    try {
      paymentData = JSON.parse(responseText);
    } catch {
      throw new Error(responseText);
    }

    if (!mercadoPagoResponse.ok) {
      throw new Error(
        paymentData?.message ||
          paymentData?.error ||
          "Mercado Pago recusou a criação do PIX."
      );
    }

    const transactionData =
      paymentData?.point_of_interaction?.transaction_data;

    const qrCode = transactionData?.qr_code || null;
    const qrCodeBase64 = transactionData?.qr_code_base64 || null;
    const ticketUrl = transactionData?.ticket_url || null;

    if (!qrCode && !qrCodeBase64 && !ticketUrl) {
      throw new Error("Mercado Pago não retornou os dados do QR Code PIX.");
    }

    await prisma.transaction.update({
      where: {
        id: pendingData.transaction.id,
      },
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
      area,
      webhookUrl: notificationUrl,
      payment: {
        id: paymentData.id,
        status: paymentData.status,
        statusDetail: paymentData.status_detail,
      },
      pix: {
        qrCode,
        qrCodeBase64,
        ticketUrl,
      },
      transaction: {
        id: pendingData.transaction.id,
        totalPaidCents: pendingData.transaction.totalPaidCents,
      },
      block: {
        id: pendingData.block.id,
        gridX: pendingData.block.gridX,
        gridY: pendingData.block.gridY,
      },
    });
  } catch (error) {
    try {
      if (pendingTransactionId || reservedBlockId) {
        const { prisma } = await import("@/lib/prisma");

        await prisma.$transaction(async (tx) => {
          if (pendingTransactionId) {
            await tx.transaction.updateMany({
              where: {
                id: pendingTransactionId,
                status: "PENDING",
              },
              data: {
                status: "CANCELLED",
                mpStatusDetail: "pix_creation_failed",
              },
            });
          }

          if (reservedBlockId) {
            await tx.block.updateMany({
              where: {
                id: reservedBlockId,
                status: "RESERVED",
              },
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
      {
        ok: false,
        message: "Erro ao criar PIX Mercado Pago.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
