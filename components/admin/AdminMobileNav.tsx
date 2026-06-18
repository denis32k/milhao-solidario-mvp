import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const items = [
  ["dashboard", "/admin", "Início"],
  ["pedidos", "/admin/pedidos", "Pedidos"],
  ["pagamentos", "/admin/pagamentos", "Pagamentos"],
  ["reservas", "/admin/reservas", "Reservas"],
  ["blocos", "/admin/blocos", "Blocos"],
  ["moderacao", "/admin/conteudos", "Moderação"],
  ["clientes", "/admin/clientes", "Clientes"],
] as const;

function selected(key: string, active: string) {
  if (key === "moderacao") return ["moderacao", "conteudos", "edicoes", "links"].includes(active);
  return key === active;
}

export default function AdminMobileNav({ secret, active }: { secret: string; active: string }) {
  return (
    <nav className="admin-mobile-nav lg:hidden">
      <div className="flex min-w-max gap-2 px-3 py-2">
        {items.map(([key, href, label]) => (
          <Link key={key} href={withAdminSecret(href, secret)} className={`admin-mobile-link ${selected(key, active) ? "is-active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
