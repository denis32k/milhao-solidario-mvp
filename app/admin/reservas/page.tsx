import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery, shortId, withAdminSecret } from "@/lib/admin";
import { getAreaName } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function AdminReservasPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const now = new Date();
  const reservations = await safeListQuery(() =>
    (prisma as any).block.findMany({
      where: { status: "RESERVED" },
      orderBy: { reservedUntil: "asc" },
      take: 160,
      include: { owner: true, currentTransaction: { include: { user: true } } },
    })
  );

  const expiredCount = reservations.filter((block: any) => block.reservedUntil && new Date(block.reservedUntil) < now).length;

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="reservas" title="Reservas" description="Reservas ativas, travadas e expiradas em tabela compacta para conferência rápida sem mexer no grid." />

        <section className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-slate-400">Reservas listadas</p><p className="mt-1 text-2xl font-black text-slate-950">{reservations.length}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-red-600">Expiradas</p><p className="mt-1 text-2xl font-black text-red-700">{expiredCount}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-xl"><p className="text-[11px] font-black uppercase text-emerald-600">Ativas</p><p className="mt-1 text-2xl font-black text-emerald-700">{reservations.length - expiredCount}</p></div>
        </section>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Reservas pendentes</h2><span className="text-xs font-bold text-slate-500">{reservations.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Coordenada</th><th className="text-left">Área</th><th className="text-left">Status</th><th className="text-left">Cliente</th><th className="text-left">Expiração</th><th className="text-left">Token</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {reservations.map((block: any) => {
                  const expired = block.reservedUntil && new Date(block.reservedUntil) < now;
                  return (
                    <tr key={block.id}>
                      <td><p className="font-black text-slate-950">x{block.gridX}/y{block.gridY}</p><p className="text-[11px] font-bold text-slate-400">{shortId(block.id)}</p></td>
                      <td className="font-bold text-slate-700">{getAreaName(block.category)}</td>
                      <td><AdminStatusBadge value={expired ? "EXPIRED" : "RESERVED"} /></td>
                      <td><p className="font-bold text-slate-800">{block.owner?.name || block.currentTransaction?.user?.name || "sem dono"}</p><p className="text-[11px] font-bold text-slate-400">{block.owner?.email || block.currentTransaction?.user?.email || ""}</p></td>
                      <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(block.reservedUntil)}</td>
                      <td className="text-[11px] font-bold text-slate-500">{shortId(block.reservationToken)}</td>
                      <td><div className="admin-row-actions"><Link href={`/bloco/${block.id}`} className="admin-row-link">Público</Link>{block.currentTransactionId && <Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(block.currentTransactionId)}`, secret)} className="admin-row-link">Pedido</Link>}</div></td>
                    </tr>
                  );
                })}
                {reservations.length === 0 && <tr><td colSpan={7} className="py-8 text-center font-bold text-slate-500">Nenhuma reserva pendente.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
