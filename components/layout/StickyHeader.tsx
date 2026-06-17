import HeaderMiniStats from "@/components/layout/HeaderMiniStats";
import { siteConfig } from "@/lib/site-config";
import Link from "next/link";

export default function StickyHeader() {
  return (
    <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex h-full w-full items-center justify-between gap-2 px-2 sm:px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1 active:scale-95">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg shadow-sm">
            {siteConfig.brand.logoEmoji}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-black leading-none text-slate-950">{siteConfig.brand.name}</span>
            <span className="mt-0.5 block truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{siteConfig.brand.subtitle}</span>
          </span>
        </Link>

        <HeaderMiniStats />

        <details className="relative shrink-0">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-slate-100 text-lg shadow-sm">☰</summary>
          <nav className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-orange-600">Tijolinho Digital</p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">Compre seu tijolinho digital e ajude a construir um dos murais mais ambiciosos da internet.</p>
            </div>
            <a className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/#mural">🧱 Comprar meu tijolinho</a>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/ranking">🏆 Destaques</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/transparencia">📊 Transparência</Link>
            <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/termos">📜 Termos de Uso</Link>
            <Link className="block px-5 py-4 text-sm font-black" href="/privacidade">🔒 Privacidade</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
