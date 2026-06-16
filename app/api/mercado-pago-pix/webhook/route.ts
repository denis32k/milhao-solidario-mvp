import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TransactionStatusValue =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

type MercadoPagoNotificationBody = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getPaymentIdFromRequest(
  request: Request,
  body: MercadoPagoNotificationBody | null
) {
  const url = new URL(request.url);

  const queryDataId = url.searchParams.get("data.id");
  const queryId = url.searchParams.get("id");

  const bodyDataId = body?.data?.id;
  const bodyId = body?.id;

  const paymentId = bodyDataId || bodyId || queryDataId || queryId;

  if (!paymentId) {
    return null;
  }

  return String(paymentId);
}

function getNotificationType(
  request: Request,
  body: MercadoPagoNotificationBody | null
) {
  const url = new URL(request.url);

  return (
    body?.type ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    ""
  );
}

function mapStatus(status: string): TransactionStatusValue {
  if (status === "approved") {
    return "APPROVED";
  }

  if (status === "rejected") {
    return "REJECTED";
  }

  if (status === "cancelled") {
    return "CANCELLED";
  }

  if (status === "refunded") {
    return "REFUNDED";
  }

  if (status === "expired") {
    return "EXPIRED";
  }

  return "PENDING";
}

function shouldReleaseBlock(status: string) {
  return (
    status === "rejected" ||
    status === "cancelled" ||
    status === "refunded" ||
    status === "expired"
  );
}

async function getMercadoPagoPayment(paymentId: string, accessToken: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  let paymentData: any = null;

  try {
    paymentData = JSON.parse(responseText);
  } catch {
    throw new Error(responseText);
  }

  if (!response.ok) {
    throw new Error(
      paymentData?.message ||
        paymentData?.error ||
        "Não foi possível consultar o pagamento no Mercado Pago."
    );
  }

  return paymentData;
}

async function createLedgerIfMissing(transactionId: string) {
  const { prisma } = await import("@/lib/prisma");

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
    },
    include: {
      ledgerEntries: true,
    },
  });

  if (!transaction) {
    return;
  }

  if (transaction.ledgerEntries.length > 0) {
    return;
  }

  await prisma.distributionLedger.createMany({
    data: [
      {
        transactionId: transaction.id,
        recipient: "CREATOR",
        amountCents: transaction.creatorShareCents,
        status: "PENDING",
      },
      {
        transactionId: transaction.id,
        recipient: "HOSPITAL",
        amountCents: transaction.hospitalShareCents,
        status: "PENDING",
      },
    ],
  });
}

async function processPayment(paymentId: string) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      ok: false,
      message: "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
      paymentId,
    };
  }

  const { prisma } = await import("@/lib/prisma");

  const paymentData = await getMercadoPagoPayment(paymentId, accessToken);

  const externalReference = paymentData.external_reference
    ? String(paymentData.external_reference)
    : "";

  const transaction = await prisma.transaction.findFirst({
    where: {
      OR: [
        {
          mpPaymentId: paymentId,
        },
        {
          mpExternalReference: externalReference,
        },
      ],
    },
    include: {
      user: true,
      items: true,
    },
  });

  if (!transaction) {
    return {
      ok: false,
      message:
        "Pagamento encontrado no Mercado Pago, mas transação não encontrada no banco.",
      paymentId,
      externalReference,
      mercadoPagoStatus: paymentData.status,
      mercadoPagoStatusDetail: paymentData.status_detail,
    };
  }

  if (transaction.status === "APPROVED") {
    await createLedgerIfMissing(transaction.id);

    return {
      ok: true,
      message: "Transação já estava aprovada.",
      paymentId,
      transactionId: transaction.id,
      mercadoPagoStatus: paymentData.status,
      mercadoPagoStatusDetail: paymentData.status_detail,
    };
  }

  if (paymentData.status !== "approved") {
    const nextStatus = mapStatus(String(paymentData.status || ""));
    const shouldRelease = shouldReleaseBlock(String(paymentData.status || ""));

    const updatedTransaction = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: nextStatus,

          mpPaymentId: paymentId,
          mpStatus: paymentData.status || "pending",
          mpStatusDetail: paymentData.status_detail || null,
        },
      });

      if (shouldRelease) {
        await tx.block.updateMany({
          where: {
            currentTransactionId: transaction.id,
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

      return updated;
    });

    return {
      ok: true,
      message: shouldRelease
        ? "Pagamento não aprovado. Bloco liberado."
        : "Pagamento ainda não aprovado.",
      paymentId,
      transactionId: updatedTransaction.id,
      transactionStatus: updatedTransaction.status,
      mercadoPagoStatus: paymentData.status,
      mercadoPagoStatusDetail: paymentData.status_detail,
    };
  }

  const approvedAt = paymentData.date_approved
    ? new Date(paymentData.date_approved)
    : new Date();

  const paidAt = paymentData.money_release_date
    ? new Date(paymentData.money_release_date)
    : approvedAt;

  const blockIds = transaction.items.map((item) => item.blockId);

  const result = await prisma.$transaction(async (tx) => {
    const updatedTransaction = await tx.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        status: "APPROVED",

        mpPaymentId: paymentId,
        mpStatus: paymentData.status || "approved",
        mpStatusDetail: paymentData.status_detail || "accredited",

        approvedAt,
        paidAt,
      },
    });

    const placement = await tx.placement.upsert({
      where: {
        transactionId: transaction.id,
      },
      update: {
        status: "ACTIVE",
        title: transaction.placementTitle || undefined,
        description: transaction.placementDescription || undefined,
        imageUrl: transaction.placementImageUrl || undefined,
        redirectUrl: transaction.placementRedirectUrl || undefined,
        displayName: transaction.user.publicName || transaction.user.name,
        textLabel: transaction.user.publicName || transaction.user.name,
        fillColor: transaction.kind === "PREMIUM" ? "#0f172a" : "#22c55e",
      },
      create: {
        kind: "SOLIDARITY",
        status: "ACTIVE",

        userId: transaction.userId,
        transactionId: transaction.id,

        title: transaction.placementTitle || undefined,
        description: transaction.placementDescription || undefined,
        imageUrl: transaction.placementImageUrl || undefined,
        redirectUrl: transaction.placementRedirectUrl || undefined,
        displayName: transaction.user.publicName || transaction.user.name,
        textLabel: transaction.user.publicName || transaction.user.name,
        fillColor: transaction.kind === "PREMIUM" ? "#0f172a" : "#22c55e",
      },
    });

    await tx.block.updateMany({
      where: {
        id: {
          in: blockIds,
        },
        currentTransactionId: transaction.id,
      },
      data: {
        status: "SOLD",
        available: false,
        ownerId: transaction.userId,
        placementId: placement.id,
        reservationToken: null,
        reservedUntil: null,
      },
    });

    await tx.user.update({
      where: {
        id: transaction.userId,
      },
      data: {
        totalApprovedCents: {
          increment: transaction.subtotalCents,
        },
      },
    });

    return {
      transaction: updatedTransaction,
      placement,
    };
  });

  await createLedgerIfMissing(result.transaction.id);

  return {
    ok: true,
    message: "Pagamento aprovado e bloco vendido.",
    paymentId,
    transactionId: result.transaction.id,
    placementId: result.placement.id,
    blockIds,
    mercadoPagoStatus: paymentData.status,
    mercadoPagoStatusDetail: paymentData.status_detail,
  };
}

export async function GET(request: Request) {
  try {
    const paymentId = getPaymentIdFromRequest(request, null);

    if (!paymentId) {
      return NextResponse.json({
        ok: true,
        message: "Webhook Mercado Pago carregado.",
        path: "/api/mercado-pago-pix/webhook",
        manualSyncExample:
          "/api/mercado-pago-pix/webhook?type=payment&data.id=ID_DO_PAGAMENTO",
      });
    }

    const result = await processPayment(paymentId);

    return NextResponse.json({
      ok: true,
      mode: "manual-sync",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao sincronizar pagamento manualmente.",
        error: getErrorMessage(error),
      },
      {
        status: 200,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: MercadoPagoNotificationBody | null = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const notificationType = getNotificationType(request, body);
    const paymentId = getPaymentIdFromRequest(request, body);

    if (!paymentId) {
      return NextResponse.json({
        ok: true,
        message: "Notificação recebida sem paymentId. Ignorada.",
        notificationType,
      });
    }

    if (
      notificationType &&
      notificationType !== "payment" &&
      notificationType !== "payments"
    ) {
      return NextResponse.json({
        ok: true,
        message: "Notificação recebida, mas não é de pagamento. Ignorada.",
        notificationType,
        paymentId,
      });
    }

    const result = await processPayment(paymentId);

    return NextResponse.json({
      ok: true,
      mode: "webhook",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "webhook",
        message: "Webhook recebeu a notificação, mas ocorreu erro ao processar.",
        error: getErrorMessage(error),
      },
      {
        status: 200,
      }
    );
  }
}
