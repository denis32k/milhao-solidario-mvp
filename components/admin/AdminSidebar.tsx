import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

type Item = { key: string; href: string; label: string; icon: string; aliases?: readonly string[] };

const sections: { title: string; items: readonly Item[] }[] = [
  {
    title: "Visão geral",
    items: [
      { key: "dashboard", href: "/admin", label: "Início", icon: "home" },
      { key: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: "orders" },
      { key: "pagamentos", href: "/admin/pagamentos", label: "Pagamentos", icon: "payments" },
      { key: "reservas", href: "/admin/reservas", label: "Reservas", icon: "clock" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { key: "blocos", href: "/admin/blocos", label: "Blocos", icon: "grid" },
      { key: "clientes", href: "/admin/clientes", label: "Clientes", icon: "users" },
      { key: "moderacao", href: "/admin/conteudos", label: "Moderação", icon: "shield", aliases: ["conteudos", "edicoes", "links"] },
      { key: "denuncias", href: "/admin/denuncias", label: "Denúncias", icon: "flag" },
      { key: "suporte", href: "/admin/suporte", label: "Suporte", icon: "help" },
      { key: "financeiro", href: "/admin/financeiro", label: "Financeiro", icon: "wallet" },
    ],
  },
  {
    title: "Operação",
    items: [
      { key: "webhooks", href: "/admin/webhooks", label: "Webhooks", icon: "zap" },
      { key: "logs", href: "/admin/logs", label: "Auditoria", icon: "list" },
      { key: "relatorios", href: "/admin/relatorios", label: "Relatórios", icon: "chart" },
      { key: "configuracoes", href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
    ],
  },
] as const;

const utilityItems = [
  { key: "edicoes", href: "/admin/edicoes", label: "Edições" },
  { key: "links", href: "/admin/links-bloqueados", label: "Links" },
  { key: "usuarios", href: "/admin/usuarios", label: "Usuários" },
  { key: "lgpd", href: "/admin/lgpd", label: "LGPD" },
  { key: "backups", href: "/admin/backups", label: "Backups" },
  { key: "termos", href: "/admin/termos-politicas", label: "Termos" },
  { key: "testes", href: "/admin/testes", label: "Dev" },
] as const;

function isActive(item: { key: string; aliases?: readonly string[] }, active: string) {
  return item.key === active || item.aliases?.includes(active);
}

function AdminIcon({ name }: { name: string }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      {name === "home" && <path {...stroke} d="M3 10.5 12 3l9 7.5M6.75 9.75V20h10.5V9.75" />}
      {name === "orders" && <><rect {...stroke} x="4" y="5" width="16" height="14" rx="2.5" /><path {...stroke} d="M8 9h8M8 13h8M8 17h5" /></>}
      {name === "payments" && <><rect {...stroke} x="4" y="5" width="16" height="14" rx="2.5" /><path {...stroke} d="M4 9h16M8 14h3" /></>}
      {name === "clock" && <><circle {...stroke} cx="12" cy="12" r="8" /><path {...stroke} d="M12 8v4l2.5 2.5" /></>}
      {name === "grid" && <><rect {...stroke} x="4" y="4" width="7" height="7" rx="1.5" /><rect {...stroke} x="13" y="4" width="7" height="7" rx="1.5" /><rect {...stroke} x="4" y="13" width="7" height="7" rx="1.5" /><rect {...stroke} x="13" y="13" width="7" height="7" rx="1.5" /></>}
      {name === "users" && <><path {...stroke} d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" /><circle {...stroke} cx="10" cy="8" r="3" /><path {...stroke} d="M20 19v-1a4 4 0 0 0-3-3.87M15 5.13a3 3 0 0 1 0 5.74" /></>}
      {name === "shield" && <path {...stroke} d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z" />}
      {name === "flag" && <><path {...stroke} d="M5 21V5" /><path {...stroke} d="M5 5c3-2 5 2 8 0s5 2 6 0v8c-1 2-3-2-6 0s-5-2-8 0" /></>}
      {name === "help" && <><circle {...stroke} cx="12" cy="12" r="9" /><path {...stroke} d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-.6.6-1.4 1.1-1.8 1.7-.3.4-.35.75-.35 1.2" /><path {...stroke} d="M12 17h.01" /></>}
      {name === "wallet" && <><path {...stroke} d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 15.5v-7Z" /><path {...stroke} d="M15 12h5" /><circle cx="15.5" cy="12" r="1" fill="currentColor" /></>}
      {name === "zap" && <path {...stroke} d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />}
      {name === "list" && <><path {...stroke} d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></>}
      {name === "chart" && <><path {...stroke} d="M5 19V5" /><path {...stroke} d="M5 19h14" /><path {...stroke} d="m8 15 3-3 2 2 4-5" /></>}
      {name === "settings" && <><circle {...stroke} cx="12" cy="12" r="3" /><path {...stroke} d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.3.7.7.7H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.3Z" /></>}
    </svg>
  );
}

export default function AdminSidebar({ secret, active }: { secret: string; active: string }) {
  return (
    <aside className="admin-sidebar hidden lg:flex">
      <div className="flex h-full flex-col">
        <Link href={withAdminSecret("/admin", secret)} className="admin-brand">
          <span className="admin-brand-logo">
            <img src="/logo-mural-29.png" alt="Mural29" className="h-8 w-auto object-contain" />
          </span>
          <span>
            <strong>Mural29</strong>
            <small>Central administrativa</small>
          </span>
        </Link>

        <div className="admin-sidebar-scroll mt-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="admin-sidebar-label px-3">{section.title}</p>
              <div className="mt-2 space-y-0.5">
                {section.items.map((item) => {
                  const selected = isActive(item, active);
                  return (
                    <Link key={item.key} href={withAdminSecret(item.href, secret)} className={`admin-side-link ${selected ? "is-active" : ""}`}>
                      <span className="admin-side-icon"><AdminIcon name={item.icon} /></span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mb-2 border-t border-slate-200 pt-4">
            <p className="admin-sidebar-label px-3">Mais áreas</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {utilityItems.map((item) => (
                <Link key={item.key} href={withAdminSecret(item.href, secret)} className={`admin-mini-link ${active === item.key ? "is-active" : ""}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-sidebar-note mt-4">
          <span className="admin-sidebar-note-dot" />
          <div>
            <strong>Estrutura travada</strong>
            <p>Grid, fundo e coordenadas seguem protegidos. O painel é para operação, moderação e controle.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
