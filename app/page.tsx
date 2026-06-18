import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";


function getVisitorIpHash(headersList: Headers) {
  const forwarded = headersList.get("x-forwarded-for") || "";
  const realIp = headersList.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

async function shouldRedirectToPurchaseTutorial() {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("mural29_purchase_tutorial_seen")?.value === "1") return false;

    const headersList = await headers();
    const ipHash = getVisitorIpHash(headersList);
    const seen = await (prisma as any).consentLog.findFirst({
      where: { ipHash, channel: "purchase_tutorial_seen" },
      select: { id: true },
    });

    return !seen;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  if (await shouldRedirectToPurchaseTutorial()) redirect("/comprar?tour=1");

  let users: { id: string; name: string | null; publicName: string | null; totalApprovedCents: number }[] = [];

  try {
    users = await prisma.user.findMany({
      where: { totalApprovedCents: { gt: 0 }, isBanned: false },
      orderBy: [{ totalApprovedCents: "desc" }, { createdAt: "asc" }],
      take: 3,
      select: { id: true, name: true, publicName: true, totalApprovedCents: true },
    });
  } catch {
    users = [];
  }

  const ranking = users.map((user) => ({
    id: user.id,
    publicName: user.name || user.publicName || "Comprador",
    totalApprovedCents: user.totalApprovedCents,
  }));

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f7fb]">
      <StickyHeader ranking={ranking} active="mural" />
      <section id="mural" className="relative min-h-0 flex-1">
        <PixelMap mode="official" />
      </section>
    </main>
  );
}
