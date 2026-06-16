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

function getPaymentIdFromNotification(
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

function mapMercadoPagoStatusToTransactionStatus(
  status: string
): TransactionStatusValue {
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

function shouldReleaseReservedBlock(status: string) {
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

async function approveTransaction(paymentData: any) {
  const { prisma } = await import("@/lib/prisma");

  const paymentId = String(paymentData.id);

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
      message: "Transação não encontrada no banco.",
      paymentId,
      externalReference,
    };
  }

  if (transaction.status === "APPROVED") {
    return {
      ok: true,
      message: "Transação já estava aprovada.",
      transactionId: transaction.id,
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
        displayName: transaction.user.publicName || transaction.user.name,
        textLabel: transaction.user.publicName || transaction.user.name,
        fillColor: "#22c55e",
      },
      create: {
        kind: "SOLIDARITY",
        status: "ACTIVE",

        userId: transaction.userId,
        transactionId: transaction.id,

        displayName: transaction.user.publicName || transaction.user.name,
        textLabel: transaction.user.publicName || transaction.user.name,
        fillColor: "#22c55e",
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

    await tx.distributionLedger.createMany({
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

  return {
    ok: true,
    message: "Pagamento aprovado e bloco vendido.",
    transactionId: result.transaction.id,
    placementId: result.placement.id,
    blockIds,
  };
}

async function updatePendingOrReleaseTransaction(paymentData: any) {
  const { prisma } = await import("@/lib/prisma");

  const paymentId = String(paymentData.id);

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
      items: true,
    },
  });

  if (!transaction) {
    return {
      ok: false,
      message: "Transação não encontrada para atualização.",
      paymentId,
      externalReference,
    };
  }

  if (transaction.status === "APPROVED") {
    return {
      ok: true,
      message: "Transação já aprovada. Nenhuma alteração feita.",
      transactionId: transaction.id,
    };
  }

  const nextStatus = mapMercadoPagoStatusToTransactionStatus(
    String(paymentData.status || "")
  );

  const shouldRelease = shouldReleaseReservedBlock(
    String(paymentData.status || "")
  );

  const result = await prisma.$transaction(async (tx) => {
    const updatedTransaction = await tx.transaction.update({
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

    return updatedTransaction;
  });

  return {
    ok: true,
    message: shouldRelease
      ? "Pagamento não aprovado. Bloco reservado foi liberado."
      : "Pagamento atualizado, mas ainda não aprovado.",
    transactionId: result.id,
    status: result.status,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Webhook Mercado Pago carregado.",
    path: "/api/mercado-pago-pix/webhook",
  });
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          message: "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
        },
        {
          status: 500,
        }
      );
    }

    let body: MercadoPagoNotificationBody | null = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const notificationType = getNotificationType(request, body);
    const paymentId = getPaymentIdFromNotification(request, body);

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

    const paymentData = await getMercadoPagoPayment(paymentId, accessToken);

    if (paymentData.status === "approved") {
      const result = await approveTransaction(paymentData);

      return NextResponse.json({
        ok: true,
        webhook: "processed",
        paymentStatus: paymentData.status,
        result,
      });
    }

    const result = await updatePendingOrReleaseTransaction(paymentData);

    return NextResponse.json({
      ok: true,
      webhook: "processed",
      paymentStatus: paymentData.status,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao processar webhook Mercado Pago.",
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}