import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery, withAdminSecret } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function actionAuthorized(secret: string) {
  if (process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) return true;
  const session = await getAdminSession();
  return Boolean(session?.user);
}

async function registerBackupCheck(formData: FormData) {
  "use server";
  const secret = String(formData.get("secret") || "");
  if (!(await actionAuthorized(secret))) return;
  const type = String(formData.get("type") || "manual_check");
  const note = String(formData.get("note") || "").trim();
  await (prisma as any).backupRecord.create({ data: { type, status: "PENDING", note: note || "Registro manual criado no admin." } });
  revalidatePath("/admin/backups");
}

export default async function AdminBackupsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked />;
  const backups = await safeListQuery(() => (prisma as any).backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 60 }));
  return <main className="min-h-screen bg-slate-100 px-4 py-6"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="backups" title="Backups e recuperação" description="Controle operacional de backups, exportações manuais e lembretes de restauração." />
    <section className="mb-6 rounded-3xl border border-yellow-200 bg-yellow-50 p-5 shadow-xl"><h2 className="text-xl font-black text-yellow-950">Backup real fica no servidor</h2><p className="mt-2 text-sm font-bold leading-relaxed text-yellow-900">Esta tela registra status e facilita exportações CSV. O backup automático do PostgreSQL e uploads deve ser configurado no EasyPanel/servidor, com teste de restauração.</p></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Exportações rápidas</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{["orders","payments","clients","blocks","logs","webhooks","consents"].map((type) => <a key={type} href={withAdminSecret(`/api/admin/export?type=${type}`, secret)} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-xs font-black uppercase text-white">Exportar {type}</a>)}</div></section>
    <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Registrar checagem manual</h2><form action={registerBackupCheck} className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_160px]"><input type="hidden" name="secret" value={secret}/><select name="type" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="database">Banco PostgreSQL</option><option value="uploads">Uploads/imagens</option><option value="manual_export">Exportação manual</option><option value="restore_test">Teste de restauração</option></select><input name="note" placeholder="Observação" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"/><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Registrar</button></form></section>
    <section className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Histórico de backups</h2><div className="mt-4 space-y-2">{backups.map((b: any) => <article key={b.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{b.type} • {b.status} • {dateTime(b.createdAt)}</p><p className="mt-1 text-sm font-bold text-slate-700">{b.note || "sem nota"}</p>{b.fileUrl && <p className="mt-1 text-xs font-bold text-slate-500">Arquivo: {b.fileUrl}</p>}</article>)}{backups.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum registro ainda.</p>}</div></section>
  </div></main>;
}
