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

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function publicLabel(user?: Pick<RankingUser, "publicName" | "name"> | null) {
  if (!user) return "";
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
      take: 200,
    });

    return users;
  } catch (error) {
    console.error("Erro ao carregar ranking:", error);
    return [];
  }
}

function HeroName({
  user,
  className,
  tone,
}: {
  user?: RankingUser;
  className: string;
  tone: "gold" | "silver" | "bronze";
}) {
  const toneClass = {
    gold: "text-[#3d2500] drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]",
    silver: "text-[#192235] drop-shadow-[0_1px_0_rgba(255,255,255,0.50)]",
    bronze: "text-[#2d1407] drop-shadow-[0_1px_0_rgba(255,226,190,0.35)]",
  }[tone];

  if (!user) return null;

  return (
    <div className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center ${className}`}>
      <p className={`truncate px-1 font-black uppercase leading-none tracking-[0.03em] ${toneClass}`} style={{ textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>
        {publicLabel(user)}
      </p>
    </div>
  );
}

function HeroValue({
  user,
  className,
}: {
  user?: RankingUser;
  className: string;
}) {
  if (!user) return null;

  return (
    <div className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center ${className}`}>
      <p className="truncate font-black tracking-[0.04em] text-[#f8d981] drop-shadow-[0_2px_5px_rgba(0,0,0,0.65)]">
        {money(user.totalApprovedCents)}
      </p>
    </div>
  );
}

function VipRow({ user, position }: { user: RankingUser; position: number }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-amber-300/18 bg-white/[0.045] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-200 via-amber-500 to-orange-700" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/12 text-sm font-black text-amber-100 shadow-inner">
            #{position}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{publicLabel(user)}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Lista VIP • {user._count.ownedBlocks} tijolinho(s)
            </p>
          </div>
        </div>

        <p className="shrink-0 text-lg font-black text-amber-100">{money(user.totalApprovedCents)}</p>
      </div>
    </article>
  );
}

function RemainingRow({ user, position }: { user: RankingUser; position: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-4 last:border-b-0 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white sm:text-base">
          {position}º • {publicLabel(user)}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-slate-400">
          {user._count.ownedBlocks} tijolinho(s)
        </p>
      </div>
      <p className="shrink-0 text-sm font-black text-slate-200 sm:text-base">
        {money(user.totalApprovedCents)}
      </p>
    </div>
  );
}

export default async function RankingPage() {
  const ranking = await getRanking();

  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const vip = ranking.slice(3, 10);
  const remaining = ranking.slice(10);

  return (
    <main className="min-h-screen bg-[#010D23] text-white">
      <section className="relative mx-auto w-full max-w-[1600px] overflow-hidden bg-[#010D23]">
        <div className="relative aspect-[2/1] min-h-[330px] w-full">
          <Image
            src="/hall-fame-hero.jpg"
            alt="Hall da Fama Mural29"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />

          <Link
            href="/"
            aria-label="Voltar ao mural"
            className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-xl font-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-black/55 sm:left-5 sm:top-5"
          >
            ←
          </Link>

          <HeroName user={second} tone="silver" className="left-[23.8%] top-[85.0%] w-[15.6%] text-[clamp(7px,0.72vw,11px)]" />
          <HeroName user={first} tone="gold" className="left-[50%] top-[85.3%] w-[17.4%] text-[clamp(7px,0.76vw,12px)]" />
          <HeroName user={third} tone="bronze" className="left-[76.2%] top-[85.0%] w-[15.6%] text-[clamp(7px,0.72vw,11px)]" />

          <HeroValue user={second} className="left-[23.8%] top-[96.1%] w-[16.5%] text-[clamp(8px,0.82vw,13px)]" />
          <HeroValue user={first} className="left-[50%] top-[96.2%] w-[18.5%] text-[clamp(9px,0.86vw,14px)]" />
          <HeroValue user={third} className="left-[76.2%] top-[96.1%] w-[16.5%] text-[clamp(8px,0.82vw,13px)]" />
        </div>
      </section>

      <section className="relative border-y border-amber-300/20 bg-[#010D23]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.16),_transparent_48%)]" />
        <div className="relative mx-auto flex min-h-20 max-w-6xl items-center justify-center px-4 py-5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 to-amber-300/20" />
          <h1 className="px-5 text-center font-serif text-2xl font-black uppercase tracking-[0.26em] text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.22)] sm:text-4xl">
            Lista VIP
          </h1>
          <div className="h-px flex-1 bg-gradient-to-r from-amber-300/20 via-amber-300/60 to-transparent" />
        </div>
      </section>

      <section className="bg-[#010D23] px-4 py-7 sm:px-5 sm:py-9">
        <div className="mx-auto max-w-5xl">
          {ranking.length === 0 && (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
              <h2 className="text-2xl font-black text-white">O Hall da Fama ainda está vazio</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Assim que as primeiras compras aprovadas entrarem no mural, os destaques aparecem aqui automaticamente.
              </p>
            </div>
          )}

          {vip.length > 0 && (
            <div className="space-y-3">
              {vip.map((user, index) => (
                <VipRow key={user.id} user={user} position={index + 4} />
              ))}
            </div>
          )}

          {remaining.length > 0 && (
            <section className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.045] via-white/[0.035] to-transparent shadow-[0_22px_70px_rgba(0,0,0,0.2)]">
              <div className="border-b border-white/10 px-4 py-5 sm:px-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Ranking completo
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">Restante da lista</h2>
              </div>

              <div>
                {remaining.map((user, index) => (
                  <RemainingRow key={user.id} user={user} position={index + 11} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
