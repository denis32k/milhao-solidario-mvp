import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";
import HomeHallOfFame from "@/components/home/HomeHallOfFame";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let users: { id: string; name: string; publicName: string | null; totalApprovedCents: number }[] = [];

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
    publicName: user.publicName || user.name || "Comprador",
    totalApprovedCents: user.totalApprovedCents,
  }));

  return (
    <main className="h-[100dvh] overflow-hidden bg-slate-950 pt-16">
      <StickyHeader />
      <section id="mural" className="relative h-full">
        <HomeHallOfFame ranking={ranking} />
        <PixelMap />
      </section>
    </main>
  );
}
