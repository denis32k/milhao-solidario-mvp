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

  const layout = isLarge
    ? {
        wrap: "h-[138px] sm:h-[156px] max-w-[1040px]",
        medal: "h-[116px] w-[116px] sm:h-[140px] sm:w-[140px]",
        ribbon: "left-[74px] h-[70px] sm:left-[92px] sm:h-[82px]",
        content: "left-[132px] right-12 sm:left-[168px] sm:right-20",
        title: "text-xl sm:text-3xl",
        amount: "text-sm sm:text-base",
      }
    : isMedium
      ? {
          wrap: "h-[118px] sm:h-[134px] max-w-[880px]",
          medal: "h-[96px] w-[96px] sm:h-[116px] sm:w-[116px]",
          ribbon: "left-[62px] h-[62px] sm:left-[76px] sm:h-[70px]",
          content: "left-[112px] right-10 sm:left-[140px] sm:right-16",
          title: "text-lg sm:text-2xl",
          amount: "text-xs sm:text-sm",
        }
      : {
          wrap: "h-[104px] sm:h-[120px] max-w-[740px]",
          medal: "h-[84px] w-[84px] sm:h-[102px] sm:w-[102px]",
          ribbon: "left-[54px] h-[56px] sm:left-[68px] sm:h-[64px]",
          content: "left-[98px] right-8 sm:left-[124px] sm:right-14",
          title: "text-base sm:text-xl",
          amount: "text-xs sm:text-sm",
        };

  return (
    <article className={`relative w-full ${layout.wrap}`}>
      <div
        className={`absolute bottom-0 top-0 my-auto rounded-l-[24px] bg-gradient-to-r ${visual.ribbon} ${layout.ribbon} right-0 shadow-[0_14px_34px_rgba(15,23,42,0.18)]`}
        style={{ clipPath: "polygon(0 0, calc(100% - 42px) 0, 100% 50%, calc(100% - 42px) 100%, 0 100%)" }}
      />

      <div className={`absolute left-0 top-1/2 z-20 -translate-y-1/2 ${layout.medal}`}>
        <Image
          src={visual.medalSrc}
          alt={visual.position}
          fill
          className="object-contain drop-shadow-[0_14px_20px_rgba(15,23,42,0.28)]"
          sizes="150px"
        />
      </div>

      <div className={`absolute top-1/2 z-30 -translate-y-1/2 ${layout.content}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${visual.chip}`}>
            {visual.position}
          </span>
          {position === 1 && (
            <span className="hidden rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800 sm:inline-flex">
              Maior destaque
            </span>
          )}
        </div>

        <h2 className={`mt-1 truncate font-black leading-tight text-white drop-shadow-sm ${layout.title}`}>
          {publicLabel(user)}
        </h2>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className={`font-black text-white/95 ${layout.amount}`}>{money(user.totalApprovedCents)}</p>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700">
            {user._count.ownedBlocks} tijolinho(s)
          </span>
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
