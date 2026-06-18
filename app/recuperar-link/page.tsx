import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createManagementToken, getManagementUrl, hashManagementToken } from "@/lib/customer-access";
import { sendCustomerAreaLinksEmail } from "@/lib/customer-notifications";
import CopyTextButton from "@/components/CopyTextButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string; links?: string; email?: string; sent?: string; count?: string }>;

type RecoveryAttempt = {
  count: number;
  resetAt: number;
};

type RecoveredLink = {
  id: string;
  status: string;
  createdAt: string;
  totalPaidCents: number;
  managementUrl: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __mural29RecoveryAttempts: Map<string, RecoveryAttempt> | undefined;
}

const recoveryAttempts = globalThis.__mural29RecoveryAttempts ?? new Map<string, RecoveryAttempt>();
globalThis.__mural29RecoveryAttempts = recoveryAttempts;

const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;
const MAX_RECOVERED_PURCHASES = 10;

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

function cpfMatches(transaction: any, cpfLast4: string) {
  const candidates = [
    transaction.checkoutCpfLast4,
    transaction.user?.cpfLast4,
  ];

  return candidates.some((value) => onlyDigits(String(value || "")).slice(-4) === cpfLast4);
}

function whatsappMatches(transaction: any, whatsappDigits: string) {
  const typedTail = whatsappDigits.slice(-8);
  const storedValues = [
    transaction.checkoutWhatsapp,
    transaction.user?.whatsapp,
  ].map((value) => onlyDigits(String(value || ""))).filter(Boolean);

  return storedValues.some((stored) => {
    const storedTail = stored.slice(-8);
    return storedTail.length >= 8 && (storedTail === typedTail || stored.endsWith(typedTail) || whatsappDigits.endsWith(storedTail));
  });
}

function encodeRecoveredLinks(links: RecoveredLink[]) {
  return Buffer.from(JSON.stringify(links), "utf8").toString("base64url");
}

function decodeRecoveredLinks(value?: string) {
  if (!value) return [];
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed as RecoveredLink[] : [];
  } catch {
    return [];
  }
}

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

async function recoverManagementLink(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  const cpfLast4 = onlyDigits(String(formData.get("cpfLast4") || "")).slice(-4);
  const whatsappDigits = onlyDigits(String(formData.get("whatsapp") || ""));

  if (!email || cpfLast4.length !== 4 || whatsappDigits.length < 8) {
    redirect(`/recuperar-link?error=dados&email=${encodeURIComponent(email)}`);
  }

  const ip = await getClientIp();
  const rateKey = `${ip}:${email}`;
  if (hitRecoveryRateLimit(rateKey)) {
    redirect(`/recuperar-link?error=muitas&email=${encodeURIComponent(email)}`);
  }

  const candidates = await (prisma as any).transaction.findMany({
    where: {
      user: { email },
      status: { in: ["APPROVED", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: true },
  });

  const matches = candidates
    .filter((item: any) => cpfMatches(item, cpfLast4) && whatsappMatches(item, whatsappDigits))
    .slice(0, MAX_RECOVERED_PURCHASES);

  if (matches.length === 0) {
    redirect(`/recuperar-link?error=validacao&email=${encodeURIComponent(email)}`);
  }

  const recoveredLinks: RecoveredLink[] = [];
  const previousTokens = matches.map((transaction: any) => ({
    id: transaction.id,
    managementTokenHash: transaction.managementTokenHash || null,
    managementTokenCreatedAt: transaction.managementTokenCreatedAt || null,
  }));

  for (const transaction of matches) {
    const token = createManagementToken();
    await (prisma as any).transaction.update({
      where: { id: transaction.id },
      data: {
        managementTokenHash: hashManagementToken(token),
        managementTokenCreatedAt: new Date(),
      },
    });

    recoveredLinks.push({
      id: transaction.id,
      status: String(transaction.status || "—"),
      createdAt: new Date(transaction.createdAt).toISOString(),
      totalPaidCents: Number(transaction.totalPaidCents || 0),
      managementUrl: getManagementUrl(token, getCleanAppUrl()),
    });
  }

  const providerConfigured = isEmailProviderConfigured();
  const emailDelivery = await sendCustomerAreaLinksEmail({
    to: matches[0]?.user?.email,
    customerName: matches[0]?.user?.name,
    links: recoveredLinks.map((item) => ({
      managementUrl: item.managementUrl,
      transactionId: item.id,
      status: item.status,
      createdAt: item.createdAt,
      totalPaidCents: item.totalPaidCents,
    })),
  });

  if (providerConfigured && !emailDelivery.ok) {
    for (const previous of previousTokens) {
      await (prisma as any).transaction.update({
        where: { id: previous.id },
        data: {
          managementTokenHash: previous.managementTokenHash,
          managementTokenCreatedAt: previous.managementTokenCreatedAt,
        },
      }).catch(() => null);
    }
  }

  await Promise.all(matches.map((transaction: any) => (
    (prisma as any).supportNote.create({
      data: {
        transactionId: transaction.id,
        customerId: transaction.userId,
        category: "CUSTOMER_LINK_RECOVERY",
        note: emailDelivery.ok
          ? `Área do Cliente: acesso recuperado com validação completa. Foram localizadas ${matches.length} compra(s) para os mesmos dados. E-mail enviado com a lista de acessos. IP: ${ip}`
          : providerConfigured
            ? `Área do Cliente: dados validados, mas o envio da lista de acessos falhou. Links não exibidos por segurança e tokens anteriores foram preservados/restaurados. Motivo: ${emailDelivery.message || "erro no provedor"}. IP: ${ip}`
            : `Área do Cliente: acesso recuperado com validação completa. Foram localizadas ${matches.length} compra(s). Links exibidos na tela porque RESEND_API_KEY não está configurada. IP: ${ip}`,
      },
    }).catch(() => null)
  )));

  if (emailDelivery.ok) {
    redirect(`/recuperar-link?ok=1&sent=1&email=${encodeURIComponent(email)}&count=${matches.length}`);
  }

  if (providerConfigured) {
    redirect(`/recuperar-link?error=envio&email=${encodeURIComponent(email)}`);
  }

  redirect(`/recuperar-link?ok=1&sent=0&email=${encodeURIComponent(email)}&count=${matches.length}&links=${encodeURIComponent(encodeRecoveredLinks(recoveredLinks))}`);
}

export default async function RecoverLinkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const recoveredLinks = decodeRecoveredLinks(params.links);
  const email = params.email || "";
  const error = params.error || "";
  const ok = params.ok === "1";
  const sent = params.sent === "1";
  const count = Number(params.count || recoveredLinks.length || 0);

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">← Voltar ao Mural29</Link>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-white px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-500">Acesso seguro</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Área do Cliente</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Consulte suas compras, acompanhe pagamentos e acesse a personalização dos seus espaços no Mural29 com segurança.
            </p>
          </div>

          <div className="p-5">
            {error === "dados" && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">Preencha os três dados usados no checkout: e-mail, CPF final e WhatsApp.</div>}
            {error === "validacao" && <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-medium text-yellow-800">Não conseguimos validar uma compra com os dados informados. Revise as informações e tente novamente.</div>}
            {error === "muitas" && <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-medium text-yellow-800">Por segurança, bloqueamos novas tentativas por alguns minutos. Tente novamente mais tarde.</div>}
            {error === "envio" && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">Validamos os dados, mas não foi possível enviar os acessos agora. Tente novamente em alguns minutos ou fale com o suporte.</div>}

            {ok && sent ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Acesso enviado</p>
                <h2 className="mt-1 text-lg font-semibold text-emerald-950">{count > 1 ? "Enviamos seus links seguros" : "Enviamos seu link seguro"}</h2>
                <p className="mt-2 text-sm leading-relaxed text-emerald-800">
                  Encontramos {count || 1} compra(s) vinculada(s) aos dados informados. O acesso foi enviado para {email || "o e-mail usado na compra"}. Confira também a caixa de spam ou promoções.
                </p>
                <Link href="/" className="mt-4 flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">Voltar ao mural</Link>
              </div>
            ) : recoveredLinks.length > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Acesso validado</p>
                <h2 className="mt-1 text-lg font-semibold text-emerald-950">{recoveredLinks.length > 1 ? "Encontramos suas compras" : "Seu link seguro foi gerado"}</h2>
                <p className="mt-2 text-sm leading-relaxed text-emerald-800">
                  {recoveredLinks.length > 1
                    ? "Encontramos mais de uma compra com esses dados. Copie ou abra o acesso correspondente."
                    : "Copie e guarde este link. Quando o envio de e-mail estiver configurado, o acesso será enviado somente para o e-mail da compra."}
                </p>
                <div className="mt-4 space-y-3">
                  {recoveredLinks.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-emerald-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Compra {index + 1}</p>
                      <div className="mt-1 grid gap-1 text-xs font-medium text-slate-600 sm:grid-cols-3">
                        <span>Status: {item.status}</span>
                        <span>{dateTime(item.createdAt)}</span>
                        <span>{money(item.totalPaidCents)}</span>
                      </div>
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2 text-[11px] font-medium break-all text-emerald-950">{item.managementUrl}</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2"><CopyTextButton text={item.managementUrl} label="Copiar link" copiedLabel="Copiado" /><a href={item.managementUrl} className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">Abrir esta compra</a></div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <form action={recoverManagementLink} className="space-y-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-medium leading-relaxed text-blue-800">
                  Para proteger sua compra, validamos os três dados informados no checkout. Não exibimos quais dados estão corretos ou incorretos.
                </div>

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

                <button className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Continuar com segurança</button>

                <p className="text-center text-xs leading-relaxed text-slate-500">
                  O acesso é liberado apenas quando os dados conferem com uma compra pendente ou aprovada.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
