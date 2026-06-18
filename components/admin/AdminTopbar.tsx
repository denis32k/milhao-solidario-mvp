import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

export default function AdminTopbar({ secret, title }: { secret: string; title: string }) {
  return (
    <header className="admin-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={withAdminSecret("/admin", secret)} className="flex shrink-0 items-center gap-2 lg:hidden">
          <span className="admin-brand-mark !h-8 !w-8 !text-[11px]">29</span>
          <span className="text-sm font-black text-slate-950">Mural29</span>
        </Link>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Backoffice</p>
          <h2 className="truncate text-[15px] font-black text-slate-950">{title}</h2>
        </div>
      </div>

      <form action="/admin/suporte" className="admin-top-search">
        {secret && <input type="hidden" name="secret" value={secret} />}
        <input name="q" placeholder="Buscar pedido, cliente, WhatsApp, coordenada..." />
        <button>Buscar</button>
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <Link href="/" className="admin-top-action hidden sm:inline-flex">Ver mural</Link>
        <Link href={withAdminSecret("/admin/suporte", secret)} className="admin-top-action hidden md:inline-flex">Suporte</Link>
        {!secret && <Link href="/admin/logout" className="admin-top-action danger">Sair</Link>}
        {secret && <span className="admin-top-badge">Secret</span>}
        {!secret && <span className="admin-top-badge">Admin</span>}
      </div>
    </header>
  );
}
