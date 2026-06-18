import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery, shortId, muralBlockHref, withAdminSecret } from "@/lib/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminTestesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/testes" />;
  const tests = await safeListQuery(() => (prisma as any).placement.findMany({ where: { isTest: true }, orderBy: { createdAt: "desc" }, take: 80, include: { user: true, transaction: true, blocks: { take: 8 } } }));
  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="testes" title="Área de testes" description="Dados de teste/dev isolados de venda real. Teste não deve entrar no ranking nem no mapa público." />
    <div className="mb-5 rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-xl"><h2 className="text-xl font-black text-purple-950">Criar ou limpar testes</h2><p className="mt-2 text-sm font-bold text-purple-800">Os formulários completos de gerar área teste continuam no dashboard principal para evitar duplicação de ação sensível.</p><Link href={withAdminSecret("/admin#testes", secret)} className="mt-4 inline-flex rounded-2xl bg-purple-700 px-4 py-3 text-xs font-black text-white">Abrir controles de teste</Link></div>
    <section className="grid gap-3 md:grid-cols-2">{tests.map((t: any) => <article key={t.id} className="rounded-3xl bg-white p-5 shadow-xl"><p className="text-xs font-black uppercase text-purple-700">TESTE / DEV • {t.kind}</p><h2 className="mt-1 text-xl font-black text-slate-950">{t.title || t.displayName || "Teste"}</h2><p className="mt-1 text-xs font-bold text-slate-500">Criado: {dateTime(t.createdAt)} • Pedido: {shortId(t.transactionId)}</p><div className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">Blocos: <span className="inline-flex flex-wrap gap-1">{(t.blocks || []).length ? (t.blocks || []).map((b: any) => <Link key={b.id} href={muralBlockHref(b.id)} className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">x{b.gridX}/y{b.gridY}</Link>) : "sem blocos listados"}</span></div></article>)}{tests.length === 0 && <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow">Nenhum teste criado.</p>}</section>
  </div></main>;
}
