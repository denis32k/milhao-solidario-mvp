import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function actionAuthorized(secret: string) {
  if (process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) return true;
  const session = await getAdminSession();
  return Boolean(session?.user);
}

async function createPolicyVersion(formData: FormData) {
  "use server";
  const secret = String(formData.get("secret") || "");
  if (!(await actionAuthorized(secret))) return;
  const kind = String(formData.get("kind") || "TERMS");
  const version = String(formData.get("version") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!version || !title || !content) return;
  await (prisma as any).policyVersion.create({ data: { kind, version, title, content, status: "DRAFT" } }).catch(() => null);
  revalidatePath("/admin/termos-politicas");
}

export default async function AdminTermosPoliticasPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const policies = await safeListQuery(() => (prisma as any).policyVersion.findMany({ orderBy: [{ kind: "asc" }, { createdAt: "desc" }], take: 80 }));
  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="termos" title="Termos e políticas" description="Versões de Termos, Privacidade e Regras de Conteúdo para rastrear o que o cliente aceitou." />
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Criar versão rascunho</h2><form action={createPolicyVersion} className="mt-4 grid gap-3"><input type="hidden" name="secret" value={secret}/><div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]"><select name="kind" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="TERMS">Termos de Uso</option><option value="PRIVACY">Privacidade</option><option value="CONTENT_RULES">Regras de Conteúdo</option><option value="REFUND">Reembolso</option><option value="LINK_RULES">Regras de Link</option><option value="IMAGE_RULES">Regras de Imagem</option></select><input name="version" placeholder="Versão ex: mural29-terms-2026-06" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><input name="title" placeholder="Título" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/></div><textarea name="content" rows={6} placeholder="Resumo/conteúdo da versão" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Salvar rascunho</button></form></section>
    <section className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Versões cadastradas</h2><div className="mt-4 space-y-3">{policies.map((p: any) => <article key={p.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{p.kind} • {p.status} • {dateTime(p.createdAt)}</p><h3 className="mt-1 text-lg font-black text-slate-950">{p.title}</h3><p className="mt-1 text-xs font-bold text-slate-500">Versão: {p.version}</p><p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{p.content.slice(0, 260)}{p.content.length > 260 ? "..." : ""}</p></article>)}{policies.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma versão cadastrada ainda. O checkout já grava as versões fixas no consentimento.</p>}</div></section>
  </div></main>;
}
