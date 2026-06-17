import ConstructionProgress from "@/components/home/ConstructionProgress";
import { siteConfig } from "@/lib/site-config";

export default function ProjectHero() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#fed7aa,transparent_32%),linear-gradient(135deg,#fff7ed,#f8fafc_45%,#fef3c7)] px-4 pb-10 pt-24">
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,#0f172a_1px,transparent_1px),linear-gradient(#0f172a_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-700 shadow-sm">
            <span>{siteConfig.brand.logoEmoji}</span>
            obra digital em construção
          </div>
          <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {siteConfig.copy.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
            {siteConfig.copy.heroSubtitle}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#mural" className="rounded-2xl bg-slate-950 px-6 py-4 text-center text-sm font-black text-white shadow-xl active:scale-95">
              {siteConfig.copy.primaryCta}
            </a>
            <a href="#areas" className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-sm font-black text-slate-950 shadow-lg active:scale-95">
              {siteConfig.copy.secondaryCta}
            </a>
          </div>
          <p className="mt-5 text-sm font-bold text-slate-500">
            O mural começa vazio. A história começa com quem entra primeiro.
          </p>
        </div>
        <ConstructionProgress />
      </div>
    </section>
  );
}
