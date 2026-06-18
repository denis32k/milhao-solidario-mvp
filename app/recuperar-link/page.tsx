import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createManagementToken, getManagementUrl, hashManagementToken } from "@/lib/customer-access";
import { sendManagementLinkEmail } from "@/lib/customer-notifications";
import CopyTextButton from "@/components/CopyTextButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string; link?: string; email?: string; sent?: string }>;

type RecoveryAttempt = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __mural29RecoveryAttempts: Map<string, RecoveryAttempt> | undefined;
}

const recoveryAttempts = globalThis.__mural29RecoveryAttempts ?? new Map<string, RecoveryAttempt>();
globalThis.__mural29RecoveryAttempts = recoveryAttempts;

const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function getCleanAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}

function isEmailProviderConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || "").trim());
}

async function getClientIp() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") || "";
  const firstForwarded = forwarded.split(",")[0]?.trim();
  return (firstForwarded || headerList.get("x-real-ip") || "unknown").slice(0, 80);
}

function hitRecoveryRateLimit(key: string) {
  const now = Date.now();
  const current = recoveryAttempts.get(key);

  if (!current || current.resetAt < now) {
    recoveryAttempts.set(key, { count: 1, resetAt: now + RECOVERY_WINDOW_MS });
    return false;
  }

  current.count += 1;
  recoveryAttempts.set(key, current);
  return current.count > RECOVERY_MAX_ATTEMPTS;
}

function genericErrorRedirect(email?: string) {
  const safeEmail = email ? `&email=${encodeURIComponent(email)}` : "";
  redirect(`/recuperar-link?error=validacao${safeEmail}`);
}

async function recoverManagementLink(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  const cpfLast4 = onlyDigits(String(formData.get("cpfLast4") || "")).slice(-4);
  const whatsappDigits = onlyDigits(String(formData.get("whatsapp") || ""));
  const whatsappTail = whatsappDigits.slice(-8);

  if (!email || cpfLast4.length !== 4 || whatsappTail.length < 8) {
    redirect(`/recuperar-link?error=dados&email=${encodeURIComponent(email)}`);
  }

  const ip = await getClientIp();
  const rateKey = `${ip}:${email}`;
  if (hitRecoveryRateLimit(rateKey)) {
    redirect(`/recuperar-link?error=muitas&email=${encodeURIComponent(email)}`);
  }

  const transaction = await (prisma as any).transaction.findFirst({
    where: {
      user: { email },
      status: { in: ["APPROVED", "PENDING"] },
      checkoutCpfLast4: cpfLast4,
      OR: [
        { checkoutWhatsapp: { contains: whatsappTail } },
        { user: { whatsapp: { contains: whatsappTail } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  if (!transaction) {
    genericErrorRedirect(email);
  }

  const token = createManagementToken();
  await (prisma as any).transaction.update({
    where: { id: transaction.id },
    data: {
      managementTokenHash: hashManagementToken(token),
      managementTokenCreatedAt: new Date(),
    },
  });

  const managementUrl = getManagementUrl(token, getCleanAppUrl());
  const providerConfigured = isEmailProviderConfigured();
  const emailDelivery = await sendManagementLinkEmail({
    to: transaction.user?.email,
    customerName: transaction.user?.name,
    managementUrl,
    transactionId: transaction.id,
  });

  if (providerConfigured && !emailDelivery.ok) {
    await (prisma as any).transaction.update({
      where: { id: transaction.id },
      data: {
        managementTokenHash: transaction.managementTokenHash || null,
        managementTokenCreatedAt: transaction.managementTokenCreatedAt || null,
      },
    }).catch(() => null);
  }

  await (prisma as any).supportNote.create({
    data: {
      transactionId: transaction.id,
      customerId: transaction.userId,
      category: "CUSTOMER_LINK_RECOVERY",
      note: emailDelivery.ok
        ? `Área do Cliente: link seguro recuperado com e-mail + CPF final + WhatsApp. E-mail reenviado. IP: ${ip}`
        : providerConfigured
          ? `Área do Cliente: dados validados, mas o e-mail do link falhou. Link não exibido por segurança e token anterior foi preservado/restaurado. Motivo: ${emailDelivery.message || "erro no provedor"}. IP: ${ip}`
          : `Área do Cliente: link seguro recuperado com e-mail + CPF final + WhatsApp. Link exibido na tela porque RESEND_API_KEY não está configurada. IP: ${ip}`,
    },
  }).catch(() => null);

  if (emailDelivery.ok) {
    redirect(`/recuperar-link?ok=1&sent=1&email=${encodeURIComponent(email)}`);
  }

  if (providerConfigured) {
    redirect(`/recuperar-link?error=envio&email=${encodeURIComponent(email)}`);
  }

  redirect(`/recuperar-link?ok=1&sent=0&email=${encodeURIComponent(email)}&link=${encodeURIComponent(managementUrl)}`);
}

export default async function RecoverLinkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const link = params.link || "";
  const email = params.email || "";
  const error = params.error || "";
  const ok = params.ok === "1";
  const sent = params.sent === "1";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">← Voltar ao mural</Link>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-500">Mural29</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Área do Cliente</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Acesse sua compra com segurança para acompanhar o pagamento, personalizar seu bloco ou recuperar seu link seguro.</p>

          {error === "dados" && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Informe os 3 dados usados no checkout: e-mail, 4 últimos dígitos do CPF e WhatsApp.</div>}
          {error === "validacao" && <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">Não foi possível validar esses dados. Confira as informações usadas no checkout e tente novamente.</div>}
          {error === "muitas" && <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.</div>}
          {error === "envio" && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Validamos os dados, mas não conseguimos enviar o link agora. Tente novamente em alguns minutos ou fale com o suporte.</div>}

          {ok && sent ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Acesso enviado</p>
              <h2 className="mt-1 text-lg font-bold text-emerald-950">Enviamos seu link seguro</h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-800">O link da sua Área do Cliente foi enviado para {email || "o e-mail usado na compra"}. Confira também a caixa de spam ou promoções.</p>
              <Link href="/" className="mt-4 flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Voltar ao mural</Link>
            </div>
          ) : link ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Link validado</p>
              <h2 className="mt-1 text-lg font-bold text-emerald-950">Seu novo link seguro foi gerado</h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-800">Copie e guarde este link. Quando o envio de e-mail estiver configurado, por segurança o link será enviado somente para o e-mail da compra.</p>
              <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-semibold break-all text-emerald-950">{link}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2"><CopyTextButton text={link} label="Copiar link" copiedLabel="Copiado" /><a href={link} className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Abrir Área do Cliente</a></div>
            </div>
          ) : (
            <form action={recoverManagementLink} className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">E-mail usado na compra</span>
                <input name="email" type="email" required defaultValue={email} placeholder="voce@email.com" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-slate-950" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">4 últimos dígitos do CPF</span>
                  <input name="cpfLast4" inputMode="numeric" maxLength={4} required placeholder="0000" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-slate-950" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">WhatsApp usado na compra</span>
                  <input name="whatsapp" inputMode="tel" required placeholder="(35) 99999-9999" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-slate-950" />
                </label>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-relaxed text-blue-800">Para sua segurança, exigimos os três dados informados no checkout. Não exibimos se um e-mail existe ou não.</div>
              <button className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">Acessar Área do Cliente</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
