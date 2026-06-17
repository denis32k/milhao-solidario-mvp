import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, getAdminAccess, money } from "@/lib/admin";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const areas = Object.entries(siteConfig.areas as Record<string, any>);
  return <main className="min-h-screen bg-slate-100 px-4 py-6"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="configuracoes" title="Configurações" description="Visão das configurações operacionais. Coisas críticas do grid ficam travadas e não entram como edição livre." />
    <section className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-5 shadow-xl"><h2 className="text-xl font-black text-red-950">Grid travado</h2><p className="mt-2 text-sm font-bold text-red-800">Não alterar quantidade de blocos, proporção, tamanho, coordenadas, fundo, divisões, bairros ou renderização principal do mural.</p></section>
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Preços por área</h2><div className="mt-4 space-y-3">{areas.map(([key, area]) => <div key={key} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{area.name}</p><p className="text-xs font-bold text-slate-500">{key} • {money(area.priceCents)}</p></div>)}</div></div><div className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Operação</h2><div className="mt-4 space-y-3 text-sm font-bold text-slate-600"><p>Taxa operacional: {siteConfig.operationalFeePercent}%</p><p>Meta interna: {money(siteConfig.goalCents)}</p><p>Logo: {siteConfig.brand.logoUrl || "/logo-mural-29.png"}</p><p>Suporte: {(siteConfig as any).support?.email || "não configurado"}</p></div></div></section>
  </div></main>;
}
