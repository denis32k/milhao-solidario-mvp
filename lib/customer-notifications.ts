export type ManagementEmailResult = {
  ok: boolean;
  skipped?: boolean;
  provider?: string;
  message?: string;
};

function cleanAppName() {
  return process.env.APP_NAME || "Mural29";
}

export async function sendManagementLinkEmail({
  to,
  customerName,
  managementUrl,
  transactionId,
}: {
  to: string | null | undefined;
  customerName?: string | null;
  managementUrl: string;
  transactionId?: string | null;
}): Promise<ManagementEmailResult> {
  const email = String(to || "").trim().toLowerCase();
  if (!email || !managementUrl) return { ok: false, skipped: true, message: "E-mail ou link ausente." };

  const resendApiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM || "Mural29 <noreply@mural29.com.br>";
  const appName = cleanAppName();
  const firstName = String(customerName || "").trim().split(" ")[0] || "tudo bem";
  const subject = `Seu link seguro do ${appName}`;
  const text = `Olá, ${firstName}!\n\nEste é o seu link seguro para acompanhar e personalizar sua compra no ${appName}:\n${managementUrl}\n\nGuarde este link. Ele permite continuar a personalização, trocar nome público, link e imagem quando disponível.\n\nPedido: ${transactionId || "—"}\n\nEquipe ${appName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827">Seu link seguro do ${appName}</h2>
      <p>Olá, ${firstName}!</p>
      <p>Use o botão abaixo para acompanhar e personalizar sua compra no ${appName}.</p>
      <p style="margin:22px 0"><a href="${managementUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700">Abrir meu link seguro</a></p>
      <p style="font-size:13px;color:#6b7280">Se o botão não abrir, copie e cole este link no navegador:</p>
      <p style="word-break:break-all;font-size:13px;color:#374151">${managementUrl}</p>
      <p style="font-size:13px;color:#6b7280">Pedido: ${transactionId || "—"}</p>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0" />
      <p style="font-size:12px;color:#6b7280">Guarde este e-mail. Ele ajuda você a voltar para personalizar seu espaço caso feche a página do PIX.</p>
    </div>
  `;

  if (!resendApiKey) {
    return { ok: false, skipped: true, provider: "resend", message: "RESEND_API_KEY não configurada." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: email, subject, text, html }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, provider: "resend", message: body || `Resend HTTP ${response.status}` };
    }

    return { ok: true, provider: "resend" };
  } catch (error) {
    return { ok: false, provider: "resend", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendCustomerAreaLinksEmail({
  to,
  customerName,
  links,
}: {
  to: string | null | undefined;
  customerName?: string | null;
  links: Array<{
    managementUrl: string;
    transactionId: string;
    status?: string | null;
    createdAt?: Date | string | null;
    totalPaidCents?: number | null;
  }>;
}): Promise<ManagementEmailResult> {
  const email = String(to || "").trim().toLowerCase();
  const safeLinks = links.filter((item) => item.managementUrl && item.transactionId);
  if (!email || safeLinks.length === 0) return { ok: false, skipped: true, message: "E-mail ou links ausentes." };

  const resendApiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM || "Mural29 <noreply@mural29.com.br>";
  const appName = cleanAppName();
  const firstName = String(customerName || "").trim().split(" ")[0] || "tudo bem";
  const subject = safeLinks.length === 1 ? `Seu acesso à Área do Cliente do ${appName}` : `Seus acessos à Área do Cliente do ${appName}`;

  const money = (cents?: number | null) => {
    const value = Number(cents || 0) / 100;
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const dateText = (value?: Date | string | null) => {
    if (!value) return "data não informada";
    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch {
      return "data não informada";
    }
  };

  const textItems = safeLinks.map((item, index) => {
    return `${index + 1}. Pedido ${item.transactionId}\nStatus: ${item.status || "—"}\nData: ${dateText(item.createdAt)}\nValor: ${money(item.totalPaidCents)}\nLink: ${item.managementUrl}`;
  }).join("\n\n");

  const htmlItems = safeLinks.map((item, index) => `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:12px 0;background:#ffffff">
      <p style="margin:0 0 6px;font-size:12px;color:#6b7280;font-weight:bold;text-transform:uppercase">Compra ${index + 1}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#111827"><strong>Pedido:</strong> ${item.transactionId}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#374151"><strong>Status:</strong> ${item.status || "—"}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#374151"><strong>Data:</strong> ${dateText(item.createdAt)}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#374151"><strong>Valor:</strong> ${money(item.totalPaidCents)}</p>
      <a href="${item.managementUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 14px;border-radius:10px;font-weight:700;font-size:13px">Abrir esta compra</a>
      <p style="word-break:break-all;font-size:12px;color:#6b7280;margin:12px 0 0">${item.managementUrl}</p>
    </div>
  `).join("");

  const text = `Olá, ${firstName}!\n\nEncontramos ${safeLinks.length} compra(s) vinculada(s) aos dados informados. Use os links abaixo para acessar sua Área do Cliente no ${appName}.\n\n${textItems}\n\nGuarde este e-mail. Ele permite acompanhar pagamento, personalizar seu espaço e voltar ao seu acesso com segurança.\n\nEquipe ${appName}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc">
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px">
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827">Área do Cliente ${appName}</h2>
        <p>Olá, ${firstName}!</p>
        <p>Encontramos <strong>${safeLinks.length} compra(s)</strong> vinculada(s) aos dados informados. Use os acessos abaixo para acompanhar pagamento, personalizar seu espaço ou voltar à sua compra.</p>
        ${htmlItems}
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:12px;color:#6b7280;margin:0">Por segurança, mantenha este e-mail guardado e não compartilhe seus links de acesso.</p>
      </div>
    </div>
  `;

  if (!resendApiKey) {
    return { ok: false, skipped: true, provider: "resend", message: "RESEND_API_KEY não configurada." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: email, subject, text, html }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, provider: "resend", message: body || `Resend HTTP ${response.status}` };
    }

    return { ok: true, provider: "resend" };
  } catch (error) {
    return { ok: false, provider: "resend", message: error instanceof Error ? error.message : String(error) };
  }
}

