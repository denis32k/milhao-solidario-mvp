import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, money, normalizeSearch, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const q = normalizeSearch(params.q);
  const where: any = { role: "USER" };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { publicName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { whatsapp: { contains: q, mode: "insensitive" } }];
  const users = await safeListQuery(() => (prisma as any).user.findMany({ where, orderBy: { createdAt: "desc" }, take: 80, include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 }, placements: { take: 5 } } }));
  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="clientes" title="Clientes" description="Busca de clientes por nome, nome público, e-mail e WhatsApp, sem expor dados privados no mural público." />
    <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_120px]"><input type="hidden" name="secret" value={secret}/><input name="q" defaultValue={q} placeholder="Buscar cliente" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Buscar</button></form>
    <section className="grid gap-3 md:grid-cols-2">{users.map((u: any) => <article key={u.id} className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">{u.isBanned ? "banido" : "ativo"} • {dateTime(u.createdAt)}</p><h2 className="mt-1 text-xl font-black text-slate-950">{u.name}</h2><p className="mt-1 text-sm font-bold text-slate-600">Público: {u.publicName || "—"}</p><p className="mt-1 text-xs font-bold text-slate-500">{u.email || "sem e-mail"} • {u.whatsapp || "sem WhatsApp"}</p><p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-700">Total aprovado: {money(u.totalApprovedCents)} • {u.transactions?.length || 0} pedido(s) recentes • {u.placements?.length || 0} conteúdo(s)</p></article>)}{users.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum cliente encontrado.</p>}</section>
  </div></main>;
}
