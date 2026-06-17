import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminBlocosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;

  const status = normalizeSearch(params.status);
  const area = normalizeSearch(params.area);
  const x = normalizeSearch(params.x);
  const y = normalizeSearch(params.y);
  const where: any = { gridX: { lt: 232 }, gridY: { lt: 125 } };
  if (status && status !== "ALL") where.status = status;
  else where.status = { in: ["SOLD", "RESERVED", "LOCKED", "BLOCKED"] };
  if (area && area !== "ALL") where.category = area;
  if (x) where.gridX = Number(x);
  if (y) where.gridY = Number(y);

  const blocks = await safeListQuery(() =>
    (prisma as any).block.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { gridY: "asc" }, { gridX: "asc" }],
      take: 150,
      include: {
        owner: true,
        placement: true,
        currentTransaction: { include: { user: true } },
      },
    })
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="blocos" title="Blocos" description="Administração de blocos sem alterar estrutura, coordenadas, tamanho ou posição do grid." />
        <div className="mb-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-bold text-yellow-900 shadow">
          Regra fixa: coordenada de bloco vendido é histórico. O admin pode revisar, ocultar ou bloquear conteúdo, mas não remanejar estrutura nem arrastar cliente para outro bloco.
        </div>

        <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-5">
          <input type="hidden" name="secret" value={secret} />
          <select name="status" defaultValue={status || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Status relevantes</option><option value="AVAILABLE">Disponível</option><option value="RESERVED">Reservado</option><option value="SOLD">Vendido</option><option value="LOCKED">Travado</option><option value="BLOCKED">Bloqueado</option></select>
          <select name="area" defaultValue={area || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Todas áreas</option><option value="SOLIDARITY">Copacabana</option><option value="GOLD">Leblon</option><option value="PREMIUM">Ipanema</option><option value="GRAND_CENTER">Tom Delfim</option></select>
          <input name="x" defaultValue={x} placeholder="X" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          <input name="y" defaultValue={y} placeholder="Y" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button>
        </form>

        <section className="grid gap-3 md:grid-cols-2">
          {blocks.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum bloco encontrado.</p>}
          {blocks.map((block: any) => (
            <article key={block.id} className="rounded-3xl bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">x{block.gridX}/y{block.gridY} • {block.category}</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">{block.status}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">Dono: {block.owner?.publicName || block.owner?.name || "sem dono"}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">Pedido: {shortId(block.currentTransactionId)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-700">{block.available ? "disponível" : "ocupado"}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
                Conteúdo: {block.placement?.title || block.placement?.displayName || "sem conteúdo"} • {block.placement?.reviewStatus || "sem revisão"}
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-400">Atualizado: {dateTime(block.updatedAt)}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
