import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const items = [
  ["dashboard", "/admin", "Visão geral"],
  ["pedidos", "/admin/pedidos", "Pedidos"],
  ["blocos", "/admin/blocos", "Blocos"],
  ["pagamentos", "/admin/pagamentos", "Pagamentos"],
  ["reservas", "/admin/reservas", "Reservas"],
  ["conteudos", "/admin/conteudos", "Conteúdos"],
  ["denuncias", "/admin/denuncias", "Denúncias"],
  ["clientes", "/admin/clientes", "Clientes"],
  ["financeiro", "/admin/financeiro", "Financeiro"],
  ["suporte", "/admin/suporte", "Suporte"],
  ["logs", "/admin/logs", "Auditoria"],
  ["configuracoes", "/admin/configuracoes", "Configurações"],
] as const;

export default function AdminNav({ secret, active }: { secret: string; active: string }) {
  return (
    <nav className="admin-section-nav mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 text-xs font-semibold text-slate-700">
        {items.map(([key, href, label]) => (
          <Link key={key} href={withAdminSecret(href, secret)} className={`admin-section-link ${active === key ? "is-active" : ""}`}>
            {label}
          </Link>
        ))}
        {!secret && <Link href="/admin/logout" className="admin-section-link danger">Sair</Link>}
      </div>
    </nav>
  );
}
