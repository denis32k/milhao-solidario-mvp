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

function getWebhookEventId(body: MercadoPagoNotificationBody | null) {
  const raw = body?.id || body?.data?.id;
  return raw ? String(raw) : null;
}

function getQueryPayload(request: Request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

async function createPaymentWebhookEvent({
  request,
  body,
  eventType,
  paymentId,
}: {
  request: Request;
  body: MercadoPagoNotificationBody | null;
  eventType: string;
  paymentId: string | null;
}) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const event = await (prisma as any).paymentWebhookEvent.create({
      data: {
        eventId: getWebhookEventId(body),
        eventType: eventType || "unknown",
        paymentId,
        payload: body || getQueryPayload(request),
        processed: false,
        ignored: false,
      },
      select: { id: true },
    });

    return event.id as string;
  } catch {
    return null;
  }
}

async function updatePaymentWebhookEvent(
  eventLogId: string | null,
  data: {
    previousStatus?: string | null;
    newStatus?: string | null;
    processed?: boolean;
    ignored?: boolean;
    error?: string | null;
    transactionId?: string | null;
  }
) {
  if (!eventLogId) return;

  try {
    const { prisma } = await import("@/lib/prisma");
    await (prisma as any).paymentWebhookEvent.update({
      where: { id: eventLogId },
      data,
    });
  } catch {
    // O webhook não pode falhar só porque o log falhou.
  }
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
      previousTransactionStatus: null,
      transactionStatus: null,
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
      previousTransactionStatus: transaction.status,
      transactionStatus: transaction.status,
      mercadoPagoStatus: paymentData.status,
      mercadoPagoStatusDetail: paymentData.status_detail,
    };
  }

  if (paymentData.status !== "approved") {
    const nextStatus = mapStatus(String(paymentData.status || ""));
    const shouldRelease = shouldReleaseBlock(String(paymentData.status || ""));

    const updatedTransaction = await prisma.$transaction(async (tx: any) => {
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
        ? "Pagamento não aprovado. Tijolinho liberado."
        : "Pagamento ainda não aprovado.",
      paymentId,
      transactionId: updatedTransaction.id,
      previousTransactionStatus: transaction.status,
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

  const result = await prisma.$transaction(async (tx: any) => {
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

    const minX = Math.min(...transaction.items.map((item) => item.gridX));
    const maxX = Math.max(...transaction.items.map((item) => item.gridX));
    const minY = Math.min(...transaction.items.map((item) => item.gridY));
    const maxY = Math.max(...transaction.items.map((item) => item.gridY));
    const widthBlocks = maxX - minX + 1;
    const heightBlocks = maxY - minY + 1;
    const placementKind = transaction.kind as any;
    const defaultFillColor =
      transaction.kind === "GRAND_CENTER"
        ? "#c026d3"
        : transaction.kind === "GOLD"
          ? "#f59e0b"
          : transaction.kind === "PREMIUM"
            ? "#0f172a"
            : "#22c55e";

    const placement = await tx.placement.upsert({
      where: {
        transactionId: transaction.id,
      },
      update: {
        status: "ACTIVE",
        kind: placementKind,
        title: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        description: transaction.placementDescription || undefined,
        imageUrl: transaction.placementImageUrl || undefined,
        redirectUrl: transaction.placementRedirectUrl || undefined,
        displayName: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        textLabel: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        fillColor: transaction.placementFillColor || defaultFillColor,
        originX: minX,
        originY: minY,
        widthBlocks,
        heightBlocks,
      },
      create: {
        kind: placementKind,
        status: "ACTIVE",
        reviewStatus: "PUBLISHED_NOT_REVIEWED",

        userId: transaction.userId,
        transactionId: transaction.id,

        title: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        description: transaction.placementDescription || undefined,
        imageUrl: transaction.placementImageUrl || undefined,
        redirectUrl: transaction.placementRedirectUrl || undefined,
        displayName: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        textLabel: transaction.placementTitle || transaction.user.publicName || transaction.user.name,
        fillColor: transaction.placementFillColor || defaultFillColor,
        originX: minX,
        originY: minY,
        widthBlocks,
        heightBlocks,
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
    message: "Pagamento aprovado e tijolinho vendido.",
    paymentId,
    transactionId: result.transaction.id,
    placementId: result.placement.id,
    blockIds,
    previousTransactionStatus: transaction.status,
    transactionStatus: result.transaction.status,
    mercadoPagoStatus: paymentData.status,
    mercadoPagoStatusDetail: paymentData.status_detail,
  };
}

export async function GET(request: Request) {
  let eventLogId: string | null = null;

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

    eventLogId = await createPaymentWebhookEvent({
      request,
      body: null,
      eventType: "manual-sync",
      paymentId,
    });

    const result = await processPayment(paymentId);

    await updatePaymentWebhookEvent(eventLogId, {
      processed: Boolean(result.ok),
      ignored: false,
      previousStatus: (result as any).previousTransactionStatus || null,
      newStatus: (result as any).transactionStatus || (result as any).mercadoPagoStatus || null,
      transactionId: (result as any).transactionId || null,
      error: result.ok ? null : result.message || "Sincronização manual não processada.",
    });

    return NextResponse.json({
      ok: true,
      mode: "manual-sync",
      result,
    });
  } catch (error) {
    await updatePaymentWebhookEvent(eventLogId, {
      processed: false,
      ignored: false,
      error: getErrorMessage(error),
    });

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
  let body: MercadoPagoNotificationBody | null = null;
  let notificationType = "";
  let paymentId: string | null = null;
  let eventLogId: string | null = null;

  try {
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    notificationType = getNotificationType(request, body);
    paymentId = getPaymentIdFromRequest(request, body);

    eventLogId = await createPaymentWebhookEvent({
      request,
      body,
      eventType: notificationType || "unknown",
      paymentId,
    });

    if (!paymentId) {
      await updatePaymentWebhookEvent(eventLogId, {
        processed: false,
        ignored: true,
        error: "Notificação recebida sem paymentId.",
      });

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
      await updatePaymentWebhookEvent(eventLogId, {
        processed: false,
        ignored: true,
        error: `Notificação ignorada por tipo: ${notificationType}.`,
      });

      return NextResponse.json({
        ok: true,
        message: "Notificação recebida, mas não é de pagamento. Ignorada.",
        notificationType,
        paymentId,
      });
    }

    const result = await processPayment(paymentId);

    await updatePaymentWebhookEvent(eventLogId, {
      processed: Boolean(result.ok),
      ignored: false,
      previousStatus: (result as any).previousTransactionStatus || null,
      newStatus: (result as any).transactionStatus || (result as any).mercadoPagoStatus || null,
      transactionId: (result as any).transactionId || null,
      error: result.ok ? null : result.message || "Webhook recebido, mas não processado.",
    });

    return NextResponse.json({
      ok: true,
      mode: "webhook",
      result,
    });
  } catch (error) {
    await updatePaymentWebhookEvent(eventLogId, {
      processed: false,
      ignored: false,
      error: getErrorMessage(error),
    });

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
