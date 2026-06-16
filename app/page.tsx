import Link from "next/link";
import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GOAL_CENTS = 200000000;

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

async function getHomeStats() {
  try {
    const [approvedTotal, totalBlocks, soldBlocks] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          status: "APPROVED",
        },
        _sum: {
          subtotalCents: true,
        },
      }),

      prisma.block.count(),

      prisma.block.count({
        where: {
          status: "SOLD",
        },
      }),
    ]);

    const raisedCents = approvedTotal._sum.subtotalCents ?? 0;

    return {
      raisedCents,
      totalBlocks,
      soldBlocks,
    };
  } catch (error) {
    console.error("Erro ao carregar estatísticas da home:", error);

    return {
      raisedCents: 0,
      totalBlocks: 29000,
      soldBlocks: 0,
    };
  }
}

export default async function HomePage() {
  const stats = await getHomeStats();

  const progress = Math.min(100, (stats.raisedCents / GOAL_CENTS) * 100);

  const formattedGoal = money(GOAL_CENTS);
  const formattedRaised = money(stats.raisedCents);

  return (
    <main className="h-screen bg-slate-100">
      <StickyHeader />

      <section className="relative h-screen pt-16">
        <PixelMap />

        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <div className="pointer-events-auto rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Arrecadação atual
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {formattedRaised}
                </h2>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Meta principal: {formattedGoal}
                </p>

                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  Blocos vendidos: {stats.soldBlocks} de {stats.totalBlocks}
                </p>
              </div>

              <div className="rounded-2xl bg-yellow-400 px-3 py-2 text-center shadow">
                <p className="text-[10px] font-black uppercase text-yellow-950">
                  Centro
                </p>
                <p className="text-sm font-black text-yellow-950">
                  Bloqueado 🔒
                </p>
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  Criador
                </p>
                <p className="text-sm font-black text-slate-950">
                  50%
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-3">
                <p className="text-[10px] font-black uppercase text-green-700">
                  Hospital
                </p>
                <p className="text-sm font-black text-green-800">
                  50%
                </p>
              </div>

              <div className="rounded-2xl bg-orange-50 p-3">
                <p className="text-[10px] font-black uppercase text-orange-700">
                  Taxa
                </p>
                <p className="text-sm font-black text-orange-800">
                  +10%
                </p>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] font-semibold leading-relaxed text-slate-500">
              A taxa operacional e tributária de 10% ajuda a cobrir custos,
              impostos e manutenção do projeto.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/checkout"
                className="rounded-2xl bg-green-500 py-3 text-center text-xs font-black text-white shadow-lg active:scale-95"
              >
                Bloco R$ 10
              </Link>

              <Link
                href="/checkout"
                className="rounded-2xl bg-orange-500 py-3 text-center text-xs font-black text-white shadow-lg active:scale-95"
              >
                Premium R$ 100
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}