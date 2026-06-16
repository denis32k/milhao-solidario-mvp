import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUBTOTAL_CENTS = 1000;
const OPERATOR_FEE_CENTS = 100;
const TOTAL_PAID_CENTS = 1100;
const CREATOR_SHARE_CENTS = 500;
const HOSPITAL_SHARE_CENTS = 500;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function centsToReais(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function getFirstName(fullName: string) {
  return fullName.trim().split(" ")[0] || fullName.trim();
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "API Mercado Pago PIX carregada.",
    hasAccessToken: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
  });
}

export async function POST(request: Request) {
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

    const uniqueId = Date.now();
    const externalReference = `mp-pix-solidarity-${uniqueId}`;
    const reservedUntil = new Date(Date.now() + 30 * 60 * 1000);

    const pendingData = await prisma.$transaction(async (tx) => {
      const availableBlock = await tx.block.findFirst({
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

      if (!availableBlock) {
        throw new Error("Nenhum bloco solidário disponível encontrado.");
      }

      const user = await tx.user.create({
        data: {
          name: fullName,
          publicName: fullName,
          email: `mp-pix-${uniqueId}@example.com`,
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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "";

    const notificationUrl = appUrl
      ? `${appUrl.replace(/\\/$/, "")}/api/mercado-pago/webhook`
      : undefined;

    const mercadoPagoPayload = {
      transaction_amount: centsToReais(TOTAL_PAID_CENTS),
      description: "Milhão Solidário - Bloco Mosaico Solidário",
      payment_method_id: "pix",
      external_reference: externalReference,
      payer: {
        email: pendingData.user.email,
        first_name: getFirstName(fullName),
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