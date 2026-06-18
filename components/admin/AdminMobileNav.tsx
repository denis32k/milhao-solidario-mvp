import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const items = [
  ["dashboard", "/admin", "Dashboard"],
  ["blocos", "/admin/blocos", "Blocos"],
  ["pedidos", "/admin/pedidos", "Pedidos"],
  ["reservas", "/admin/reservas", "Reservas"],
  ["pagamentos", "/admin/pagamentos", "Pagamentos"],
  ["clientes", "/admin/clientes", "Clientes"],
  ["moderacao", "/admin/conteudos", "Moderação"],
  ["denuncias", "/admin/denuncias", "Denúncias"],
  ["webhooks", "/admin/webhooks", "Webhooks"],
  ["logs", "/admin/logs", "Logs"],
  ["configuracoes", "/admin/configuracoes", "Config."],
] as const;

function selected(key: string, active: string) {
  if (key === "moderacao") return ["moderacao", "conteudos", "edicoes", "links"].includes(active);
  return key === active;
}

export default function AdminMobileNav({ secret, active }: { secret: string; active: string }) {
  return (
    <nav className="admin-mobile-nav lg:hidden">
      <div className="flex min-w-max gap-2 px-3">
        {items.map(([key, href, label]) => (
          <Link key={key} href={withAdminSecret(href, secret)} className={`admin-mobile-link ${selected(key, active) ? "is-active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
