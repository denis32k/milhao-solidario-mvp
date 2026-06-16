import Link from "next/link";

export default function StickyHeader() {
  return (
    <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-3">
        <Link
          href="/ranking"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-400 text-xl shadow-md active:scale-95"
          aria-label="Ranking"
        >
          🏆
        </Link>

        <Link href="/" className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1">
            <span className="text-lg">💚</span>
            <h1 className="text-base font-black leading-none text-slate-950">
              Milhão Solidário
            </h1>
          </div>

          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            Doe, apareça e ajude
          </p>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-lg text-white shadow-md active:scale-95"
            aria-label="Painel admin"
          >
            👤
          </Link>

          <details className="relative">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-slate-100 text-xl shadow-md active:scale-95">
              ☰
            </summary>

            <nav className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <Link
                className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/"
              >
                🧩 Mosaico Solidário R$ 10
              </Link>

              <Link
                className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/ranking"
              >
                🏆 Hall da Fama
              </Link>

              <Link
                className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/checkout"
              >
                💳 Checkout teste
              </Link>

              <Link
                className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/transparencia"
              >
                📊 Transparência
              </Link>

              <Link
                className="block border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/termos"
              >
                📜 Termos de Uso
              </Link>

              <Link
                className="block px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-50"
                href="/admin"
              >
                🔐 Painel Admin
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}