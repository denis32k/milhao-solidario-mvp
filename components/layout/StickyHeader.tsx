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
    <header className="fixed left-0 top-0 z-50 h-[112px] w-full border-b border-slate-200/80 bg-white/96 shadow-sm backdrop-blur">
      <div className="flex h-full w-full items-center justify-between gap-2 px-2 sm:px-4">
        <Link href="/" className="flex min-w-0 items-center rounded-full px-1 py-1 active:scale-95 sm:px-2" aria-label="Abrir mural oficial">
          <img
            src={siteConfig.brand.logoUrl || "/logo-mural-29.png"}
            alt={siteConfig.brand.name}
            className="h-9 w-auto max-w-[132px] object-contain sm:h-10 sm:max-w-[178px]"
          />
        </Link>

        <HeaderMiniStats ranking={ranking} />

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href="/"
            className={`inline-flex h-10 items-center rounded-full px-4 text-xs font-black transition ${!isPurchase ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
          >
            Mural oficial
          </Link>
          <Link
            href="/comprar"
            className={`inline-flex h-10 items-center rounded-full px-4 text-xs font-black transition ${isPurchase ? "bg-emerald-600 text-white shadow-sm" : "bg-orange-500 text-white shadow-sm hover:bg-orange-600"}`}
          >
            Compre seu tijolinho
          </Link>
          <Link href="/recuperar-link" className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-50">
            Área do Cliente
          </Link>
        </div>

        <details className="relative shrink-0">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-slate-100 text-lg shadow-sm">☰</summary>
          <nav className="absolute right-0 mt-3 w-[19rem] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-orange-600">Mural29</p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                O mural oficial é para explorar. A página de compra é para escolher seu espaço com calma.
              </p>
            </div>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/">🏛️ Mural oficial</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-emerald-700" href="/comprar">🧱 Compre seu tijolinho</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/recuperar-link">👤 Área do Cliente</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/ranking">🏆 Destaques</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/transparencia">📊 Transparência</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/termos">📜 Termos de Uso</Link>
            <Link className="block px-5 py-4 text-sm font-black" href="/privacidade">🔒 Privacidade</Link>
            <Link className="block border-t border-slate-100 px-5 py-4 text-sm font-black text-slate-500" href="/admin">🛠️ Admin</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
