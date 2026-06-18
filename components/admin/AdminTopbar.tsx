import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminTopbar({ secret, title }: { secret: string; title: string }) {
  return (
    <header className="admin-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={withAdminSecret("/admin", secret)} className="flex shrink-0 items-center gap-2 lg:hidden">
          <img src="/logo-mural-29.png" alt="Mural29" className="h-7 w-auto object-contain" />
        </Link>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[11px] font-semibold text-slate-400">Painel administrativo</p>
          <h2 className="truncate text-[15px] font-semibold text-slate-950">{title}</h2>
        </div>
      </div>

      <form action="/admin/suporte" className="admin-top-search">
        {secret && <input type="hidden" name="secret" value={secret} />}
        <span className="admin-top-search-icon"><SearchIcon /></span>
        <input name="q" placeholder="Buscar pedido, cliente, WhatsApp ou coordenada" />
        <button>Buscar</button>
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <Link href="/" className="admin-top-action hidden sm:inline-flex">Ver mural</Link>
        <Link href={withAdminSecret("/admin/suporte", secret)} className="admin-top-action hidden md:inline-flex">Suporte</Link>
        <span className="admin-top-user hidden lg:inline-flex">Administrador</span>
        {!secret && <Link href="/admin/logout" className="admin-top-action danger">Sair</Link>}
        {secret && <span className="admin-top-badge">Secret</span>}
      </div>
    </header>
  );
}
