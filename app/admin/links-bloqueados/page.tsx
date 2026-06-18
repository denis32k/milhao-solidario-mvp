import { revalidatePath } from "next/cache";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery, shortId } from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { normalizeBlockedDomain } from "@/lib/content-validation";

export const dynamic = "force-dynamic";

function isSecretAuthorized(secretFromForm: string | undefined) {
  const secret = process.env.ADMIN_API_SECRET;
  return Boolean(secret && secretFromForm === secret);
}

async function getActionAdminId(secretFromForm: string | undefined) {
  if (isSecretAuthorized(secretFromForm)) return null;
  const session = await getAdminSession();
  return session?.user?.id || null;
}

async function addBlockedDomain(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const domain = normalizeBlockedDomain(formData.get("domain"));
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);

  if (!domain || reason.length < 5) return;

  await (prisma as any).blockedDomain.upsert({
    where: { domain },
    update: { active: true, reason, createdByAdminId: adminId },
    create: { domain, reason, active: true, createdByAdminId: adminId },
  });

  await (prisma as any).linkModerationLog.create({
    data: {
      url: `domain:${domain}`,
      domain,
      action: "DOMAIN_BLOCKED_BY_ADMIN",
      reason,
    },
  }).catch(() => null);

  revalidatePath("/admin/links-bloqueados");
}

async function toggleBlockedDomain(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  const reason = String(formData.get("reason") || "Alteração manual no status do domínio.").trim().slice(0, 500);

  if (!id) return;

  const domain = await (prisma as any).blockedDomain.update({
    where: { id },
    data: { active, ...(reason ? { reason } : {}) },
  }).catch(() => null);

  if (domain) {
    await (prisma as any).linkModerationLog.create({
      data: {
        url: `domain:${domain.domain}`,
        domain: domain.domain,
        action: active ? "DOMAIN_REACTIVATED_BY_ADMIN" : "DOMAIN_RELEASED_BY_ADMIN",
        reason,
      },
    }).catch(() => null);
  }

  revalidatePath("/admin/links-bloqueados");
}

export default async function AdminLinksBloqueadosPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;

  if (!access.authorized) return <AdminLocked />;

  const [domains, logs] = await Promise.all([
    safeListQuery(() => (prisma as any).blockedDomain.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      take: 200,
      include: { createdByAdmin: true },
    })),
    safeListQuery(() => (prisma as any).linkModerationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { transaction: { include: { user: true } }, placement: true },
    })),
  ]);

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader
          secret={secret}
          active="links"
          title="Links bloqueados"
          description="Controle de domínios proibidos, logs de links recusados e proteção contra link suspeito no checkout e nas edições futuras."
        />

        <section className="mb-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <form action={addBlockedDomain} className="rounded-3xl bg-white p-5 shadow-xl">
            <input type="hidden" name="secret" value={secret} />
            <p className="text-xs font-black uppercase text-slate-500">Novo bloqueio</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Bloquear domínio</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">Exemplo: dominio.com ou https://dominio.com. O sistema bloqueia também tentativas no checkout e nas edições.</p>
            <input name="domain" required placeholder="dominio.com" className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" />
            <textarea name="reason" required minLength={5} rows={3} placeholder="Motivo obrigatório do bloqueio" className="mt-3 w-full resize-none rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-bold outline-none focus:border-yellow-700" />
            <button className="mt-3 w-full rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Bloquear domínio</button>
          </form>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Exportação</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Relatório de links</h2>
              </div>
              <a href={`/api/admin/export?type=blocked-links${secret ? `&secret=${encodeURIComponent(secret)}` : ""}`} className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Baixar CSV</a>
            </div>
            <p className="mt-3 text-sm font-bold leading-relaxed text-slate-500">Use esse relatório para conferir domínios bloqueados e tentativas recusadas. Isso ajuda a explicar decisões de moderação depois.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black text-slate-500">Domínios ativos</p><p className="mt-1 text-2xl font-black text-slate-950">{domains.filter((d: any) => d.active).length}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black text-slate-500">Total cadastrado</p><p className="mt-1 text-2xl font-black text-slate-950">{domains.length}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black text-slate-500">Logs recentes</p><p className="mt-1 text-2xl font-black text-slate-950">{logs.length}</p></div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Domínios cadastrados</h2>
          <div className="mt-4 space-y-3">
            {domains.map((domain: any) => (
              <article key={domain.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-500">{domain.active ? "Ativo" : "Inativo"} • {dateTime(domain.updatedAt)}</p>
                    <h3 className="mt-1 break-all text-lg font-black text-slate-950">{domain.domain}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">{domain.reason || "Sem motivo"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Admin: {domain.createdByAdmin?.email || domain.createdByAdmin?.name || "—"}</p>
                  </div>
                  <form action={toggleBlockedDomain} className="min-w-48 space-y-2">
                    <input type="hidden" name="secret" value={secret} />
                    <input type="hidden" name="id" value={domain.id} />
                    <input type="hidden" name="active" value={domain.active ? "false" : "true"} />
                    <input name="reason" required minLength={5} defaultValue={domain.active ? "Domínio liberado manualmente." : "Domínio bloqueado novamente."} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold outline-none" />
                    <button className={`w-full rounded-2xl px-3 py-2 text-xs font-black ${domain.active ? "bg-emerald-50 text-emerald-700" : "bg-red-600 text-white"}`}>{domain.active ? "Desativar bloqueio" : "Reativar bloqueio"}</button>
                  </form>
                </div>
              </article>
            ))}
            {domains.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum domínio bloqueado ainda.</p>}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Logs de link</h2>
          <div className="mt-4 space-y-3">
            {logs.map((log: any) => (
              <article key={log.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-500">{log.action} • {dateTime(log.createdAt)}</p>
                    <h3 className="mt-1 break-all text-sm font-black text-slate-950">{log.url}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Domínio: {log.domain || "—"}</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">{log.reason || "Sem motivo"}</p>
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-500">
                    <p>pedido: {shortId(log.transactionId)}</p>
                    <p>conteúdo: {shortId(log.placementId)}</p>
                    <p>cliente: {log.transaction?.user?.name || "—"}</p>
                  </div>
                </div>
              </article>
            ))}
            {logs.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum log de link ainda.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
