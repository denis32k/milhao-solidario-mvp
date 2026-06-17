import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

const items = [
  ["dashboard", "/admin", "Dashboard"],
  ["pedidos", "/admin/pedidos", "Pedidos"],
  ["blocos", "/admin/blocos", "Blocos"],
  ["pagamentos", "/admin/pagamentos", "Pagamentos"],
  ["reservas", "/admin/reservas", "Reservas"],
  ["conteudos", "/admin/conteudos", "Conteúdos"],
  ["edicoes", "/admin/edicoes", "Edições"],
  ["denuncias", "/admin/denuncias", "Denúncias"],
  ["clientes", "/admin/clientes", "Clientes"],
  ["logs", "/admin/logs", "Logs"],
  ["testes", "/admin/testes", "Testes"],
  ["configuracoes", "/admin/configuracoes", "Configurações"],
] as const;

export default function AdminNav({ secret, active }: { secret: string; active: string }) {
  return (
    <nav className="mb-6 overflow-x-auto rounded-3xl bg-white p-3 shadow-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 text-xs font-black text-slate-700">
        {items.map(([key, href, label]) => (
          <Link
            key={key}
            href={withAdminSecret(href, secret)}
            className={`rounded-full px-4 py-2 ${active === key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
