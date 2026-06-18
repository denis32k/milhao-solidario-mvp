import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, getAdminAccess, money, safeListQuery, safeValueQuery, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminRelatoriosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const [approvedTotal, byArea, exportLogs] = await Promise.all([
    safeValueQuery(() => (prisma as any).transaction.aggregate({ where: { status: "APPROVED", isTest: false }, _sum: { totalPaidCents: true }, _count: true }), { _sum: { totalPaidCents: 0 }, _count: 0 } as any),
    safeListQuery(() => (prisma as any).transaction.findMany({ where: { status: "APPROVED", isTest: false }, select: { kind: true, totalPaidCents: true, items: { select: { blockId: true } } }, take: 5000 })),
    safeListQuery(() => (prisma as any).exportLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { requestedByAdmin: true } })),
  ]);

  const areaStats = Object.values(byArea.reduce((acc: Record<string, any>, tx: any) => { const key = tx.kind || "AREA"; if (!acc[key]) acc[key] = { area: key, total: 0, pedidos: 0, blocos: 0 }; acc[key].total += Number(tx.totalPaidCents || 0); acc[key].pedidos += 1; acc[key].blocos += tx.items?.length || 0; return acc; }, {}));
  const exportTypes = ["orders", "payments", "clients", "blocks", "logs", "webhooks", "consents"];

  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="relatorios" title="Relatórios e exportação" description="Exportações CSV para conferência, contador, auditoria e controle interno." />
    <section className="mb-6 grid gap-3 md:grid-cols-3"><div className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">Total aprovado</p><h2 className="mt-1 text-2xl font-black text-slate-950">{money(approvedTotal._sum?.totalPaidCents || 0)}</h2></div><div className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">Pedidos aprovados</p><h2 className="mt-1 text-2xl font-black text-slate-950">{approvedTotal._count || 0}</h2></div><div className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">Exportações recentes</p><h2 className="mt-1 text-2xl font-black text-slate-950">{exportLogs.length}</h2></div></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Exportar CSV</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{exportTypes.map((type) => <a key={type} href={withAdminSecret(`/api/admin/export?type=${type}`, secret)} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-xs font-black uppercase text-white">Baixar {type}</a>)}</div></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Vendas por área</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{areaStats.map((a: any) => <div key={a.area} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black text-slate-950">{a.area}</p><p className="mt-1 text-xs font-bold text-slate-500">{a.pedidos} pedido(s) • {a.blocos} bloco(s) • {money(a.total)}</p></div>)}</div></section>
    <section className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Últimos exports</h2><div className="mt-4 space-y-2">{exportLogs.map((log: any) => <article key={log.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{log.type} • {log.format} • {new Date(log.createdAt).toLocaleString("pt-BR")}</p></article>)}{exportLogs.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma exportação registrada.</p>}</div></section>
  </div></main>;
}
