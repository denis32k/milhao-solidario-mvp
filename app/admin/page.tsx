import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { getAreaName, siteConfig, type AreaKey } from "@/lib/site-config";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminLocked from "@/components/admin/AdminLocked";
import { getAdminAccess, muralBlockHref } from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { validateImageFile } from "@/lib/content-validation";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{ secret?: string }>;

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function isAuthorized(secretFromUrl: string | undefined) {
  const secret = process.env.ADMIN_API_SECRET;
  return Boolean(secret && secretFromUrl === secret);
}

async function isAuthorizedForAction(secretFromForm: string | undefined) {
  if (isAuthorized(secretFromForm)) return true;
  const session = await getAdminSession();
  return Boolean(session?.user);
}

const ADMIN_ACTION_TYPES = new Set([
  "WARN",
  "BLOCK_IMAGE",
  "BLOCK_LINK",
  "HIDE_DESCRIPTION",
  "HIDE_PUBLIC_NAME",
  "RELEASE_BLOCK",
  "BAN_USER",
  "RESOLVE_REPORT",
  "REJECT_REPORT",
  "RESTORE_CONTENT",
  "APPROVE_CONTENT",
  "APPROVE_EDIT",
  "REJECT_EDIT",
  "OPEN_DISPUTE",
  "CLOSE_DISPUTE",
  "BAN_RELEASE",
]);

async function getSystemAdminId() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@mural29.local" },
    update: { role: "ADMIN" },
    create: {
      name: "Admin Mural29",
      publicName: "Admin",
      email: "admin@mural29.local",
      role: "ADMIN",
    },
    select: { id: true },
  });

  return admin.id;
}

async function recordAdminAction({
  type,
  note,
  reportId,
  placementId,
  blockId,
  editRequestId,
  disputeCaseId,
}: {
  type: string;
  note: string;
  reportId?: string | null;
  placementId?: string | null;
  blockId?: string | null;
  editRequestId?: string | null;
  disputeCaseId?: string | null;
}) {
  if (!ADMIN_ACTION_TYPES.has(type)) return;

  const adminId = await getSystemAdminId();

  await prisma.adminAction.create({
    data: {
      type: type as any,
      note,
      adminId,
      reportId: reportId || null,
      placementId: placementId || null,
      blockId: blockId || null,
      editRequestId: editRequestId || null,
      disputeCaseId: disputeCaseId || null,
    },
  });
}

function areaLabel(value: string | null | undefined) {
  if (value === "SOLIDARITY" || value === "PREMIUM" || value === "GOLD" || value === "GRAND_CENTER") {
    return getAreaName(value as AreaKey);
  }

  return value || "Área";
}

async function safeListQuery<T>(factory: () => Promise<T[]>): Promise<T[]> {
  try {
    return await factory();
  } catch {
    return [];
  }
}

async function safeValueQuery<T>(factory: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await factory();
  } catch {
    return fallback;
  }
}

async function sumTransactionCents(where: any) {
  return safeValueQuery(async () => {
    const result = (await (prisma as any).transaction.aggregate({
      where,
      _sum: { totalPaidCents: true },
    })) as any;

    return Number(result?._sum?.totalPaidCents || 0);
  }, 0);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function subDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}


type TestCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

type AvailableBlockForTest = {
  id: string;
  gridX: number;
  gridY: number;
  category: TestCategory;
  priceCents: number;
};

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function normalizeTestCategory(value: string): TestCategory {
  if (value === "PREMIUM") return "PREMIUM";
  if (value === "GOLD") return "GOLD";
  if (value === "GRAND_CENTER") return "GRAND_CENTER";
  return "SOLIDARITY";
}

async function saveTestImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) return null;
  if (!file.size) return null;

  const validation = validateImageFile(file);
  if (!validation.ok || !validation.extension) return null;

  const filename = `teste-${Date.now()}-${randomUUID()}.${validation.extension}`;
  const uploadDir = getUploadDir();
  const filepath = path.join(uploadDir, filename);
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  return `/api/uploads/file/${filename}`;
}


async function updateBrandLogo(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  if (!(await isAuthorizedForAction(secret))) return;

  const file = formData.get("logo");
  if (!(file instanceof File) || !file.size) return;
  if (file.type !== "image/png") return;

  const uploadDir = path.join(process.cwd(), "public");
  const filepath = path.join(uploadDir, "logo-mural-29.png");
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, Buffer.from(bytes));

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/transparencia");
}

async function findAvailableRectangle(category: TestCategory, width: number, height: number) {
  const blocks: AvailableBlockForTest[] = await prisma.block.findMany({
    where: {
      category,
      gridX: { lt: GRID_COLS },
      gridY: { lt: GRID_ROWS },
      status: "AVAILABLE",
      available: true,
    },
    select: {
      id: true,
      gridX: true,
      gridY: true,
      category: true,
      priceCents: true,
    },
    orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
    take: 29000,
  });

  const byCoord = new Map(blocks.map((block) => [`${block.gridX}:${block.gridY}`, block]));

  for (const block of blocks) {
    const selected: AvailableBlockForTest[] = [];

    for (let y = block.gridY; y < block.gridY + height; y++) {
      for (let x = block.gridX; x < block.gridX + width; x++) {
        const found = byCoord.get(`${x}:${y}`);
        if (found) selected.push(found);
      }
    }

    if (selected.length === width * height) {
      return selected;
    }
  }

  return [];
}

async function createTestArea(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  if (!(await isAuthorizedForAction(secret))) return;

  const category = normalizeTestCategory(String(formData.get("category") || "SOLIDARITY"));
  const width = category === "SOLIDARITY" ? 1 : Math.max(1, Math.min(8, Number(formData.get("width") || (category === "GRAND_CENTER" ? 3 : 2))));
  const height = category === "SOLIDARITY" ? 1 : Math.max(1, Math.min(8, Number(formData.get("height") || (category === "GRAND_CENTER" ? 3 : 2))));
  const imageUrl = await saveTestImage(formData.get("image"));
  const blocks = await findAvailableRectangle(category, width, height);

  if (blocks.length !== width * height) {
    return;
  }

  const now = new Date();
  const uniqueId = Date.now();
  const testName = category === "SOLIDARITY" ? siteConfig.testData.supporterName : siteConfig.testData.brandName;
  const fillColor = category === "SOLIDARITY" ? siteConfig.mosaicColors[0].value : category === "GOLD" ? "#f59e0b" : category === "GRAND_CENTER" ? "#c026d3" : "#0f172a";
  const kind = category;

  await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        name: testName,
        publicName: testName,
        email: `teste-${uniqueId}@example.com`,
        whatsapp: "11999999999",
        cpfLast4: "0000",
        totalApprovedCents: 0,
        isTest: true,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        kind,
        status: "APPROVED",
        userId: user.id,
        subtotalCents: 0,
        operatorFeeCents: 0,
        totalPaidCents: 0,
        creatorShareCents: 0,
        hospitalShareCents: 0,
        placementTitle: testName,
        placementDescription: siteConfig.testData.description,
        placementRedirectUrl: siteConfig.testData.link,
        placementImageUrl: imageUrl,
        placementFillColor: fillColor,
        mpExternalReference: `teste-${uniqueId}`,
        mpStatus: "test",
        mpStatusDetail: "admin_test_area",
        approvedAt: now,
        paidAt: now,
        isTest: true,
      },
    });

    const minX = Math.min(...blocks.map((block) => block.gridX));
    const maxX = Math.max(...blocks.map((block) => block.gridX));
    const minY = Math.min(...blocks.map((block) => block.gridY));
    const maxY = Math.max(...blocks.map((block) => block.gridY));

    const placement = await tx.placement.create({
      data: {
        kind,
        status: "ACTIVE",
        userId: user.id,
        transactionId: transaction.id,
        title: testName,
        description: siteConfig.testData.description,
        imageUrl,
        redirectUrl: siteConfig.testData.link,
        displayName: testName,
        textLabel: testName,
        fillColor,
        originX: minX,
        originY: minY,
        widthBlocks: maxX - minX + 1,
        heightBlocks: maxY - minY + 1,
        isTest: true,
      },
    });

    await tx.block.updateMany({
      where: { id: { in: blocks.map((block) => block.id) } },
      data: {
        status: "SOLD",
        available: false,
        ownerId: user.id,
        placementId: placement.id,
        currentTransactionId: transaction.id,
      },
    });

    await tx.transactionBlock.createMany({
      data: blocks.map((block) => ({
        transactionId: transaction.id,
        blockId: block.id,
        gridX: block.gridX,
        gridY: block.gridY,
        category: block.category,
        priceCents: block.priceCents,
      })),
    });
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function deleteTestAreas(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  if (!(await isAuthorizedForAction(secret))) return;

  const placementId = String(formData.get("placementId") || "");
  const where = placementId ? { id: placementId, isTest: true } : { isTest: true };
  const placements = await prisma.placement.findMany({
    where,
    select: { id: true, transactionId: true, userId: true },
  });

  if (!placements.length) return;

  const placementIds = placements.map((placement) => placement.id);
  const transactionIds = placements.map((placement) => placement.transactionId);
  const userIds = placements.map((placement) => placement.userId);

  await prisma.$transaction(async (tx: any) => {
    await tx.report.deleteMany({ where: { placementId: { in: placementIds } } });
    await tx.block.updateMany({
      where: { placementId: { in: placementIds } },
      data: {
        status: "AVAILABLE",
        available: true,
        ownerId: null,
        placementId: null,
        currentTransactionId: null,
        reservationToken: null,
        reservedUntil: null,
      },
    });
    await tx.placement.deleteMany({ where: { id: { in: placementIds }, isTest: true } });
    await tx.transaction.deleteMany({ where: { id: { in: transactionIds }, isTest: true } });
    await tx.user.deleteMany({ where: { id: { in: userIds }, isTest: true } });
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function adminAction(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const action = String(formData.get("action") || "");
  const reportId = String(formData.get("reportId") || "");
  const placementId = String(formData.get("placementId") || "");
  const userId = String(formData.get("userId") || "");
  const editRequestId = String(formData.get("editRequestId") || "");
  const disputeCaseId = String(formData.get("disputeCaseId") || "");
  const note = String(formData.get("note") || "").trim();

  if (!(await isAuthorizedForAction(secret))) return;
  if (!ADMIN_ACTION_TYPES.has(action)) return;
  if (note.length < 5) return;

  let affectedBlockId: string | null = null;
  let affectedPlacementId: string | null = placementId || null;
  let performed = false;

  if (action === "BLOCK_IMAGE" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: {
        imageUrl: null,
        imageStorageKey: null,
        placeholderReason: "Imagem bloqueada pela moderação.",
        status: "IMAGE_BLOCKED",
        reviewStatus: "HIDDEN_BY_ADMIN",
      },
    });

    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    performed = true;
  }

  if (action === "BLOCK_LINK" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: { linkDisabled: true, reviewStatus: "CHANGES_REQUESTED" },
    });

    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    performed = true;
  }

  if (action === "HIDE_DESCRIPTION" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: { description: null, placeholderReason: "Descrição ocultada pela moderação.", reviewStatus: "CHANGES_REQUESTED" },
    });
    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    performed = true;
  }

  if (action === "HIDE_PUBLIC_NAME" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: {
        title: "Oculto pela moderação",
        displayName: "Oculto pela moderação",
        textLabel: "Oculto",
        placeholderReason: "Nome público ocultado pela moderação.",
        reviewStatus: "CHANGES_REQUESTED",
      },
    });
    if (reportId) await prisma.report.update({ where: { id: reportId }, data: { status: "BLOCKED" } });
    performed = true;
  }

  if (action === "APPROVE_CONTENT" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: { status: "ACTIVE", reviewStatus: "APPROVED", placeholderReason: null },
    });
    performed = true;
  }

  if (action === "RESTORE_CONTENT" && placementId) {
    await prisma.placement.update({
      where: { id: placementId },
      data: { status: "ACTIVE", linkDisabled: false, placeholderReason: null, reviewStatus: "APPROVED" },
    });
    performed = true;
  }

  if (action === "RELEASE_BLOCK" && placementId) {
    const firstBlock = await prisma.block.findFirst({ where: { placementId }, select: { id: true } });
    affectedBlockId = firstBlock?.id || null;

    await prisma.$transaction(async (tx: any) => {
      await tx.block.updateMany({
        where: { placementId },
        data: {
          status: "AVAILABLE",
          available: true,
          ownerId: null,
          placementId: null,
          currentTransactionId: null,
          reservationToken: null,
          reservedUntil: null,
        },
      });

      await tx.placement.update({
        where: { id: placementId },
        data: {
          status: "REMOVED",
          reviewStatus: "HIDDEN_BY_ADMIN",
          imageUrl: null,
          redirectUrl: null,
          linkDisabled: true,
          placeholderReason: "Tijolinho liberado pela moderação.",
        },
      });

      if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
    });
    performed = true;
  }

  if (action === "BAN_USER" && userId) {
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id: userId }, data: { isBanned: true } });
      await tx.placement.updateMany({
        where: { userId },
        data: {
          status: "BANNED",
          reviewStatus: "HIDDEN_BY_ADMIN",
          imageUrl: null,
          redirectUrl: null,
          linkDisabled: true,
          description: null,
          placeholderReason: "Comprador banido pela moderação.",
        },
      });

      if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "BANNED" } });
    });
    performed = true;
  }

  if (action === "RESOLVE_REPORT" && reportId) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
    performed = true;
  }

  if (action === "REJECT_REPORT" && reportId) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "DISMISSED" } });
    performed = true;
  }

  if ((action === "APPROVE_EDIT" || action === "REJECT_EDIT") && editRequestId) {
    const editRequest = await prisma.contentEditRequest.findUnique({
      where: { id: editRequestId },
      include: { placement: true },
    });

    if (editRequest && editRequest.status === "PENDING") {
      affectedPlacementId = editRequest.placementId;
      const adminId = await getSystemAdminId();

      if (action === "APPROVE_EDIT") {
        const placementData: any = { reviewStatus: "APPROVED", status: "ACTIVE" };
        if (editRequest.requestedTitle !== null) placementData.title = editRequest.requestedTitle;
        if (editRequest.requestedDescription !== null) placementData.description = editRequest.requestedDescription;
        if (editRequest.requestedImageUrl !== null) placementData.imageUrl = editRequest.requestedImageUrl;
        if (editRequest.requestedRedirectUrl !== null) placementData.redirectUrl = editRequest.requestedRedirectUrl;
        if (editRequest.requestedDisplayName !== null) placementData.displayName = editRequest.requestedDisplayName;
        if (editRequest.requestedTextLabel !== null) placementData.textLabel = editRequest.requestedTextLabel;

        await prisma.$transaction(async (tx: any) => {
          await tx.placement.update({ where: { id: editRequest.placementId }, data: placementData });
          await tx.contentEditRequest.update({
            where: { id: editRequest.id },
            data: { status: "APPROVED", reviewedByAdminId: adminId, reviewedAt: new Date(), adminNote: note },
          });
        });
      } else {
        await prisma.contentEditRequest.update({
          where: { id: editRequest.id },
          data: { status: "REJECTED", reviewedByAdminId: adminId, reviewedAt: new Date(), adminNote: note },
        });
      }

      performed = true;
    }
  }

  if (performed) {
    await recordAdminAction({
      type: action,
      note,
      reportId: reportId || null,
      placementId: affectedPlacementId,
      blockId: affectedBlockId,
      editRequestId: editRequestId || null,
      disputeCaseId: disputeCaseId || null,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

function ActionButton({
  label,
  action,
  secret,
  reportId,
  placementId,
  userId,
  editRequestId,
  disputeCaseId,
  className,
}: {
  label: string;
  action: string;
  secret: string;
  reportId?: string | null;
  placementId?: string | null;
  userId?: string | null;
  editRequestId?: string | null;
  disputeCaseId?: string | null;
  className: string;
}) {
  return (
    <form action={adminAction} className="space-y-2">
      <input type="hidden" name="secret" value={secret} />
      <input type="hidden" name="action" value={action} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      {placementId && <input type="hidden" name="placementId" value={placementId} />}
      {userId && <input type="hidden" name="userId" value={userId} />}
      {editRequestId && <input type="hidden" name="editRequestId" value={editRequestId} />}
      {disputeCaseId && <input type="hidden" name="disputeCaseId" value={disputeCaseId} />}
      <input
        name="note"
        required
        minLength={5}
        placeholder="Motivo obrigatório"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-slate-950"
      />
      <button type="submit" className={className}>{label}</button>
    </form>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  const authorized = access.authorized;

  if (!authorized) return <AdminLocked nextPath="/admin" />;

  const [
    latestTransactions,
    soldBlocks,
    pendingReservations,
    premiumPlacements,
    reports,
    bannedUsers,
    testPlacements,
    pendingEditRequests,
    openDisputes,
    latestAdminActions,
  ] = (await Promise.all([
    safeListQuery(() =>
        prisma.transaction.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: true, items: true },
        }),
    ),
    safeValueQuery(() => prisma.block.count({ where: { status: "SOLD" } }), 0),
    safeListQuery(() =>
        prisma.block.findMany({
          where: { status: "RESERVED" },
          orderBy: { reservedUntil: "asc" },
          take: 20,
          include: { owner: true },
        }),
    ),
    safeListQuery(() =>
        prisma.placement.findMany({
          where: { isTest: false },
          orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
          take: 50,
          include: { user: true, blocks: { take: 1 } },
        }),
    ),
    safeListQuery(() =>
        prisma.report.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            block: true,
            placement: { include: { user: true } },
          },
        }),
    ),
    safeValueQuery(() => prisma.user.count({ where: { isBanned: true } }), 0),
    safeListQuery(() =>
        prisma.placement.findMany({
          where: { isTest: true },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { blocks: { take: 1 } },
        }),
    ),
    safeListQuery(() =>
        prisma.contentEditRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { user: true, placement: { include: { user: true } } },
        }),
    ),
    safeListQuery(() =>
        prisma.disputeCase.findMany({
          where: { status: { in: ["OPEN", "REVIEWING"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { transaction: { include: { user: true } } },
        }),
    ),
    safeListQuery(() =>
        prisma.adminAction.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { admin: true },
        }),
    ),
  ])) as [
    any[],
    number,
    any[],
    any[],
    any[],
    number,
    any[],
    any[],
    any[],
    any[],
  ];

  const latestTransactionsList = latestTransactions as any[];
  const pendingReservationsList = pendingReservations as any[];
  const premiumPlacementsList = premiumPlacements as any[];
  const reportsList = reports as any[];
  const testPlacementsList = testPlacements as any[];
  const pendingEditRequestsList = pendingEditRequests as any[];
  const openDisputesList = openDisputes as any[];
  const latestAdminActionsList = latestAdminActions as any[];
  const paymentWebhookEventsList = await safeListQuery(() =>
    (prisma as any).paymentWebhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 12,
    })
  );

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = subDays(todayStart, 7);
  const monthStart = startOfMonth(now);

  const [
    totalRevenueCents,
    todayRevenueCents,
    weekRevenueCents,
    monthRevenueCents,
    availableBlocks,
    reservedBlocks,
    expiredReservationsCount,
    unreviewedContentCount,
    pendingPaymentsCount,
    approvedPaymentsTodayCount,
    problematicPaymentsCount,
    soldBlocksByDb,
    areaSalesRaw,
  ] = (await Promise.all([
    sumTransactionCents({ status: "APPROVED", isTest: false }),
    sumTransactionCents({ status: "APPROVED", isTest: false, approvedAt: { gte: todayStart } }),
    sumTransactionCents({ status: "APPROVED", isTest: false, approvedAt: { gte: weekStart } }),
    sumTransactionCents({ status: "APPROVED", isTest: false, approvedAt: { gte: monthStart } }),
    safeValueQuery(() => (prisma as any).block.count({ where: { status: "AVAILABLE", available: true } }), 0),
    safeValueQuery(() => (prisma as any).block.count({ where: { status: "RESERVED" } }), 0),
    safeValueQuery(() => (prisma as any).block.count({ where: { status: "RESERVED", reservedUntil: { lt: now } } }), 0),
    safeValueQuery(() => (prisma as any).placement.count({ where: { reviewStatus: "PUBLISHED_NOT_REVIEWED", isTest: false } }), 0),
    safeValueQuery(() => (prisma as any).transaction.count({ where: { status: "PENDING", isTest: false } }), 0),
    safeValueQuery(() => (prisma as any).transaction.count({ where: { status: "APPROVED", isTest: false, approvedAt: { gte: todayStart } } }), 0),
    safeValueQuery(() => (prisma as any).transaction.count({ where: { status: { in: ["REJECTED", "CANCELLED", "EXPIRED", "REFUNDED"] }, isTest: false } }), 0),
    safeValueQuery(() => (prisma as any).block.count({ where: { status: "SOLD" } }), soldBlocks),
    safeListQuery(() =>
      (prisma as any).transaction.findMany({
        where: { status: "APPROVED", isTest: false },
        orderBy: { approvedAt: "desc" },
        take: 1000,
        select: { kind: true, totalPaidCents: true, items: { select: { blockId: true } } },
      })
    ),
  ])) as [number, number, number, number, number, number, number, number, number, number, number, number, any[]];

  const openReports = reportsList.filter((report: any) => report.status === "OPEN" || report.status === "REVIEWING").length;
  const activeBlocks = Number(soldBlocksByDb || soldBlocks || 0);

  const areaSales = Object.values(
    areaSalesRaw.reduce((acc: Record<string, { kind: string; count: number; blocks: number; totalCents: number }>, transaction: any) => {
      const kind = String(transaction.kind || "SOLIDARITY");
      if (!acc[kind]) acc[kind] = { kind, count: 0, blocks: 0, totalCents: 0 };
      acc[kind].count += 1;
      acc[kind].blocks += Array.isArray(transaction.items) ? transaction.items.length : 0;
      acc[kind].totalCents += Number(transaction.totalPaidCents || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.totalCents - a.totalCents);

  const healthAlerts = [
    expiredReservationsCount > 0 ? `${expiredReservationsCount} reserva(s) expirada(s) para liberar/verificar` : null,
    unreviewedContentCount > 0 ? `${unreviewedContentCount} conteúdo(s) publicado(s) sem revisão` : null,
    openReports > 0 ? `${openReports} denúncia(s) aberta(s)` : null,
    pendingEditRequestsList.length > 0 ? `${pendingEditRequestsList.length} edição(ões) pendente(s)` : null,
    problematicPaymentsCount > 0 ? `${problematicPaymentsCount} pagamento(s) com status problemático` : null,
  ].filter(Boolean);

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-5xl">
        <AdminPageHeader secret={secret} active="dashboard" title="Dashboard" description="Visão geral compacta das vendas, reservas, pagamentos, moderação e saúde operacional do Mural29." />

        <section id="dashboard" className="mb-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Entrou hoje</p><p className="mt-1 text-2xl font-black text-slate-950">{money(todayRevenueCents)}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{approvedPaymentsTodayCount} pagamento(s) aprovado(s)</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Entrou na semana</p><p className="mt-1 text-2xl font-black text-slate-950">{money(weekRevenueCents)}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Entrou no mês</p><p className="mt-1 text-2xl font-black text-slate-950">{money(monthRevenueCents)}</p></div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white shadow"><p className="text-xs font-black text-slate-300">Total aprovado</p><p className="mt-1 text-2xl font-black">{money(totalRevenueCents)}</p></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Blocos vendidos</p><p className="mt-1 text-2xl font-black">{activeBlocks}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Disponíveis</p><p className="mt-1 text-2xl font-black">{availableBlocks}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Reservados</p><p className="mt-1 text-2xl font-black">{reservedBlocks}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Expirados</p><p className="mt-1 text-2xl font-black text-orange-600">{expiredReservationsCount}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Sem revisão</p><p className="mt-1 text-2xl font-black text-yellow-600">{unreviewedContentCount}</p></div>
            <div className="rounded-3xl bg-white p-4 shadow"><p className="text-xs font-black text-slate-500">Pendências</p><p className="mt-1 text-2xl font-black text-red-600">{openReports + pendingEditRequestsList.length + problematicPaymentsCount}</p></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Painel de avião</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Saúde da operação</h2>
                </div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ${healthAlerts.length ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {healthAlerts.length ? "Atenção" : "Saudável"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
                <p>Pagamentos pendentes: <strong>{pendingPaymentsCount}</strong></p>
                <p>Pagamentos problemáticos: <strong>{problematicPaymentsCount}</strong></p>
                <p>Denúncias abertas: <strong>{openReports}</strong></p>
                <p>Edições pendentes: <strong>{pendingEditRequestsList.length}</strong></p>
                <p>Disputas internas: <strong>{openDisputesList.length}</strong></p>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                {healthAlerts.length === 0 ? (
                  <p className="text-sm font-bold text-emerald-700">Tudo limpo por enquanto. Sem alerta crítico no painel.</p>
                ) : (
                  <ul className="space-y-2 text-sm font-bold text-red-700">
                    {healthAlerts.map((alert: any) => <li key={String(alert)}>• {alert}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-xl">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Áreas que mais vendem</p>
              <div className="mt-4 space-y-3">
                {areaSales.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma venda aprovada ainda.</p>}
                {areaSales.map((area: any) => (
                  <div key={area.kind} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">{areaLabel(area.kind)}</p>
                      <p className="text-xs font-black text-slate-500">{money(area.totalCents)}</p>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{area.count} pedido(s) • {area.blocks} bloco(s)</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Logo do site</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Troca rápida do logo</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Envie aqui o logo em PNG com fundo transparente. Ele substitui o logo atual usado no cabeçalho do site.</p>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <img src={siteConfig.brand.logoUrl || "/logo-mural-29.png"} alt="Logo atual" className="h-16 w-auto object-contain" />
            </div>
          </div>

          <form action={updateBrandLogo} encType="multipart/form-data" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-xl">
            <input type="hidden" name="secret" value={secret} />
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Atualização visual</p>
            <h3 className="mt-2 text-lg font-black text-emerald-950">Enviar novo logo</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-800">Aceite preferencial: PNG transparente.</p>
            <input name="logo" type="file" accept="image/png" className="mt-4 w-full rounded-2xl bg-white px-3 py-3 text-sm font-bold" />
            <button type="submit" className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">Salvar novo logo</button>
          </form>
        </section>

        <section id="testes" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Testes do mural</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">Crie áreas fictícias direto no mural sem checkout e sem PIX.</p>
            </div>
            <form action={deleteTestAreas}>
              <input type="hidden" name="secret" value={secret} />
              <button type="submit" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-700">Excluir todos os testes</button>
            </form>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <form action={createTestArea} className="rounded-3xl border border-green-200 bg-green-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="SOLIDARITY" />
              <h3 className="font-black text-green-950">Teste Copacabana</h3>
              <p className="mt-1 text-xs font-bold text-green-700">Cria 1 tijolinho fictício.</p>
              <button type="submit" className="mt-4 w-full rounded-2xl bg-green-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-yellow-200 bg-yellow-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="PREMIUM" />
              <h3 className="font-black text-yellow-950">Teste Ipanema</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="2" className="rounded-xl border border-yellow-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="2" className="rounded-xl border border-yellow-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-yellow-500 py-3 text-xs font-black text-yellow-950">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="GOLD" />
              <h3 className="font-black text-blue-950">Teste Leblon</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="2" className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="2" className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-blue-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>

            <form action={createTestArea} encType="multipart/form-data" className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-4">
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="category" value="GRAND_CENTER" />
              <h3 className="font-black text-fuchsia-950">Teste Tom Delfim Moreira</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input name="width" defaultValue="3" className="rounded-xl border border-fuchsia-200 px-3 py-2 text-sm font-bold" />
                <input name="height" defaultValue="3" className="rounded-xl border border-fuchsia-200 px-3 py-2 text-sm font-bold" />
              </div>
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold" />
              <button type="submit" className="mt-4 w-full rounded-2xl bg-fuchsia-600 py-3 text-xs font-black text-white">Criar teste</button>
            </form>
          </div>

          {testPlacementsList.length > 0 && (
            <div className="mt-5 space-y-2">
              {testPlacementsList.map((placement: any) => (
                <article key={placement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{placement.title || placement.displayName}</p>
                    <p className="text-xs font-bold text-slate-500">{areaLabel(placement.kind)} • teste</p>
                  </div>
                  <form action={deleteTestAreas}>
                    <input type="hidden" name="secret" value={secret} />
                    <input type="hidden" name="placementId" value={placement.id} />
                    <button type="submit" className="rounded-full bg-red-50 px-3 py-2 text-[10px] font-black text-red-700">Excluir teste</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Últimas compras</h2>
          <div className="mt-4 space-y-3">
            {latestTransactionsList.map((transaction: any) => (
              <article key={transaction.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">{transaction.user.publicName || transaction.user.name}</p>
                    <p className="text-xs font-bold text-slate-500">{areaLabel(transaction.kind)} • {transaction.status} • {transaction.items.length} tijolinho(s)</p>
                  </div>
                  <p className="text-sm font-black text-green-700">{money(transaction.totalPaidCents)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="reservas" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Reservas pendentes</h2>
          <div className="mt-4 space-y-3">
            {pendingReservationsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma reserva pendente.</p>}
            {pendingReservationsList.map((block: any) => (
              <article key={block.id} className="rounded-2xl bg-yellow-50 p-4">
                <p><a href={muralBlockHref(block.id)} className="text-sm font-black text-yellow-950 underline decoration-yellow-300 underline-offset-4">x{block.gridX}/y{block.gridY}</a> <span className="text-sm font-black text-yellow-950">• {areaLabel(block.category)}</span></p>
                <p className="text-xs font-bold text-yellow-700">{block.owner?.name || "Sem comprador"} • vence {block.reservedUntil?.toLocaleString("pt-BR")}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="conteudos" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Nome, imagem e link publicados / sem revisão</h2>
          <div className="mt-4 space-y-3">
            {premiumPlacementsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum conteúdo publicado ainda.</p>}
            {premiumPlacementsList.map((placement: any) => (
              <article key={placement.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{areaLabel(placement.kind)} • {placement.status} • {placement.reviewStatus}</p>{placement.blocks?.[0]?.id && <a href={muralBlockHref(placement.blocks[0].id)} className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase text-orange-700">Ver no mural</a>}
                    <h3 className="mt-1 text-lg font-black text-slate-950">{placement.title || placement.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-600">{placement.placeholderReason || "Novo padrão: nome, imagem e link"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Imagem: {placement.imageUrl ? "sim" : "não"} • Link: {placement.redirectUrl && !placement.linkDisabled ? "ativo" : "não"}</p>
                  </div>
                  <div className="grid min-w-44 gap-2">
                    <ActionButton label="Aprovar/revisar" action="APPROVE_CONTENT" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Ocultar texto antigo" action="HIDE_DESCRIPTION" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Ocultar nome" action="HIDE_PUBLIC_NAME" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-yellow-500 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Restaurar conteúdo" action="RESTORE_CONTENT" secret={secret} placementId={placement.id} className="w-full rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Banir comprador" action="BAN_USER" secret={secret} placementId={placement.id} userId={placement.userId} className="w-full rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="edicoes" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Edições futuras pendentes</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">Toda alteração futura de nome, imagem ou link fica parada aqui até aprovação com motivo.</p>
          <div className="mt-4 space-y-3">
            {pendingEditRequestsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma edição pendente.</p>}
            {pendingEditRequestsList.map((request: any) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase text-slate-500">{areaLabel(request.placement.kind)} • {request.status}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{request.placement.title || request.placement.displayName || "Sem título"}</h3>
                    <p className="mt-2 text-sm font-bold text-slate-600">Motivo do comprador: {request.reason}</p>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-relaxed text-slate-600">
                      {request.requestedTitle && <p>Novo nome/título: {request.requestedTitle}</p>}
                      {request.requestedDisplayName && <p>Novo nome público: {request.requestedDisplayName}</p>}
                      {request.requestedRedirectUrl && <p>Novo link: {request.requestedRedirectUrl}</p>}
                      {request.requestedImageUrl && <p>Nova imagem: {request.requestedImageUrl}</p>}
                    </div>
                  </div>
                  <div className="grid min-w-44 gap-2">
                    <ActionButton label="Aprovar edição" action="APPROVE_EDIT" secret={secret} editRequestId={request.id} className="w-full rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Rejeitar edição" action="REJECT_EDIT" secret={secret} editRequestId={request.id} className="w-full rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="pagamentos" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Pagamentos e webhooks</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Registro técnico dos eventos recebidos do Mercado Pago. Se webhook duplicar, atrasar ou falhar, aparece aqui.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">{paymentWebhookEventsList.length} evento(s)</div>
          </div>
          <div className="mt-4 space-y-2">
            {paymentWebhookEventsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum webhook registrado ainda.</p>}
            {paymentWebhookEventsList.map((event: any) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{event.eventType || "evento"} • payment_id {event.paymentId || "—"}</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">{event.previousStatus || "sem status"} → {event.newStatus || "sem status"}</p>
                    {event.error && <p className="mt-1 text-xs font-bold text-red-600">Erro: {event.error}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${event.processed ? "bg-emerald-100 text-emerald-700" : event.ignored ? "bg-slate-100 text-slate-600" : "bg-yellow-100 text-yellow-700"}`}>
                    {event.processed ? "processado" : event.ignored ? "ignorado" : "pendente"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="disputas" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Disputas / chargebacks internos</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">Controle interno, sem criar fluxo público de reembolso.</p>
          <div className="mt-4 space-y-3">
            {openDisputesList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma disputa aberta.</p>}
            {openDisputesList.map((dispute: any) => (
              <article key={dispute.id} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-black uppercase text-red-700">{dispute.status} • {dispute.transaction.user?.publicName || dispute.transaction.user?.name || "Comprador"}</p>
                <h3 className="mt-1 text-lg font-black text-red-950">{money(dispute.transaction.totalPaidCents)}</h3>
                <p className="mt-2 text-sm font-bold text-red-900/80">{dispute.reason}</p>
                {dispute.internalNote && <p className="mt-1 text-xs font-bold text-red-800/70">Nota interna: {dispute.internalNote}</p>}
              </article>
            ))}
          </div>
        </section>

        <section id="auditoria" className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Histórico administrativo</h2>
          <div className="mt-4 space-y-2">
            {latestAdminActionsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma ação registrada.</p>}
            {latestAdminActionsList.map((item: any) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">{item.type} • {item.createdAt.toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{item.note || "Sem nota"}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="denuncias" className="rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Denúncias</h2>
          <div className="mt-4 space-y-3">
            {reportsList.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma denúncia ainda.</p>}
            {reportsList.map((report: any) => (
              <article key={report.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">{report.status} • tijolinho {report.block ? <a href={muralBlockHref(report.blockId)} className="text-orange-700 underline decoration-orange-200 underline-offset-4">x{report.block.gridX}/y{report.block.gridY}</a> : "sem coordenada"}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{report.placement?.title || report.placement?.displayName || "Tijolinho denunciado"}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{report.reasonCode ? `${report.reasonCode} — ` : ""}{report.reason}</p>{report.message && <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">Mensagem: {report.message}</p>}
                  </div>
                  <div className="grid min-w-44 gap-2">
                    <ActionButton label="Bloquear imagem" action="BLOCK_IMAGE" secret={secret} reportId={report.id} placementId={report.placementId} className="w-full rounded-2xl bg-slate-800 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Bloquear link" action="BLOCK_LINK" secret={secret} reportId={report.id} placementId={report.placementId} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Ocultar texto antigo" action="HIDE_DESCRIPTION" secret={secret} reportId={report.id} placementId={report.placementId} className="w-full rounded-2xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Ocultar nome" action="HIDE_PUBLIC_NAME" secret={secret} reportId={report.id} placementId={report.placementId} className="w-full rounded-2xl bg-yellow-500 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Liberar tijolinho" action="RELEASE_BLOCK" secret={secret} reportId={report.id} placementId={report.placementId} className="w-full rounded-2xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950" />
                    <ActionButton label="Banir comprador" action="BAN_USER" secret={secret} reportId={report.id} placementId={report.placementId} userId={report.placement?.userId} className="w-full rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Resolver" action="RESOLVE_REPORT" secret={secret} reportId={report.id} className="w-full rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white" />
                    <ActionButton label="Rejeitar denúncia" action="REJECT_REPORT" secret={secret} reportId={report.id} className="w-full rounded-2xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-800" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
