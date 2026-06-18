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
