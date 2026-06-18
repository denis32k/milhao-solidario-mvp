import { prisma } from "@/lib/prisma";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/usuarios" />;

  const [admins, sessions, attempts] = await Promise.all([
    safeListQuery(() => (prisma as any).user.findMany({ where: { role: { in: ["OWNER", "ADMIN", "FINANCE", "MODERATOR", "SUPPORT", "DEV"] } }, orderBy: { createdAt: "desc" }, take: 50 })),
    safeListQuery(() => (prisma as any).adminSession.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: true } })),
    safeListQuery(() => (prisma as any).adminLoginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { user: true } })),
  ]);

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="usuarios" title="Usuários admin e segurança" description="Perfis administrativos, sessões abertas e tentativas de login registradas." />
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Administradores</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {admins.map((user: any) => <article key={user.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{user.role} • {user.isBanned ? "banido" : "ativo"}</p><h3 className="mt-1 text-lg font-black text-slate-950">{user.name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{user.email}</p></article>)}
            {admins.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum admin criado ainda. O primeiro é criado com ADMIN_EMAIL + ADMIN_PASSWORD.</p>}
          </div>
        </section>
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Sessões recentes</h2>
          <div className="mt-4 space-y-2">
            {sessions.map((session: any) => <article key={session.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{session.role} • expira {dateTime(session.expiresAt)}</p><p className="mt-1 text-sm font-bold text-slate-700">{session.user?.email || "admin"}</p><p className="mt-1 text-[10px] font-bold text-slate-400">IP hash: {session.ipHash ? "registrado" : "—"} • último uso: {dateTime(session.lastSeenAt)}</p></article>)}
            {sessions.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma sessão ativa/recente.</p>}
          </div>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Tentativas de login</h2>
          <div className="mt-4 space-y-2">
            {attempts.map((attempt: any) => <article key={attempt.id} className={`rounded-2xl p-3 ${attempt.success ? "bg-emerald-50" : "bg-red-50"}`}><p className="text-xs font-black uppercase text-slate-500">{attempt.success ? "sucesso" : "falha"} • {dateTime(attempt.createdAt)}</p><p className="mt-1 text-sm font-bold text-slate-700">{attempt.email || attempt.user?.email || "sem e-mail"}</p><p className="mt-1 text-xs font-bold text-slate-500">{attempt.reason || "sem motivo"}</p></article>)}
            {attempts.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma tentativa registrada.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
