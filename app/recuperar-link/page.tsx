import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createManagementToken, getManagementUrl, hashManagementToken } from "@/lib/customer-access";
import { sendManagementLinkEmail } from "@/lib/customer-notifications";
import CopyTextButton from "@/components/CopyTextButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string; link?: string; email?: string; sent?: string }>;

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

async function recoverManagementLink(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  const cpfLast4 = onlyDigits(String(formData.get("cpfLast4") || "")).slice(-4);
  const whatsapp = onlyDigits(String(formData.get("whatsapp") || ""));

  if (!email || (!cpfLast4 && whatsapp.length < 8)) {
    redirect("/recuperar-link?error=dados");
  }

  const identityConditions: any[] = [];
  if (cpfLast4.length === 4) identityConditions.push({ checkoutCpfLast4: cpfLast4 });
  if (whatsapp.length >= 8) {
    identityConditions.push({ checkoutWhatsapp: { contains: whatsapp.slice(-8) } });
    identityConditions.push({ user: { whatsapp: { contains: whatsapp.slice(-8) } } });
  }

  const transaction = await (prisma as any).transaction.findFirst({
    where: {
      user: { email },
      status: { in: ["APPROVED", "PENDING"] },
      OR: identityConditions,
    },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  if (!transaction) {
    redirect(`/recuperar-link?error=nao-encontrado&email=${encodeURIComponent(email)}`);
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
  const emailDelivery = await sendManagementLinkEmail({
    to: transaction.user?.email,
    customerName: transaction.user?.name,
    managementUrl,
    transactionId: transaction.id,
  });

  await (prisma as any).supportNote.create({
    data: {
      transactionId: transaction.id,
      customerId: transaction.userId,
      category: "CUSTOMER_LINK_RECOVERY",
      note: emailDelivery.ok
        ? "Cliente recuperou link seguro pela página pública. E-mail reenviado."
        : `Cliente recuperou link seguro pela página pública. E-mail não enviado: ${emailDelivery.message || "provedor não configurado"}`,
    },
  }).catch(() => null);

  redirect(`/recuperar-link?ok=1&sent=${emailDelivery.ok ? "1" : "0"}&email=${encodeURIComponent(email)}&link=${encodeURIComponent(managementUrl)}`);
}

export default async function RecoverLinkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const link = params.link || "";
  const email = params.email || "";
  const error = params.error || "";
  const sent = params.sent === "1";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">← Voltar ao mural</Link>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Suporte Mural29</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Recuperar link da compra</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Informe o e-mail usado no checkout e confirme com os 4 últimos dígitos do CPF ou WhatsApp. Vamos gerar um novo link seguro para você continuar.</p>

          {error === "dados" && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Informe o e-mail e pelo menos CPF ou WhatsApp.</div>}
          {error === "nao-encontrado" && <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">Não encontramos compra aprovada ou pendente com esses dados. Confira as informações ou fale com o suporte.</div>}

          {link ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Link encontrado</p>
              <h2 className="mt-1 text-lg font-bold text-emerald-950">Seu novo link seguro foi gerado</h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-800">{sent ? `Também enviamos para ${email}.` : "Copie e guarde este link. O envio por e-mail não está configurado no servidor."}</p>
              <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-semibold break-all text-emerald-950">{link}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2"><CopyTextButton text={link} label="Copiar link" copiedLabel="Copiado" /><a href={link} className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Abrir área do comprador</a></div>
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
                  <input name="cpfLast4" inputMode="numeric" maxLength={4} placeholder="0000" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-slate-950" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">WhatsApp</span>
                  <input name="whatsapp" inputMode="tel" placeholder="(35) 99999-9999" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-slate-950" />
                </label>
              </div>
              <button className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">Gerar novo link seguro</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
