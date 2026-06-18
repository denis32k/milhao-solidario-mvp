"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { getAreaName, getAreaPriceCents, getOperationalFeeCents, siteConfig } from "@/lib/site-config";

type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
type CheckoutStep = "data" | "pix" | "customize";

type SelectedBlock = { gridX: number; gridY: number };

type OperationalClientSettings = {
  maintenanceMode: boolean;
  blockNewPurchases: boolean;
  preorderMode: boolean;
  uploadsEnabled: boolean;
  publicLinksEnabled: boolean;
  checkoutNotice: string;
  reservationMinutes: number;
  maxImageMb: number;
};

type PixResult = {
  payment: { id: string | number; status: string; statusDetail: string };
  pix: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null };
  transaction: { id: string; subtotalCents?: number; operatorFeeCents?: number; totalPaidCents: number };
  blocks: Array<{ id: string; gridX: number; gridY: number; category: string; priceCents: number }>;
  managementPath?: string;
  managementUrl?: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatWhatsApp(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getQrImageSrc(qrCodeBase64: string) {
  if (qrCodeBase64.startsWith("data:")) return qrCodeBase64;
  return `data:image/png;base64,${qrCodeBase64}`;
}

function parseBlocksFromQuery(value: string | null) {
  if (!value) return [];
  const unique = new Map<string, SelectedBlock>();
  for (const part of value.split(",")) {
    const [xRaw, yRaw] = part.split(":");
    const gridX = Number(xRaw);
    const gridY = Number(yRaw);
    if (Number.isInteger(gridX) && Number.isInteger(gridY) && gridX >= 0 && gridX < GRID_COLS && gridY >= 0 && gridY < GRID_ROWS) {
      unique.set(`${gridX}:${gridY}`, { gridX, gridY });
    }
  }
  return Array.from(unique.values());
}

function blocksFormRectangle(blocks: SelectedBlock[]) {
  if (blocks.length <= 1) return true;
  const minX = Math.min(...blocks.map((block) => block.gridX));
  const maxX = Math.max(...blocks.map((block) => block.gridX));
  const minY = Math.min(...blocks.map((block) => block.gridY));
  const maxY = Math.max(...blocks.map((block) => block.gridY));
  return (maxX - minX + 1) * (maxY - minY + 1) === blocks.length;
}

function getCategoryTheme(category: BuyableCategory) {
  if (category === "GRAND_CENTER") return { bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-800", button: "pixel-btn--dark", accent: "bg-fuchsia-600", label: "Exclusivo" };
  if (category === "GOLD") return { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", button: "pixel-btn--gold", accent: "bg-yellow-500", label: "Luxo" };
  if (category === "PREMIUM") return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", button: "pixel-btn--orange", accent: "bg-orange-500", label: "Premium" };
  return { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", button: "pixel-btn--green", accent: "bg-green-500", label: "Entrada" };
}

function getManagementToken(result: PixResult | null) {
  const raw = result?.managementPath || result?.managementUrl || "";
  const match = raw.match(/\/gerenciar\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function isValidPublicLink(value: string) {
  if (!value.trim()) return true;
  return /^https?:\/\//i.test(value.trim());
}

export default function CompraPage() {
  const [step, setStep] = useState<CheckoutStep>("data");
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [category, setCategory] = useState<BuyableCategory>("SOLIDARITY");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [publicName, setPublicName] = useState("");
  const [publicLink, setPublicLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSavingPersonalization, setIsSavingPersonalization] = useState(false);
  const [personalizationMessage, setPersonalizationMessage] = useState("");
  const [personalized, setPersonalized] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [operationalSettings, setOperationalSettings] = useState<OperationalClientSettings | null>(null);

  useEffect(() => {
    fetch("/api/mercado-pago-pix", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) setOperationalSettings(data.settings);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedBlocks(parseBlocksFromQuery(params.get("blocks")));
    const categoryParam = String(params.get("category") || "SOLIDARITY").toUpperCase();
    if (categoryParam === "GRAND_CENTER") setCategory("GRAND_CENTER");
    else if (categoryParam === "GOLD") setCategory("GOLD");
    else if (categoryParam === "PREMIUM") setCategory("PREMIUM");
    else setCategory("SOLIDARITY");
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (paymentApproved && !publicName.trim()) {
      setPublicName(fullName.trim().split(" ")[0] || "");
    }
  }, [paymentApproved, fullName, publicName]);

  const unitPriceCents = getAreaPriceCents(category);
  const subtotalCents = useMemo(() => unitPriceCents * selectedBlocks.length, [unitPriceCents, selectedBlocks.length]);
  const operationalFeeCents = useMemo(() => getOperationalFeeCents(subtotalCents), [subtotalCents]);
  const totalCents = subtotalCents + operationalFeeCents;
  const theme = getCategoryTheme(category);
  const isRectangle = blocksFormRectangle(selectedBlocks);
  const reservationMinutes = operationalSettings?.reservationMinutes || 15;
  const mustBeRectangle = selectedBlocks.length > 1;

  function validateFastCheckout() {
    if (selectedBlocks.length === 0) return "Volte ao mural e selecione pelo menos um tijolinho.";
    if (mustBeRectangle && !isRectangle) return "Selecione uma área retangular para a imagem ficar bem encaixada.";
    if (!fullName.trim() || fullName.trim().length < 3) return "Digite seu nome completo.";
    if (!isValidEmail(email)) return "Digite um e-mail válido.";
    if (onlyDigits(whatsapp).length < 10) return "Digite um WhatsApp válido.";
    if (onlyDigits(cpf).length !== 11) return "Digite um CPF válido com 11 números.";
    if (!acceptedTerms) return "Aceite os termos para gerar o PIX.";
    if (operationalSettings?.maintenanceMode) return "O Mural29 está em manutenção no momento.";
    if (operationalSettings?.blockNewPurchases) return "Novas compras estão temporariamente bloqueadas.";
    return "";
  }

  async function handleGeneratePix() {
    try {
      setErrorMessage("");
      setPixResult(null);
      setCopyMessage("");
      setVerifyMessage("");
      setPaymentApproved(false);
      setPersonalized(false);

      const validation = validateFastCheckout();
      if (validation) {
        setErrorMessage(validation);
        return;
      }

      setIsLoading(true);
      const response = await fetch("/api/mercado-pago-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: onlyDigits(whatsapp),
          cpf: onlyDigits(cpf),
          selectedBlocks,
          acceptedTerms,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || "Erro ao criar PIX no Mercado Pago.");

      setPixResult({ payment: data.payment, pix: data.pix, transaction: data.transaction, blocks: data.blocks, managementPath: data.managementPath, managementUrl: data.managementUrl });
      setStep("pix");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado ao gerar PIX.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPix() {
    if (!pixResult?.pix.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixResult.pix.qrCode);
      setCopyMessage("Código PIX copiado.");
    } catch {
      setCopyMessage("Não consegui copiar automaticamente. Selecione e copie manualmente.");
    }
  }

  async function handleCheckPayment() {
    try {
      if (!pixResult?.payment.id) {
        setVerifyMessage("Gere o PIX primeiro.");
        return;
      }

      setIsCheckingPayment(true);
      setVerifyMessage("");

      const response = await fetch(`/api/mercado-pago-pix/webhook?type=payment&data.id=${encodeURIComponent(String(pixResult.payment.id))}`, { method: "GET", cache: "no-store" });
      const data = await response.json();
      const result = data.result || {};
      const nestedResult = result.result || {};
      const mercadoPagoStatus = String(result.mercadoPagoStatus || nestedResult.mercadoPagoStatus || "").toLowerCase();
      const transactionStatus = String(result.transactionStatus || nestedResult.transactionStatus || "").toUpperCase();
      const isApproved = mercadoPagoStatus === "approved" || transactionStatus === "APPROVED";

      if (isApproved) {
        setPaymentApproved(true);
        setStep("customize");
        setVerifyMessage("Pagamento aprovado. Agora personalize seu espaço.");
        return;
      }

      setVerifyMessage("Pagamento ainda não aprovado. Aguarde alguns segundos e tente novamente.");
    } catch (error) {
      setPaymentApproved(false);
      setVerifyMessage(error instanceof Error ? error.message : "Erro inesperado ao verificar pagamento.");
    } finally {
      setIsCheckingPayment(false);
    }
  }

  async function uploadPersonalImage() {
    if (!imageFile) return "";
    const formData = new FormData();
    formData.set("file", imageFile);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Erro ao enviar imagem.");
    return String(data.url || "");
  }

  async function handleSavePersonalization() {
    try {
      setPersonalizationMessage("");
      setErrorMessage("");
      if (!pixResult || !paymentApproved) throw new Error("Confirme o pagamento antes de personalizar.");
      if (!publicName.trim() || publicName.trim().length < 2) throw new Error("Digite o nome público que aparecerá no mural.");
      if (!isValidPublicLink(publicLink)) throw new Error("Use o link completo com https:// ou http://. Ex: https://instagram.com/meuusuario");

      setIsSavingPersonalization(true);
      const imageUrl = await uploadPersonalImage();
      const managementToken = getManagementToken(pixResult);

      const response = await fetch("/api/checkout/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managementToken,
          transactionId: pixResult.transaction.id,
          displayName: publicName.trim(),
          redirectUrl: publicLink.trim(),
          imageUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || "Erro ao salvar personalização.");

      setPersonalized(true);
      setPersonalizationMessage("Personalização salva. Seu espaço já aparece no Mural29.");
    } catch (error) {
      setPersonalizationMessage(error instanceof Error ? error.message : "Erro inesperado ao salvar personalização.");
    } finally {
      setIsSavingPersonalization(false);
    }
  }

  if (selectedBlocks.length === 0) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🧩</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Selecione os tijolinhos primeiro</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Volte ao mural, toque nos tijolinhos desejados e depois continue para o pagamento.</p>
          <Link href="/" className="pixel-btn pixel-btn--green mt-5 flex justify-center !rounded-2xl !py-4 !text-sm">Voltar ao mural</Link>
        </div>
      </main>
    );
  }

  const coordinates = selectedBlocks.slice(0, 12).map((block) => `x${block.gridX}/y${block.gridY}`).join(" • ");
  const extraCoordinates = selectedBlocks.length > 12 ? ` +${selectedBlocks.length - 12}` : "";

  return (
    <main className="min-h-screen bg-transparent px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
          <section className="rounded-[2rem] bg-white p-5 shadow-xl lg:p-7">
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-black text-slate-500">
              <span className={`rounded-full px-3 py-2 ${step === "data" ? "bg-slate-950 text-white" : ""}`}>1. Dados</span>
              <span className={`rounded-full px-3 py-2 ${step === "pix" ? "bg-slate-950 text-white" : ""}`}>2. PIX</span>
              <span className={`rounded-full px-3 py-2 ${step === "customize" ? "bg-slate-950 text-white" : ""}`}>3. Personalizar</span>
            </div>

            {step === "data" && (
              <div className="mt-6">
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${theme.text}`}>Checkout rápido</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Garanta seu espaço agora. Personalize depois.</h1>
                <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed text-slate-600">Preencha os dados da compra e gere o PIX. Depois do pagamento aprovado, você coloca nome público, imagem e link.</p>

                {operationalSettings?.checkoutNotice && <div className="mt-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-black leading-relaxed text-yellow-900">{operationalSettings.checkoutNotice}</div>}
                {(operationalSettings?.maintenanceMode || operationalSettings?.blockNewPurchases) && <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-black leading-relaxed text-red-800">{operationalSettings?.maintenanceMode ? "O Mural29 está em manutenção no momento." : "Novas compras estão temporariamente bloqueadas."}</div>}
                {errorMessage && <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-black leading-relaxed text-red-800">{errorMessage}</div>}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Nome completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome completo" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                  <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                  <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">WhatsApp</span><input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))} placeholder="(35) 99999-9999" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                  <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">CPF</span><input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                </div>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Depois do PIX aprovado</p>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-3">
                    <p>✅ Nome público</p>
                    <p>✅ Upload da imagem</p>
                    <p>✅ Link público</p>
                  </div>
                </div>

                <label className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-5 w-5 rounded border-slate-300" />
                  <span>Aceito os <Link href="/termos" className="font-black text-slate-950 underline">Termos de Uso</Link> e entendo que meu espaço entra no mural após o PIX aprovado.</span>
                </label>

                <button type="button" onClick={handleGeneratePix} disabled={isLoading || !acceptedTerms || (mustBeRectangle && !isRectangle)} className={`pixel-btn ${theme.button} mt-5 w-full !rounded-2xl !py-4 !text-sm disabled:cursor-not-allowed disabled:opacity-60`}>
                  {isLoading ? "Gerando PIX..." : "Gerar PIX e garantir meu espaço"}
                </button>
              </div>
            )}

            {step === "pix" && pixResult && (
              <div className="mt-6">
                <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-green-700">PIX criado</p>
                  <h1 className="mt-2 text-2xl font-black text-green-950">Pague o PIX para garantir seus tijolinhos.</h1>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-green-800">Depois da aprovação, a personalização aparece na próxima etapa.</p>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
                  {pixResult.pix.qrCodeBase64 && <div className="rounded-3xl bg-white p-4 text-center shadow"><img src={getQrImageSrc(pixResult.pix.qrCodeBase64)} alt="QR Code PIX" className="mx-auto h-64 w-64 rounded-2xl" /></div>}
                  <div>
                    {pixResult.pix.qrCode && <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">PIX copia e cola</p><textarea readOnly value={pixResult.pix.qrCode} rows={7} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700" /><button type="button" onClick={handleCopyPix} className="pixel-btn pixel-btn--dark mt-3 w-full !rounded-2xl !py-3 !text-sm">Copiar código PIX</button>{copyMessage && <p className="mt-2 text-center text-xs font-black text-green-700">{copyMessage}</p>}</div>}
                    <button type="button" onClick={handleCheckPayment} disabled={isCheckingPayment} className="pixel-btn pixel-btn--green mt-5 w-full !rounded-2xl !py-4 !text-sm disabled:cursor-not-allowed disabled:opacity-60">{isCheckingPayment ? "Verificando..." : "Já paguei, verificar pagamento"}</button>
                    {verifyMessage && <div className={`mt-4 rounded-3xl p-4 text-sm font-black ${paymentApproved ? "bg-emerald-50 text-emerald-800" : "bg-yellow-50 text-yellow-800"}`}>{verifyMessage}</div>}
                  </div>
                </div>
              </div>
            )}

            {step === "customize" && pixResult && (
              <div className="mt-6">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Pagamento confirmado</p>
                  <h1 className="mt-2 text-2xl font-black text-emerald-950">Agora personalize seu espaço.</h1>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-emerald-800">Seu tijolinho já é seu. Coloque nome, imagem e link para aparecer bonito no Mural29.</p>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white">
                      {imagePreview ? <img src={imagePreview} alt="Prévia" className="h-full w-full object-cover" /> : <span className="px-4 text-xs font-black text-slate-400">Prévia da imagem</span>}
                    </div>
                    <p className="mt-3 text-xs font-bold leading-relaxed text-slate-500">Use logo, foto ou arte simples. JPG, PNG ou WEBP.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Nome público</span><input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder="Nome que aparece no mural" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Link público</span><input value={publicLink} onChange={(event) => setPublicLink(event.target.value)} placeholder="https://instagram.com/meuusuario" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Imagem do mural</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-slate-950" /></label>
                    <button type="button" onClick={handleSavePersonalization} disabled={isSavingPersonalization || personalized} className="pixel-btn pixel-btn--green w-full !rounded-2xl !py-4 !text-sm disabled:cursor-not-allowed disabled:opacity-60">{isSavingPersonalization ? "Salvando..." : personalized ? "Personalização salva" : "Salvar e publicar no mural"}</button>
                    {personalizationMessage && <div className={`rounded-3xl p-4 text-sm font-black ${personalized ? "bg-emerald-50 text-emerald-800" : "bg-yellow-50 text-yellow-800"}`}>{personalizationMessage}</div>}
                    {personalized && <div className="grid gap-2 sm:grid-cols-2"><Link href="/" className="pixel-btn pixel-btn--dark justify-center !rounded-2xl !py-3 !text-xs">Ver no mural</Link>{pixResult.managementUrl && <a href={pixResult.managementUrl} className="pixel-btn pixel-btn--gold justify-center !rounded-2xl !py-3 !text-xs">Guardar link de edição</a>}</div>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] bg-white p-5 shadow-xl lg:sticky lg:top-5">
            <div className={`rounded-3xl border ${theme.border} ${theme.bg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Seu espaço</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{getCategoryLabel(category)}</h2>
                </div>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase text-slate-700">{theme.label}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-600">{selectedBlocks.length} tijolinho(s) selecionado(s)</p>
              <p className="mt-3 rounded-2xl bg-white/80 p-3 text-xs font-bold leading-relaxed text-slate-600">{coordinates}{extraCoordinates}</p>
              {mustBeRectangle && !isRectangle && <p className="mt-3 rounded-2xl bg-yellow-100 p-3 text-xs font-black text-yellow-800">Selecione uma área retangular para a imagem ficar bem encaixada.</p>}
            </div>

            <div className="mt-4 space-y-3 rounded-3xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm"><span className="font-bold text-slate-600">Tijolinhos</span><span className="font-black text-slate-950">{money(subtotalCents)}</span></div>
              {operationalFeeCents > 0 && <div className="flex justify-between text-sm"><span className="font-bold text-slate-600">Taxa operacional</span><span className="font-black text-slate-950">{money(operationalFeeCents)}</span></div>}
              <div className="border-t border-slate-200 pt-3"><div className="flex justify-between"><span className="font-black text-slate-950">Total PIX</span><span className="text-xl font-black text-slate-950">{money(totalCents)}</span></div></div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-xs font-bold leading-relaxed text-slate-500">
              <p className="font-black uppercase tracking-wide text-slate-700">Compra rápida</p>
              <p className="mt-2">Primeiro você paga. Depois personaliza com nome, imagem e link.</p>
              <p className="mt-2">PIX via Mercado Pago. Dados privados não aparecem no mural.</p>
              <p className="mt-2">Reserva estimada: {reservationMinutes} minutos.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
