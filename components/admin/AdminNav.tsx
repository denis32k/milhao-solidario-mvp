import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const items = [
  ["dashboard", "/admin", "Visão geral"],
  ["pedidos", "/admin/pedidos", "Pedidos"],
  ["blocos", "/admin/blocos", "Tijolinhos"],
  ["pagamentos", "/admin/pagamentos", "Pagamentos"],
  ["financeiro", "/admin/financeiro", "Financeiro"],
  ["reservas", "/admin/reservas", "Reservas"],
  ["conteudos", "/admin/conteudos", "Fila de revisão"],
  ["edicoes", "/admin/edicoes", "Edições pendentes"],
  ["denuncias", "/admin/denuncias", "Denúncias"],
  ["links", "/admin/links-bloqueados", "Links bloqueados"],
  ["clientes", "/admin/clientes", "Clientes"],
  ["suporte", "/admin/suporte", "Suporte"],
  ["logs", "/admin/logs", "Auditoria"],
  ["relatorios", "/admin/relatorios", "Relatórios"],
  ["lgpd", "/admin/lgpd", "LGPD"],
  ["backups", "/admin/backups", "Backups"],
  ["termos", "/admin/termos-politicas", "Termos e políticas"],
  ["testes", "/admin/testes", "Dev / teste"],
  ["configuracoes", "/admin/configuracoes", "Configurações"],
  ["usuarios", "/admin/usuarios", "Usuários admin"],
] as const;

export default function AdminNav({ secret, active }: { secret: string; active: string }) {
  return (
    <nav className="admin-section-nav mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 text-xs font-black text-slate-700">
        {items.map(([key, href, label]) => (
          <Link
            key={key}
            href={withAdminSecret(href, secret)}
            className={`admin-section-link ${active === key ? "is-active" : ""}`}
          >
            {label}
          </Link>
        ))}
        {!secret && (
          <Link href="/admin/logout" className="admin-section-link danger">Sair</Link>
        )}
      </div>
    </nav>
  );
}
