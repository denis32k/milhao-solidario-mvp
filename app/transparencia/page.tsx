import Link from "next/link";
import { formatMoney, siteConfig } from "@/lib/site-config";

const cardThemes = [
  "bg-slate-50 text-slate-900",
  "bg-emerald-50 text-emerald-950",
  "bg-yellow-50 text-yellow-950",
  "bg-fuchsia-50 text-fuchsia-950",
];

export default function TransparenciaPage() {
  const entries = Object.entries(siteConfig.areas);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>

        <p className="text-xs font-black uppercase tracking-wide text-orange-600">Transparência comercial</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Transparência do Mural 29</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          O Mural 29 é um projeto comercial de venda de espaços digitais. Aqui estão os preços atuais, as áreas disponíveis e as fases da obra digital conforme a estrutura que está valendo hoje no site.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {entries.map(([key, area], index) => (
            <div key={key} className={`rounded-3xl p-5 ${cardThemes[index % cardThemes.length]}`}>
              <p className="text-xs font-black uppercase opacity-70">{area.name}</p>
              <p className="mt-2 text-3xl font-black">{formatMoney(area.priceCents)}</p>
              <p className="mt-3 text-sm font-semibold leading-relaxed opacity-80">{area.description}</p>
              <p className="mt-2 text-xs font-bold opacity-70">{area.included}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Resumo atual</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-relaxed text-slate-700">
              <strong className="text-slate-950">Copacabana</strong> é a entrada, <strong className="text-slate-950">Ipanema</strong> oferece mais destaque, <strong className="text-slate-950">Leblon</strong> é a área exclusiva e <strong className="text-slate-950">Tom Delfim Moreira</strong> é a área nobre no edifício acima da placa do Leblon.
            </p>
            <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-relaxed text-slate-700">
              O cliente compra direito de exibição conforme as regras do site. As coordenadas vendidas viram histórico fixo e não devem ser remanejadas livremente.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Fases da obra</p>
          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
            {siteConfig.constructionPhases.map((phase) => <p key={phase}>🧱 {phase}</p>)}
          </div>
        </div>

        <p className="mt-6 rounded-3xl bg-slate-950 p-4 text-xs font-bold leading-relaxed text-slate-300">
          {siteConfig.copy.legalNotice}
        </p>
      </div>
    </main>
  );
}
