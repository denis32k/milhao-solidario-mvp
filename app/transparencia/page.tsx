import Link from "next/link";
import { formatMoney, siteConfig } from "@/lib/site-config";

export default function TransparenciaPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>

        <p className="text-xs font-black uppercase tracking-wide text-orange-600">Transparência comercial</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Transparência do mural</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          O mural é construído a partir da venda de tijolinhos digitais. Esta página organiza informações de preço, disponibilidade e evolução da obra digital.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase text-slate-700">{siteConfig.areas.SOLIDARITY.name}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{formatMoney(siteConfig.areas.SOLIDARITY.priceCents)}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">Área de entrada com cor, nome público, descrição curta e link opcional.</p>
          </div>
          <div className="rounded-3xl bg-emerald-50 p-5">
            <p className="text-xs font-black uppercase text-emerald-700">{siteConfig.areas.PREMIUM.name}</p>
            <p className="mt-2 text-3xl font-black text-emerald-900">{formatMoney(siteConfig.areas.PREMIUM.priceCents)}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-emerald-700">Área premium com imagem no mural, descrição e link.</p>
          </div>
          <div className="rounded-3xl bg-yellow-50 p-5">
            <p className="text-xs font-black uppercase text-yellow-700">{siteConfig.areas.GOLD.name}</p>
            <p className="mt-2 text-3xl font-black text-yellow-900">{formatMoney(siteConfig.areas.GOLD.priceCents)}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-yellow-700">Área mais exclusiva, próxima ao centro reservado.</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">Áreas restritas</p>
          <h2 className="mt-2 text-2xl font-black text-orange-900">Placas bloqueadas nesta fase</h2>
          <p className="mt-3 text-sm leading-relaxed text-orange-900/80">
            As placas com os nomes dos bairros não estão à venda neste momento. Esses espaços exibem cadeado e a mensagem de liberação futura no próprio mural.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Fases da Obra</p>
          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
            {siteConfig.constructionPhases.map((phase) => (
              <p key={phase}>🧱 {phase}</p>
            ))}
          </div>
        </div>

        <p className="mt-6 rounded-3xl bg-slate-950 p-4 text-xs font-bold leading-relaxed text-slate-300">
          {siteConfig.copy.legalNotice}
        </p>
      </div>
    </main>
  );
}
