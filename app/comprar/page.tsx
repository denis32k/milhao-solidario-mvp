import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ComprarPage() {
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
    <main className="h-[100dvh] overflow-hidden bg-[#f6f7fb] pt-[152px] lg:pt-[112px]">
      <StickyHeader ranking={ranking} active="comprar" />
      <section id="mural-compra" className="relative h-full">
        <PixelMap mode="purchase" />
      </section>
    </main>
  );
}
