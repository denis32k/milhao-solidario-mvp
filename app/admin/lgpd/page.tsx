import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, normalizeSearch, safeListQuery, withAdminSecret } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function actionAuthorized(secret: string) {
  if (process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) return true;
  const session = await getAdminSession();
  return Boolean(session?.user);
}

async function createPrivacyRequest(formData: FormData) {
  "use server";
  const secret = String(formData.get("secret") || "");
  if (!(await actionAuthorized(secret))) return;
  const email = String(formData.get("email") || "").trim();
  const type = String(formData.get("type") || "ACCESS");
  const message = String(formData.get("message") || "").trim();
  if (!email) return;
  await (prisma as any).dataPrivacyRequest.create({ data: { email, type, message, status: "OPEN" } });
  revalidatePath("/admin/lgpd");
}

export default async function AdminLgpdPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const q = normalizeSearch(params.q);
  const userWhere: any = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { whatsapp: { contains: q, mode: "insensitive" } }] } : {};
  const [users, consents, requests] = await Promise.all([
    safeListQuery(() => (prisma as any).user.findMany({ where: userWhere, orderBy: { createdAt: "desc" }, take: 40 })),
    safeListQuery(() => (prisma as any).consentLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { user: true, transaction: true } })),
    safeListQuery(() => (prisma as any).dataPrivacyRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: true } })),
  ]);
  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="lgpd" title="LGPD e dados do cliente" description="Busca de dados, consentimentos, registros de aceite e solicitações de titular." />
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Buscar cliente</h2><form className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]"><input type="hidden" name="secret" value={secret}/><input name="q" defaultValue={q} placeholder="Nome, e-mail ou WhatsApp" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Buscar</button></form><div className="mt-4 grid gap-3 md:grid-cols-2">{users.map((u: any) => <article key={u.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{u.role} • {dateTime(u.createdAt)}</p><h3 className="text-lg font-black text-slate-950">{u.name}</h3><p className="text-xs font-bold text-slate-500">{u.email || "sem e-mail"} • {u.whatsapp || "sem WhatsApp"}</p></article>)}</div></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Registrar solicitação LGPD</h2><form action={createPrivacyRequest} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]"><input type="hidden" name="secret" value={secret}/><input name="email" type="email" required placeholder="E-mail do cliente" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><select name="type" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="ACCESS">Acesso</option><option value="CORRECTION">Correção</option><option value="DELETION">Exclusão</option><option value="ANONYMIZATION">Anonimização</option><option value="EXPORT">Exportação</option></select><textarea name="message" rows={3} placeholder="Observação interna" className="md:col-span-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><button className="md:col-span-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Registrar pedido</button></form></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-slate-950">Consentimentos recentes</h2><a href={withAdminSecret("/api/admin/export?type=consents", secret)} className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Exportar</a></div><div className="mt-4 space-y-2">{consents.map((c: any) => <article key={c.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{dateTime(c.acceptedAt)} • {c.channel || "canal"}</p><p className="text-sm font-bold text-slate-700">{c.user?.email || c.user?.name || "Usuário"} • Termos {c.termsVersion || "—"} • Privacidade {c.privacyVersion || "—"}</p></article>)}</div></section>
    <section className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Pedidos de titulares</h2><div className="mt-4 space-y-2">{requests.map((r: any) => <article key={r.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{r.type} • {r.status} • {dateTime(r.createdAt)}</p><p className="text-sm font-bold text-slate-700">{r.email || r.user?.email || "sem e-mail"}</p><p className="text-xs font-bold text-slate-500">{r.message || "sem observação"}</p></article>)}</div></section>
  </div></main>;
}
