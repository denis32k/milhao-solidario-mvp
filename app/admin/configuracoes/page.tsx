import { revalidatePath } from "next/cache";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, money, safeListQuery } from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { siteConfig } from "@/lib/site-config";
import { getOperationalSettings, normalizeOperationalSettings } from "@/lib/system-settings";

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

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function saveOperationalSettings(formData: FormData) {
  "use server";

  const secret = String(formData.get("secret") || "");
  const adminId = await getActionAdminId(secret);
  if (!adminId && !isSecretAuthorized(secret)) return;

  const settings = normalizeOperationalSettings({
    maintenanceMode: formData.get("maintenanceMode") === "on",
    blockNewPurchases: formData.get("blockNewPurchases") === "on",
    preorderMode: formData.get("preorderMode") === "on",
    uploadsEnabled: formData.get("uploadsEnabled") === "on",
    publicLinksEnabled: formData.get("publicLinksEnabled") === "on",
    checkoutNotice: String(formData.get("checkoutNotice") || ""),
    supportEmail: String(formData.get("supportEmail") || ""),
    supportWhatsapp: String(formData.get("supportWhatsapp") || ""),
    reservationMinutes: numberFromForm(formData.get("reservationMinutes"), 30),
    maxImageMb: numberFromForm(formData.get("maxImageMb"), 5),
    perIpLimitPerDay: numberFromForm(formData.get("perIpLimitPerDay"), 0),
    perCustomerLimitPerDay: numberFromForm(formData.get("perCustomerLimitPerDay"), 0),
  });

  await (prisma as any).systemSetting.upsert({
    where: { key: "operational" },
    update: {
      value: settings,
      description: "Configurações operacionais do Mural29. Não inclui estrutura do grid.",
      updatedByAdminId: adminId,
    },
    create: {
      key: "operational",
      value: settings,
      description: "Configurações operacionais do Mural29. Não inclui estrutura do grid.",
      updatedByAdminId: adminId,
    },
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
}

function StatusCard({ title, enabled, onText, offText }: { title: string; enabled: boolean; onText: string; offText: string }) {
  return <div className={`rounded-2xl p-4 ${enabled ? "bg-emerald-50" : "bg-red-50"}`}><p className={`text-xs font-black uppercase ${enabled ? "text-emerald-700" : "text-red-700"}`}>{title}</p><p className={`mt-1 text-sm font-black ${enabled ? "text-emerald-950" : "text-red-950"}`}>{enabled ? onText : offText}</p></div>;
}

export default async function AdminConfiguracoesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const access = await getAdminAccess(params);
  const secret = access.secret;
  if (!access.authorized) return <AdminLocked nextPath="/admin/configuracoes" />;

  const [settings, settingRows] = await Promise.all([
    getOperationalSettings(),
    safeListQuery(() => (prisma as any).systemSetting.findMany({ orderBy: { updatedAt: "desc" }, take: 20, include: { updatedByAdmin: true } })),
  ]);

  const areas = Object.entries(siteConfig.areas as Record<string, any>);
  const operationHealthy = !settings.maintenanceMode && !settings.blockNewPurchases && settings.uploadsEnabled;

  return <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5"><div className="mx-auto max-w-6xl"><AdminPageHeader secret={secret} active="configuracoes" title="Configurações" description="Controle operacional do site sem mexer em código. A estrutura do grid fica totalmente travada." />
    <section className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-5 shadow-xl"><h2 className="text-xl font-black text-red-950">Grid travado</h2><p className="mt-2 text-sm font-bold text-red-800">Não alterar quantidade de blocos, proporção, tamanho, coordenadas, fundo, divisões, bairros ou renderização principal do mural. Essas configurações mexem só na operação.</p></section>

    <section className="mb-6 grid gap-3 md:grid-cols-4">
      <StatusCard title="Operação" enabled={operationHealthy} onText="Site liberado" offText="Existe bloqueio ativo" />
      <StatusCard title="Compras" enabled={!settings.blockNewPurchases && !settings.maintenanceMode} onText="Compras ativas" offText="Compras bloqueadas" />
      <StatusCard title="Uploads" enabled={settings.uploadsEnabled && !settings.maintenanceMode} onText="Uploads ativos" offText="Uploads bloqueados" />
      <StatusCard title="Links públicos" enabled={settings.publicLinksEnabled} onText="Links ativos" offText="Links desativados" />
    </section>

    <form action={saveOperationalSettings} className="mb-6 rounded-3xl bg-white p-5 shadow-xl">
      <input type="hidden" name="secret" value={secret} />
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-500">Operação em tempo real</p><h2 className="mt-1 text-xl font-black text-slate-950">Controle do site</h2><p className="mt-1 text-sm font-bold text-slate-500">Esses ajustes valem para checkout, uploads e edição do cliente.</p></div><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Salvar configurações</button></div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="rounded-2xl border border-slate-200 p-4"><input name="maintenanceMode" type="checkbox" defaultChecked={settings.maintenanceMode} className="mr-2" /><span className="text-sm font-black text-slate-950">Modo manutenção</span><p className="mt-1 text-xs font-bold text-slate-500">Bloqueia compras e uploads temporariamente.</p></label>
        <label className="rounded-2xl border border-slate-200 p-4"><input name="blockNewPurchases" type="checkbox" defaultChecked={settings.blockNewPurchases} className="mr-2" /><span className="text-sm font-black text-slate-950">Bloquear novas compras</span><p className="mt-1 text-xs font-bold text-slate-500">Mantém o site no ar, mas impede gerar PIX novo.</p></label>
        <label className="rounded-2xl border border-slate-200 p-4"><input name="preorderMode" type="checkbox" defaultChecked={settings.preorderMode} className="mr-2" /><span className="text-sm font-black text-slate-950">Modo pré-venda</span><p className="mt-1 text-xs font-bold text-slate-500">Etiqueta operacional para comunicação e controle.</p></label>
        <label className="rounded-2xl border border-slate-200 p-4"><input name="uploadsEnabled" type="checkbox" defaultChecked={settings.uploadsEnabled} className="mr-2" /><span className="text-sm font-black text-slate-950">Permitir uploads</span><p className="mt-1 text-xs font-bold text-slate-500">Se desligar, checkout/edição não aceitam imagem nova.</p></label>
        <label className="rounded-2xl border border-slate-200 p-4"><input name="publicLinksEnabled" type="checkbox" defaultChecked={settings.publicLinksEnabled} className="mr-2" /><span className="text-sm font-black text-slate-950">Permitir links públicos</span><p className="mt-1 text-xs font-bold text-slate-500">Se desligar, cliente não consegue enviar link novo.</p></label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block"><span className="text-xs font-black uppercase text-slate-500">Aviso no checkout</span><textarea name="checkoutNotice" defaultValue={settings.checkoutNotice} rows={3} placeholder="Ex: Compras liberadas em fase inicial. Atendimento pelo WhatsApp." className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-950" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-black uppercase text-slate-500">Tempo de reserva em minutos</span><input name="reservationMinutes" type="number" min="5" max="120" defaultValue={settings.reservationMinutes} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
          <label className="block"><span className="text-xs font-black uppercase text-slate-500">Imagem máxima em MB</span><input name="maxImageMb" type="number" min="1" max="20" defaultValue={settings.maxImageMb} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
          <label className="block"><span className="text-xs font-black uppercase text-slate-500">Limite por IP/dia</span><input name="perIpLimitPerDay" type="number" min="0" max="500" defaultValue={settings.perIpLimitPerDay} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
          <label className="block"><span className="text-xs font-black uppercase text-slate-500">Limite por cliente/dia</span><input name="perCustomerLimitPerDay" type="number" min="0" max="500" defaultValue={settings.perCustomerLimitPerDay} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block"><span className="text-xs font-black uppercase text-slate-500">E-mail de suporte</span><input name="supportEmail" defaultValue={settings.supportEmail} placeholder="suporte@mural29.com" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
        <label className="block"><span className="text-xs font-black uppercase text-slate-500">WhatsApp de suporte</span><input name="supportWhatsapp" defaultValue={settings.supportWhatsapp} placeholder="5535999999999" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold" /></label>
      </div>
    </form>

    <section className="mb-6 grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Preços por área</h2><div className="mt-4 space-y-3">{areas.map(([key, area]) => <div key={key} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{area.name}</p><p className="text-xs font-bold text-slate-500">{key} • {money(area.priceCents)}</p></div>)}</div><p className="mt-3 text-xs font-bold text-slate-500">Preços ainda vêm do código/config base para evitar alteração acidental.</p></div><div className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Operação</h2><div className="mt-4 space-y-3 text-sm font-bold text-slate-600"><p>Taxa operacional: {siteConfig.operationalFeePercent}%</p><p>Meta interna: {money(siteConfig.goalCents)}</p><p>Logo: {siteConfig.brand.logoUrl || "/logo-mural-29.png"}</p><p>Suporte ativo: {settings.supportEmail || settings.supportWhatsapp || "não configurado"}</p><p>Reserva: {settings.reservationMinutes} minutos</p><p>Imagem: até {settings.maxImageMb}MB</p></div></div></section>

    <section className="rounded-3xl bg-white p-5 shadow-xl"><h2 className="text-xl font-black text-slate-950">Histórico de configurações</h2><div className="mt-4 space-y-3">{settingRows.map((item: any) => <article key={item.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{item.key} • {dateTime(item.updatedAt)}</p><p className="mt-1 text-sm font-bold text-slate-700">{item.description || "Sem descrição"}</p><p className="mt-1 text-xs font-bold text-slate-500">Admin: {item.updatedByAdmin?.email || item.updatedByAdmin?.name || "—"}</p></article>)}{settingRows.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma configuração salva ainda.</p>}</div></section>
  </div></main>;
}
