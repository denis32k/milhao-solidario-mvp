import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

type Item = { key: string; href: string; label: string; icon: string; aliases?: readonly string[] };

const sections: { title: string; items: readonly Item[] }[] = [
  {
    title: "Visão geral",
    items: [
      { key: "dashboard", href: "/admin", label: "Início", icon: "⌂" },
      { key: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: "◫" },
      { key: "pagamentos", href: "/admin/pagamentos", label: "Pagamentos", icon: "$" },
      { key: "reservas", href: "/admin/reservas", label: "Reservas", icon: "◔" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { key: "blocos", href: "/admin/blocos", label: "Blocos", icon: "▦" },
      { key: "clientes", href: "/admin/clientes", label: "Clientes", icon: "☺" },
      { key: "moderacao", href: "/admin/conteudos", label: "Moderação", icon: "◇", aliases: ["conteudos", "edicoes", "links"] },
      { key: "denuncias", href: "/admin/denuncias", label: "Denúncias", icon: "!" },
      { key: "suporte", href: "/admin/suporte", label: "Suporte", icon: "?" },
      { key: "financeiro", href: "/admin/financeiro", label: "Financeiro", icon: "₿" },
    ],
  },
  {
    title: "Operação",
    items: [
      { key: "webhooks", href: "/admin/webhooks", label: "Webhooks", icon: "↯" },
      { key: "logs", href: "/admin/logs", label: "Auditoria", icon: "≣" },
      { key: "relatorios", href: "/admin/relatorios", label: "Relatórios", icon: "↗" },
      { key: "configuracoes", href: "/admin/configuracoes", label: "Configurações", icon: "⚙" },
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

export default function AdminSidebar({ secret, active }: { secret: string; active: string }) {
  return (
    <aside className="admin-sidebar hidden lg:flex">
      <div className="flex h-full flex-col">
        <Link href={withAdminSecret("/admin", secret)} className="admin-brand">
          <span className="admin-brand-mark">29</span>
          <span>
            <strong>Mural29</strong>
            <small>Central administrativa</small>
          </span>
        </Link>

        <div className="admin-sidebar-scroll mt-6">
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="admin-sidebar-label px-3">{section.title}</p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
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

        <div className="admin-sidebar-note mt-5">
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
