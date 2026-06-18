import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, shortId, muralBlockHref, withAdminSecret } from "@/lib/admin";

export const dynamic = "force-dynamic";

const statusTabs = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Abertas" },
  { value: "REVIEWING", label: "Em análise" },
  { value: "RESOLVED", label: "Resolvidas" },
  { value: "WARNED", label: "Avisadas" },
  { value: "DISMISSED", label: "Ignoradas" },
  { value: "BLOCKED", label: "Bloqueadas" },
  { value: "BANNED", label: "Banidas" },
];

export default async function AdminDenunciasPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/denuncias" />;

  const status = normalizeSearch(params.status) || "ALL";
  const where: any = {};
  if (status !== "ALL") where.status = status;

  const [reports, grouped] = await Promise.all([
    safeListQuery(() => (prisma as any).report.findMany({ where, orderBy: { createdAt: "desc" }, take: 120, include: { block: true, placement: { include: { user: true } } } })),
    safeListQuery(() => (prisma as any).report.groupBy({ by: ["status"], _count: { _all: true } })),
  ]);

  const countByStatus = new Map(grouped.map((item: any) => [item.status, item._count?._all || 0]));
  const tabs = statusTabs.map((tab) => ({ ...tab, count: tab.value === "ALL" ? Array.from(countByStatus.values()).reduce((a: any, b: any) => a + Number(b || 0), 0) : Number(countByStatus.get(tab.value) || 0) }));

  const reportCards = [
    {
      title: "Abertas",
      count: Number(countByStatus.get("OPEN") || 0),
      text: "Denúncias que ainda precisam de triagem.",
      tone: "border-rose-200 bg-rose-50 text-rose-800",
    },
    {
      title: "Em análise",
      count: Number(countByStatus.get("REVIEWING") || 0),
      text: "Casos sendo avaliados pelo admin.",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      title: "Resolvidas",
      count: Number(countByStatus.get("RESOLVED") || 0),
      text: "Casos encerrados sem pendência.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    {
      title: "Bloqueadas/Banidas",
      count: Number(countByStatus.get("BLOCKED") || 0) + Number(countByStatus.get("BANNED") || 0),
      text: "Casos que exigiram ação forte.",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
    },
  ];

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="denuncias" title="Denúncias e segurança" description="Fila pública de denúncias para proteger imagem, link, marcas, golpes e conteúdo ofensivo dentro do mural." />
        <AdminTabs secret={secret} basePath="/admin/denuncias" paramName="status" active={status} tabs={tabs} />

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {reportCards.map((card) => (
            <div key={card.title} className={`rounded-2xl border p-4 ${card.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide">{card.title}</p>
                <strong className="text-xl font-black">{card.count}</strong>
              </div>
              <p className="mt-2 text-xs font-bold leading-relaxed opacity-80">{card.text}</p>
            </div>
          ))}
        </section>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold leading-relaxed text-slate-600 shadow-sm">
          Regra operacional: toda denúncia deve terminar com uma ação clara — resolver, avisar, bloquear ou banir. Evite deixar denúncia aberta sem decisão.
        </div>

        <form className="admin-compact-filter mb-4 md:grid-cols-[220px_100px]">
          <input type="hidden" name="secret" value={secret} />
          <select name="status" defaultValue={status}><option value="ALL">Todas</option><option value="OPEN">Abertas</option><option value="REVIEWING">Em análise</option><option value="RESOLVED">Resolvidas</option><option value="WARNED">Avisadas</option><option value="DISMISSED">Ignoradas</option><option value="BLOCKED">Bloqueadas</option><option value="BANNED">Banidas</option></select>
          <button>Filtrar</button>
        </form>

        <section className="admin-table-card">
          <div className="admin-table-header"><h2>Fila de denúncias</h2><span className="text-xs font-bold text-slate-500">{reports.length} registros</span></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Data</th><th className="text-left">Status</th><th className="text-left">Bloco</th><th className="text-left">Conteúdo</th><th className="text-left">Motivo</th><th className="text-left">Mensagem</th><th className="text-left">Denunciante</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-bold text-slate-600">{dateTime(r.createdAt)}</td>
                    <td><AdminStatusBadge value={r.status} /></td>
                    <td>{r.blockId ? <Link href={muralBlockHref(r.blockId)} className="font-black text-orange-700 underline decoration-orange-200 underline-offset-4 hover:text-orange-900">x{r.block?.gridX ?? "?"}/y{r.block?.gridY ?? "?"}</Link> : <p className="font-black text-slate-950">sem bloco</p>}<p className="text-[11px] font-bold text-slate-400">{shortId(r.blockId)}</p></td>
                    <td><p className="font-black text-slate-800">{r.placement?.title || r.placement?.displayName || "Bloco denunciado"}</p><p className="text-[11px] font-bold text-slate-400">{r.placement?.user?.name || ""}</p></td>
                    <td><p className="font-black text-red-700">{reportReasonLabel(r.reasonCode)}</p><p className="text-[11px] font-bold text-slate-500">{r.reason || "Sem detalhe adicional"}</p></td>
                    <td className="max-w-[260px]"><p className="max-h-10 overflow-hidden font-bold text-slate-700">{r.message || "—"}</p></td>
                    <td><p className="font-bold text-slate-700">{r.reporterEmail || "anônimo"}</p><p className="text-[11px] font-bold text-slate-400">{r.reporterIpHash ? "Origem registrada" : "Origem não registrada"}</p></td>
                    <td><div className="admin-row-actions">{r.blockId && <Link href={muralBlockHref(r.blockId)} className="admin-row-link">Mural</Link>}<Link href={`/bloco/${r.blockId}`} className="admin-row-link">Público</Link>{r.placement?.transactionId && <Link href={withAdminSecret(`/admin/suporte?q=${encodeURIComponent(r.placement.transactionId)}`, secret)} className="admin-row-link">Pedido</Link>}</div></td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={8} className="py-8 text-center font-bold text-slate-500">Nenhuma denúncia encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
