import HeaderMiniStats from "@/components/layout/HeaderMiniStats";
import { siteConfig } from "@/lib/site-config";
import Link from "next/link";

type RankingItem = {
  id: string;
  publicName: string;
  totalApprovedCents: number;
};

type StickyHeaderProps = {
  ranking?: RankingItem[];
  active?: "mural" | "comprar";
};

export default function StickyHeader({ ranking = [], active = "mural" }: StickyHeaderProps) {
  const isPurchase = active === "comprar";

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-slate-200/80 bg-white/96 shadow-sm backdrop-blur">
      <div className="border-b border-slate-100">
        <div className="flex min-h-[108px] items-center gap-3 px-3 py-3 sm:px-4 lg:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50"
            aria-label="Abrir mural oficial"
          >
            <img
              src={siteConfig.brand.logoUrl || "/logo-mural-29.png"}
              alt={siteConfig.brand.name}
              className="h-9 w-auto max-w-[132px] object-contain sm:h-10 sm:max-w-[178px]"
            />
          </Link>

          <HeaderMiniStats ranking={ranking} />

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <Link
              href="/"
              className={`inline-flex h-10 items-center rounded-full border px-4 text-xs font-black transition ${!isPurchase ? "border-slate-950 bg-slate-950 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              Mural oficial
            </Link>
            <Link
              href="/recuperar-link"
              className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Área do Cliente
            </Link>
          </div>

          <details className="relative shrink-0">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-800 shadow-sm transition hover:bg-slate-50">☰</summary>
            <nav className="absolute right-0 mt-3 w-[19rem] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-wide text-orange-600">Mural29</p>
                <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                  Explore o mural oficial, entre no modo de compra quando quiser reservar um espaço e acompanhe suas compras pela Área do Cliente.
                </p>
              </div>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/">🏛️ Mural oficial</Link>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-orange-700" href="/comprar">🧱 Compre seu tijolinho</Link>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/recuperar-link">👤 Área do Cliente</Link>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/ranking">🏆 Destaques</Link>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/transparencia">📊 Transparência</Link>
              <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/termos">📜 Termos de Uso</Link>
              <Link className="block px-5 py-4 text-sm font-black" href="/privacidade">🔒 Privacidade</Link>
              <Link className="block border-t border-slate-100 px-5 py-4 text-sm font-black text-slate-500" href="/admin">🛠️ Admin</Link>
            </nav>
          </details>
        </div>
      </div>

      <Link
        href="/comprar"
        className={`flex h-11 w-full items-center justify-center px-4 text-center text-sm font-black tracking-wide text-white transition ${isPurchase ? "bg-gradient-to-r from-orange-500 to-amber-500" : "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-105"}`}
      >
        <span className="truncate">🧱 Compre seu tijolinho</span>
      </Link>
    </header>
  );
}
