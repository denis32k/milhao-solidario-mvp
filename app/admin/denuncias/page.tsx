import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminDenunciasPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const status = normalizeSearch(params.status);
  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  const reports = await safeListQuery(() => (prisma as any).report.findMany({ where, orderBy: { createdAt: "desc" }, take: 80, include: { block: true, placement: { include: { user: true } } } }));
  return <main className="min-h-screen bg-slate-100 px-4 py-6"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="denuncias" title="Denúncias" description="Fila pública de denúncias para imagem, link, golpe, marca indevida ou conteúdo ofensivo." />
    <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-xl sm:grid-cols-[1fr_120px]"><input type="hidden" name="secret" value={secret}/><select name="status" defaultValue={status || "ALL"} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ALL">Todas</option><option value="OPEN">Abertas</option><option value="REVIEWING">Em análise</option><option value="RESOLVED">Resolvidas</option><option value="DISMISSED">Ignoradas</option><option value="BLOCKED">Bloqueadas</option><option value="BANNED">Banidas</option></select><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Filtrar</button></form>
    <section className="space-y-3">{reports.map((r: any) => <article key={r.id} className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-slate-500">{r.status} • x{r.block?.gridX ?? "?"}/y{r.block?.gridY ?? "?"} • {dateTime(r.createdAt)}</p><h2 className="mt-1 text-xl font-black text-slate-950">{r.placement?.title || r.placement?.displayName || "Bloco denunciado"}</h2><p className="mt-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-900">{r.reasonCode ? `${r.reasonCode} — ` : ""}{r.reason}</p>{r.message && <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">Mensagem: {r.message}</p>}<p className="mt-2 text-xs font-bold text-slate-500">Denunciante: {r.reporterEmail || "anônimo"} • IP hash: {r.reporterIpHash ? "registrado" : "não registrado"}</p></article>)}{reports.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhuma denúncia encontrada.</p>}</section>
  </div></main>;
}
