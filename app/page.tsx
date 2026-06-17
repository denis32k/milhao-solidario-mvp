import AreaCards from "@/components/home/AreaCards";
import ProjectHero from "@/components/home/ProjectHero";
import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <StickyHeader />
      <ProjectHero />
      <AreaCards />

      <section id="mural" className="bg-slate-950 px-3 py-6 sm:px-4 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Mural interativo</p>
              <h2 className="mt-2 text-3xl font-black text-white">A obra digital, tijolinho por tijolinho.</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-300">
                Arraste, aproxime e toque nos tijolinhos disponíveis para escolher seu espaço. No celular, use dois dedos para dar zoom.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-bold text-slate-200">
              Copacabana • Jardins • Leblon
            </div>
          </div>

          <div className="h-[72vh] min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl">
            <PixelMap />
          </div>

          <p className="mt-4 text-center text-xs font-semibold leading-relaxed text-slate-400">
            {siteConfig.copy.legalNotice}
          </p>
        </div>
      </section>
    </main>
  );
}
