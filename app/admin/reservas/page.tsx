import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminReservasPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const now = new Date();
  const reservations = await safeListQuery(() => (prisma as any).block.findMany({ where: { status: "RESERVED" }, orderBy: { reservedUntil: "asc" }, take: 120, include: { owner: true, currentTransaction: { include: { user: true } } } }));
  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="reservas" title="Reservas" description="Reservas ativas, travadas e expiradas para limpar sem mexer no grid." />
      <section className="grid gap-3 md:grid-cols-2">
        {reservations.map((block: any) => { const expired = block.reservedUntil && new Date(block.reservedUntil) < now; return <article key={block.id} className={`rounded-3xl p-4 shadow-xl ${expired ? "bg-red-50 border border-red-100" : "bg-white"}`}><p className="text-xs font-black uppercase text-slate-500">x{block.gridX}/y{block.gridY} • {block.category}</p><h2 className="mt-1 text-lg font-black text-slate-950">{expired ? "Reserva expirada" : "Reserva ativa"}</h2><p className="mt-1 text-sm font-bold text-slate-600">Cliente: {block.owner?.name || block.currentTransaction?.user?.name || "sem dono"}</p><p className="mt-1 text-xs font-bold text-slate-500">Expira em: {dateTime(block.reservedUntil)}</p><p className="mt-1 text-xs font-bold text-slate-500">Token: {block.reservationToken || "—"}</p></article>; })}
        {reservations.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhuma reserva pendente.</p>}
      </section>
    </div></main>
  );
}
