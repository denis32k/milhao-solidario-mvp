import Link from "next/link";
export default function StickyHeader(){
 return <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
  <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-3">
   <Link href="/ranking" className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-400 text-xl shadow-md">🏆</Link>
   <Link href="/" className="text-center"><div className="flex items-center gap-1"><span>💚</span><h1 className="text-base font-black leading-none text-slate-950">Milhão Solidário</h1></div><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Doe, apareça e ajude</p></Link>
   <details className="relative"><summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-slate-100 text-xl shadow-md">☰</summary>
    <nav className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
     <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/">🧩 Mosaico Solidário</Link>
     <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/ranking">🏆 Hall da Fama</Link>
     <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/checkout">💳 Checkout teste</Link>
     <Link className="block border-b border-slate-100 px-5 py-4 text-sm font-black" href="/transparencia">📊 Transparência</Link>
     <Link className="block px-5 py-4 text-sm font-black" href="/termos">📜 Termos de Uso</Link>
    </nav>
   </details>
  </div>
 </header>
}
