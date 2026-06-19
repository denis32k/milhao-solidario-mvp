import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RankingUser = {
  id: string;
  name: string;
  publicName: string | null;
  totalApprovedCents: number;
  _count: {
    ownedBlocks: number;
  };
};

const podiumVisuals = {
  1: {
    medalSrc: "/hall-medal-1.png",
    position: "1º lugar",
    ribbon: "from-[#f7d36a] via-[#d28c08] to-[#9b5a00]",
    border: "border-amber-300",
    glow: "shadow-[0_18px_50px_rgba(217,119,6,0.18)]",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    size: "large" as const,
  },
  2: {
    medalSrc: "/hall-medal-2.png",
    position: "2º lugar",
    ribbon: "from-slate-300 via-slate-600 to-slate-900",
    border: "border-slate-300",
    glow: "shadow-[0_16px_44px_rgba(100,116,139,0.18)]",
    chip: "bg-slate-50 text-slate-700 border-slate-200",
    size: "medium" as const,
  },
  3: {
    medalSrc: "/hall-medal-3.png",
    position: "3º lugar",
    ribbon: "from-[#d7a17a] via-[#a64a14] to-[#6a2808]",
    border: "border-orange-300",
    glow: "shadow-[0_16px_44px_rgba(194,65,12,0.18)]",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    size: "small" as const,
  },
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function publicLabel(user: Pick<RankingUser, "publicName" | "name">) {
  return user.publicName?.trim() || user.name;
}

async function getRanking(): Promise<RankingUser[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        totalApprovedCents: {
          gt: 0,
        },
        isBanned: false,
        isTest: false,
      },
      select: {
        id: true,
        name: true,
        publicName: true,
        totalApprovedCents: true,
        _count: {
          select: {
            ownedBlocks: true,
          },
        },
      },
      orderBy: {
        totalApprovedCents: "desc",
      },
      take: 100,
    });

    return users;
  } catch (error) {
    console.error("Erro ao carregar ranking:", error);
    return [];
  }
}

function PodiumCard({ user, position }: { user: RankingUser; position: 1 | 2 | 3 }) {
  const visual = podiumVisuals[position];
  const isLarge = visual.size === "large";
  const isMedium = visual.size === "medium";

  const medalBox = isLarge
    ? "h-28 w-28 sm:h-32 sm:w-32"
    : isMedium
      ? "h-24 w-24 sm:h-28 sm:w-28"
      : "h-20 w-20 sm:h-24 sm:w-24";

  const leftPad = isLarge ? "pl-24 sm:pl-28" : isMedium ? "pl-20 sm:pl-24" : "pl-[4.5rem] sm:pl-20";
  const cardHeight = isLarge ? "min-h-[164px] sm:min-h-[188px]" : isMedium ? "min-h-[148px] sm:min-h-[162px]" : "min-h-[140px] sm:min-h-[154px]";
  const titleSize = isLarge ? "text-2xl sm:text-3xl" : isMedium ? "text-xl sm:text-2xl" : "text-lg sm:text-xl";

  return (
    <article className={`relative overflow-hidden rounded-[30px] border bg-white ${visual.border} ${visual.glow} ${cardHeight}`}>
      <div className={`absolute inset-x-3 top-1/2 h-[58px] -translate-y-1/2 rounded-r-full bg-gradient-to-r ${visual.ribbon} opacity-95 sm:inset-x-4 sm:h-[68px]`} />
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 ${medalBox} sm:left-3`}>
        <Image src={visual.medalSrc} alt={visual.position} fill className="object-contain drop-shadow-[0_12px_20px_rgba(15,23,42,0.24)]" sizes="140px" />
      </div>

      <div className={`relative z-10 flex h-full flex-col justify-center gap-2 py-5 pr-4 ${leftPad} sm:pr-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${visual.chip}`}>
            {visual.position}
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/90 sm:text-xs">
            Hall da Fama
          </span>
        </div>

        <div>
          <h2 className={`font-black leading-tight text-white ${titleSize}`}>{publicLabel(user)}</h2>
          <p className="mt-1 text-sm font-bold text-white/90 sm:text-base">{money(user.totalApprovedCents)}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600 sm:text-xs">
          <span className="rounded-full bg-white/92 px-3 py-1">{user._count.ownedBlocks} tijolinho(s)</span>
          <span className="rounded-full bg-white/92 px-3 py-1">Destaque oficial</span>
        </div>
      </div>
    </article>
  );
}

export default async function RankingPage() {
  const ranking = await getRanking();

  const topThree = ranking.slice(0, 3);
  const vip = ranking.slice(3, 10);
  const remaining = ranking.slice(10);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 sm:px-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
            ← Voltar ao mural
          </Link>

          <Link href="/comprar" className="inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-slate-900">
            Comprar meu tijolinho
          </Link>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_30%)] px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Hall da Fama</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Os nomes que estão construindo o Mural29</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Aqui ficam os compradores em maior destaque do projeto. Os três primeiros recebem posição de honra. Do 4º ao 10º entram na lista VIP.
            </p>
          </div>
        </section>

        {ranking.length === 0 && (
          <section className="mt-6 rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">🏆</div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">O Hall da Fama ainda está vazio</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Assim que as primeiras compras aprovadas entrarem no mural, os destaques aparecem aqui automaticamente.
            </p>
          </section>
        )}

        {topThree.length > 0 && (
          <section className="mt-6 space-y-4">
            {topThree[0] && (
              <div className="w-full">
                <PodiumCard user={topThree[0]} position={1} />
              </div>
            )}

            {topThree[1] && (
              <div className="w-full sm:max-w-[92%] lg:max-w-[84%]">
                <PodiumCard user={topThree[1]} position={2} />
              </div>
            )}

            {topThree[2] && (
              <div className="w-full sm:max-w-[86%] lg:max-w-[72%]">
                <PodiumCard user={topThree[2]} position={3} />
              </div>
            )}
          </section>
        )}

        {vip.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lista VIP</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">4º ao 10º lugar</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Top 10 oficial</span>
            </div>

            <div className="divide-y divide-slate-100">
              {vip.map((user, index) => {
                const position = index + 4;
                return (
                  <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">#{position}</div>
                      <div>
                        <p className="text-base font-black text-slate-950">{publicLabel(user)}</p>
                        <p className="text-xs font-semibold text-slate-500">{user._count.ownedBlocks} tijolinho(s)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">Lista VIP</span>
                      <p className="text-lg font-black text-slate-900">{money(user.totalApprovedCents)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {remaining.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ranking completo</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Demais posições</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {remaining.map((user, index) => {
                const position = index + 11;
                return (
                  <div key={user.id} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950 sm:text-base">{position}º • {publicLabel(user)}</p>
                      <p className="text-xs font-semibold text-slate-500">{user._count.ownedBlocks} tijolinho(s)</p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-800 sm:text-base">{money(user.totalApprovedCents)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
