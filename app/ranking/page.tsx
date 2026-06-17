import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getMedal(position: number) {
  if (position === 1) {
    return "🥇";
  }

  if (position === 2) {
    return "🥈";
  }

  if (position === 3) {
    return "🥉";
  }

  return `${position}º`;
}

function getPodiumStyle(position: number) {
  if (position === 1) {
    return "border-yellow-300 bg-yellow-50 shadow-yellow-200";
  }

  if (position === 2) {
    return "border-slate-300 bg-slate-50 shadow-slate-200";
  }

  if (position === 3) {
    return "border-orange-300 bg-orange-50 shadow-orange-200";
  }

  return "border-slate-200 bg-white shadow-slate-100";
}

async function getRanking() {
  try {
    const users = await prisma.user.findMany({
      where: {
        totalApprovedCents: {
          gt: 0,
        },
        isBanned: false,
        isTest: false,
      },
      orderBy: {
        totalApprovedCents: "desc",
      },
      take: 50,
    });

    return users;
  } catch (error) {
    console.error("Erro ao carregar ranking:", error);
    return [];
  }
}

export default async function RankingPage() {
  const ranking = await getRanking();

  const topThree = ranking.slice(0, 3);
  const others = ranking.slice(3);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow"
        >
          ← Voltar ao mural
        </Link>

        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">
            Hall da Fama
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Destaques do mural
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Ranking em tempo real baseado nas compras aprovadas.
          </p>
        </section>

        {ranking.length === 0 && (
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow">
            <div className="text-4xl">🏆</div>

            <h2 className="mt-3 text-xl font-black text-slate-950">
              Ainda não temos compradores em destaque
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Assim que a primeira compra for aprovada, o nome público aparecerá aqui.
            </p>
          </section>
        )}

        {topThree.length > 0 && (
          <section className="mt-6 space-y-4">
            {topThree.map((user, index) => {
              const position = index + 1;

              return (
                <article
                  key={user.id}
                  className={`rounded-3xl border-2 p-5 shadow-xl ${getPodiumStyle(
                    position
                  )}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow">
                      {getMedal(position)}
                    </div>

                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {position}º lugar
                      </p>

                      <h2 className="text-xl font-black text-slate-950">
                        {user.publicName || user.name}
                      </h2>

                      <p className="mt-1 text-lg font-black text-slate-700">
                        {money(user.totalApprovedCents)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
            {others.map((user, index) => {
              const position = index + 4;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between border-b border-slate-100 px-4 py-4 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {position}º {user.publicName || user.name}
                    </p>

                    <p className="text-xs font-semibold text-slate-500">
                      Total em tijolinhos
                    </p>
                  </div>

                  <p className="font-black text-slate-800">
                    {money(user.totalApprovedCents)}
                  </p>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}