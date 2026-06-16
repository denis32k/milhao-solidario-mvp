import Link from "next/link";
import GamingPodium from "@/components/ranking/GamingPodium";

export default function RankingPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow"
        >
          ← Voltar ao mapa
        </Link>

        <h1 className="text-3xl font-black text-slate-950">
          Hall da Fama
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Ranking visual dos maiores apoiadores. Depois ligaremos isso ao banco
          e às transações aprovadas pelo PIX.
        </p>

        <div className="mt-6">
          <GamingPodium />
        </div>
      </div>
    </main>
  );
}
