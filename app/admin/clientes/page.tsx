import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const q = normalizeSearch(params.q);
  const status = normalizeSearch(params.status) || "ALL";
  const where: any = {};
  if (status === "BANNED") where.isBanned = true;
  if (status === "ACTIVE") where.isBanned = false;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { publicName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { whatsapp: { contains: q, mode: "insensitive" } }];

  const users = await safeListQuery(() =>
    (prisma as any).user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 140,
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 3 }, placements: { take: 3 } },
    })
  );

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="clientes" title="Clientes" description="Consulta compacta de clientes, contatos, compras recentes e conteúdo publicado." />

        <form className="admin-compact-filter mb-4 md:grid-cols-[1fr_150px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <input name="q" defaultValue={q} placeholder="Buscar nome, nome público, e-mail ou WhatsApp" />
          <select name="status" defaultValue={status}><option value="ALL">Todos</option><option value="ACTIVE">Ativos</option><option value="BANNED">Banidos</option></select>
          <button>Buscar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Clientes encontrados</h2><span className="text-xs font-bold text-slate-500">{users.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Cliente</th><th className="text-left">Contato</th><th className="text-left">Status</th><th className="text-left">Total aprovado</th><th className="text-left">Pedidos recentes</th><th className="text-left">Conteúdos</th><th className="text-left">Cadastro</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id}>
                    <td><p className="font-black text-slate-950">{user.name || "Sem nome"}</p><p className="text-[11px] font-bold text-slate-400">Público: {user.publicName || "—"}</p></td>
                    <td><p className="font-bold text-slate-700">{user.email || "sem e-mail"}</p><p className="text-[11px] font-bold text-slate-400">{user.whatsapp || "sem WhatsApp"}</p></td>
                    <td><AdminStatusBadge value={user.isBanned ? "BANNED" : "ACTIVE"} /></td>
                    <td className="font-black text-slate-950">{money(user.totalApprovedCents || 0)}</td>
                    <td className="font-bold text-slate-700">{user.transactions?.length || 0}</td>
                    <td className="font-bold text-slate-700">{user.placements?.length || 0}</td>
                    <td className="whitespace-nowrap text-[11px] font-bold text-slate-500">{dateTime(user.createdAt)}</td>
                    <td><div className="admin-row-actions"><Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(user.email || user.whatsapp || user.name || user.id)}`, secret)} className="admin-row-link">Suporte</Link><Link href={withAdminSecret(`/admin/pedidos?q=${encodeURIComponent(user.email || user.id)}`, secret)} className="admin-row-link">Pedidos</Link></div></td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhum cliente encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
