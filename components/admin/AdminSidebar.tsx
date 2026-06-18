import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const primaryItems = [
  { key: "dashboard", href: "/admin", label: "Dashboard", icon: "▦" },
  { key: "blocos", href: "/admin/blocos", label: "Blocos", icon: "▧" },
  { key: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: "▣" },
  { key: "reservas", href: "/admin/reservas", label: "Reservas", icon: "◴" },
  { key: "pagamentos", href: "/admin/pagamentos", label: "Pagamentos", icon: "$" },
  { key: "clientes", href: "/admin/clientes", label: "Clientes", icon: "☻" },
  { key: "moderacao", href: "/admin/conteudos", label: "Moderação", icon: "◆", aliases: ["conteudos", "edicoes", "links"] },
  { key: "denuncias", href: "/admin/denuncias", label: "Denúncias", icon: "!" },
  { key: "webhooks", href: "/admin/webhooks", label: "Webhooks", icon: "↯" },
  { key: "logs", href: "/admin/logs", label: "Logs", icon: "≡" },
  { key: "configuracoes", href: "/admin/configuracoes", label: "Configurações", icon: "⚙" },
] as const;

const secondaryItems = [
  { key: "edicoes", href: "/admin/edicoes", label: "Edições" },
  { key: "links", href: "/admin/links-bloqueados", label: "Links" },
  { key: "financeiro", href: "/admin/financeiro", label: "Financeiro" },
  { key: "suporte", href: "/admin/suporte", label: "Suporte" },
  { key: "relatorios", href: "/admin/relatorios", label: "Relatórios" },
  { key: "usuarios", href: "/admin/usuarios", label: "Usuários" },
  { key: "lgpd", href: "/admin/lgpd", label: "LGPD" },
  { key: "backups", href: "/admin/backups", label: "Backups" },
  { key: "termos", href: "/admin/termos-politicas", label: "Termos" },
  { key: "testes", href: "/admin/testes", label: "Dev" },
] as const;

function isActive(item: { key: string; aliases?: readonly string[] }, active: string) {
  return item.key === active || item.aliases?.includes(active);
}

export default function AdminSidebar({ secret, active }: { secret: string; active: string }) {
  return (
    <aside className="admin-sidebar hidden lg:flex">
      <div className="flex h-full flex-col">
        <Link href={withAdminSecret("/admin", secret)} className="admin-brand">
          <span className="admin-brand-mark">29</span>
          <span>
            <strong>Mural29</strong>
            <small>Backoffice</small>
          </span>
        </Link>

        <div className="mt-5">
          <p className="admin-sidebar-label">Operação</p>
          <div className="mt-2 space-y-1">
          {primaryItems.map((item) => {
            const selected = isActive(item, active);
            return (
              <Link key={item.key} href={withAdminSecret(item.href, secret)} className={`admin-side-link ${selected ? "is-active" : ""}`}>
                <span className="admin-side-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="admin-sidebar-label px-3">Atalhos</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {secondaryItems.map((item) => (
              <Link key={item.key} href={withAdminSecret(item.href, secret)} className={`admin-mini-link ${active === item.key ? "is-active" : ""}`}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="admin-sidebar-note mt-auto">
          <span className="admin-sidebar-note-dot" />
          <div>
            <strong>Grid travado</strong>
            <p>Alterações aqui são só operação, conteúdo e administração.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
