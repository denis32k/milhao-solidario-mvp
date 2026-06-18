import { access, mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import AdminLocked from "@/components/admin/AdminLocked";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { AdminSearchParams, dateTime, getAdminAccess, safeListQuery, safeValueQuery } from "@/lib/admin";

export const dynamic = "force-dynamic";

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function cleanAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}

async function canWriteUploadDir(uploadDir: string) {
  const diagnosticFile = path.join(uploadDir, `.mural29-diagnostic-${Date.now()}.txt`);
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(diagnosticFile, "ok", "utf8");
    await access(diagnosticFile);
    await unlink(diagnosticFile).catch(() => null);
    return { ok: true, message: "Pasta gravável." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function getLatestUpload(uploadDir: string) {
  try {
    const files = await readdir(uploadDir);
    const images = files.filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file)).slice(-80);
    const detailed = await Promise.all(images.map(async (file) => {
      const info = await stat(path.join(uploadDir, file));
      return { file, size: info.size, updatedAt: info.mtime };
    }));
    return detailed.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  } catch {
    return [];
  }
}

function DiagnosticCard({ title, ok, value, hint }: { title: string; ok: boolean; value: string; hint?: string }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase ${ok ? "text-emerald-700" : "text-red-700"}`}>{title}</p>
          <p className={`mt-1 text-sm font-black break-all ${ok ? "text-emerald-950" : "text-red-950"}`}>{value}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${ok ? "bg-white text-emerald-700" : "bg-white text-red-700"}`}>{ok ? "OK" : "ATENÇÃO"}</span>
      </div>
      {hint && <p className={`mt-2 text-xs font-bold leading-relaxed ${ok ? "text-emerald-800" : "text-red-800"}`}>{hint}</p>}
    </div>
  );
}

export default async function AdminDiagnosticoPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  const accessInfo = await getAdminAccess(params);
  const secret = accessInfo.secret;
  if (!accessInfo.authorized) return <AdminLocked nextPath="/admin/diagnostico" />;

  const appUrl = cleanAppUrl();
  const uploadDir = getUploadDir();
  const uploadWrite = await canWriteUploadDir(uploadDir);

  const [dbOk, blockCount, lastWebhook, lastApproved, lastUploads] = await Promise.all([
    safeValueQuery(() => prisma.$queryRaw`SELECT 1`, null).then((value) => Boolean(value)).catch(() => false),
    safeValueQuery(() => (prisma as any).block.count(), 0),
    safeValueQuery(() => (prisma as any).paymentWebhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, include: { transaction: true } }), null),
    safeValueQuery(() => (prisma as any).transaction.findFirst({ where: { status: "APPROVED", isTest: false }, orderBy: { approvedAt: "desc" }, include: { user: true } }), null),
    getLatestUpload(uploadDir),
  ]);

  const webhookUrl = appUrl ? `${appUrl}/api/mercado-pago-pix/webhook` : "APP_URL/NEXT_PUBLIC_APP_URL ausente";
  const mercadoPagoConfigured = Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const uploadLooksPersistent = uploadDir === "/app/uploads" || uploadDir.startsWith("/app/uploads/");

  return (
    <main className="admin-saas-main min-h-screen px-3 py-4 lg:px-5">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader secret={secret} active="diagnostico" title="Diagnóstico" description="Checklist operacional para conferir banco, Mercado Pago, webhook, upload persistente e e-mail antes do lançamento." />

        <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DiagnosticCard title="Banco de dados" ok={dbOk} value={dbOk ? `Conectado • ${blockCount} blocos` : "Falha na conexão"} hint="Confere se o Prisma consegue consultar o PostgreSQL." />
          <DiagnosticCard title="Mercado Pago" ok={mercadoPagoConfigured} value={mercadoPagoConfigured ? "Token configurado" : "Token ausente"} hint="Necessário para gerar PIX e sincronizar pagamento." />
          <DiagnosticCard title="APP URL" ok={Boolean(appUrl)} value={appUrl || "Não configurado"} hint="Usado para webhook, links seguros e recuperação de compra." />
          <DiagnosticCard title="Webhook" ok={Boolean(appUrl)} value={webhookUrl} hint="Essa URL deve estar cadastrada no Mercado Pago." />
          <DiagnosticCard title="Upload gravável" ok={uploadWrite.ok} value={uploadDir} hint={uploadWrite.ok ? uploadWrite.message : uploadWrite.message} />
          <DiagnosticCard title="Upload persistente" ok={uploadLooksPersistent} value={uploadLooksPersistent ? "Usando /app/uploads" : uploadDir} hint="No EasyPanel, monte volume persistente em /app/uploads para imagens não sumirem no rebuild." />
          <DiagnosticCard title="Resend/e-mail" ok={resendConfigured} value={resendConfigured ? "API configurada" : "Opcional: não configurado"} hint={resendConfigured ? "Links seguros podem ser enviados por e-mail." : "O site funciona sem isso, mas não envia e-mail automático."} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Último webhook</h2>
            {lastWebhook ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                <p>Recebido: {dateTime((lastWebhook as any).receivedAt)}</p>
                <p>Payment ID: {(lastWebhook as any).paymentId || "—"}</p>
                <p>Status: {(lastWebhook as any).processed ? "processado" : (lastWebhook as any).ignored ? "ignorado" : "pendente"}</p>
                <p>Pedido: {(lastWebhook as any).transactionId || "—"}</p>
                {(lastWebhook as any).error && <p className="mt-2 text-red-600">Erro: {(lastWebhook as any).error}</p>}
              </div>
            ) : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum webhook recebido ainda.</p>}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-black text-slate-950">Último pagamento aprovado</h2>
            {lastApproved ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                <p>Cliente: {(lastApproved as any).user?.name || "—"}</p>
                <p>Pedido: {(lastApproved as any).id}</p>
                <p>Valor: R$ {Number(((lastApproved as any).totalPaidCents || 0) / 100).toFixed(2).replace(".", ",")}</p>
                <p>Aprovado: {dateTime((lastApproved as any).approvedAt)}</p>
              </div>
            ) : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum pagamento aprovado ainda.</p>}
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-xl">
          <h2 className="text-xl font-black text-slate-950">Últimos uploads no servidor</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {lastUploads.map((item) => (
              <div key={item.file} className="rounded-2xl bg-slate-50 p-3">
                <p className="break-all text-xs font-black text-slate-700">{item.file}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{Math.round(item.size / 1024)} KB</p>
                <p className="text-[11px] font-bold text-slate-400">{dateTime(item.updatedAt)}</p>
              </div>
            ))}
            {lastUploads.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum upload encontrado na pasta atual.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
