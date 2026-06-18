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
  block?: { id: string; gridX: number; gridY: number };
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

function getCategoryLabel(category: BuyableCategory) {
  return getAreaName(category);
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
  const [managementCopyMessage, setManagementCopyMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [operationalSettings, setOperationalSettings] = useState<OperationalClientSettings | null>(null);
  const [isCheckoutReady, setIsCheckoutReady] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState("");

  useEffect(() => {
    fetch("/api/mercado-pago-pix", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) setOperationalSettings(data.settings);
      })
      .catch(() => null);

    try {
      setRecoveryLink(localStorage.getItem("mural29:lastManagementUrl") || "");
    } catch {
      setRecoveryLink("");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedBlocks(parseBlocksFromQuery(params.get("blocks")));
    const categoryParam = String(params.get("category") || "SOLIDARITY").toUpperCase();
    if (categoryParam === "GRAND_CENTER") setCategory("GRAND_CENTER");
    else if (categoryParam === "GOLD") setCategory("GOLD");
    else if (categoryParam === "PREMIUM") setCategory("PREMIUM");
    else setCategory("SOLIDARITY");
    setIsCheckoutReady(true);
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


  function getManagementHref(result: PixResult | null = pixResult) {
    const raw = result?.managementUrl || result?.managementPath || "";
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (typeof window === "undefined") return raw;
    return `${window.location.origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  function rememberManagementLink(result: PixResult) {
    const href = getManagementHref(result);
    if (!href) return;
    try {
      localStorage.setItem("mural29:lastManagementUrl", href);
      localStorage.setItem("mural29:lastTransactionId", result.transaction.id);
      setRecoveryLink(href);
    } catch {
      // Se o navegador bloquear localStorage, o link ainda aparece na tela para copiar.
    }
  }

  async function handleCopyManagementLink() {
    const href = getManagementHref();
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setManagementCopyMessage("Link salvo/copiado. Se sair da tela, volte por ele para personalizar.");
    } catch {
      setManagementCopyMessage("Não consegui copiar automaticamente. Toque e segure no link para copiar.");
    }
  }

  async function checkPaymentApproval(silent = false) {
    if (!pixResult?.payment.id) {
      if (!silent) setVerifyMessage("Gere o PIX primeiro.");
      return false;
    }

    try {
      if (!silent) setIsCheckingPayment(true);
      if (!silent) setVerifyMessage("");

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
        return true;
      }

      if (!silent) setVerifyMessage("Pagamento ainda não aprovado. Aguarde alguns segundos e tente novamente.");
      return false;
    } catch (error) {
      if (!silent) {
        setPaymentApproved(false);
        setVerifyMessage(error instanceof Error ? error.message : "Erro inesperado ao verificar pagamento.");
      }
      return false;
    } finally {
      if (!silent) setIsCheckingPayment(false);
    }
  }

  useEffect(() => {
    if (step !== "pix" || paymentApproved || !pixResult?.payment.id) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await checkPaymentApproval(true);
    };

    const firstCheck = window.setTimeout(run, 2500);
    const interval = window.setInterval(run, 4500);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, [step, paymentApproved, pixResult?.payment.id]);

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

      const nextResult: PixResult = { payment: data.payment, pix: data.pix, transaction: data.transaction, blocks: data.blocks || [], block: data.block, managementPath: data.managementPath, managementUrl: data.managementUrl };
      setPixResult(nextResult);
      rememberManagementLink(nextResult);
      setManagementCopyMessage("");
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
    await checkPaymentApproval(false);
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
      setPersonalizationMessage("Personalização salva. Vamos abrir o mural no espaço comprado.");

      const primaryBlockId = data.primaryBlockId || pixResult.block?.id || pixResult.blocks?.[0]?.id;
      const muralPath = data.muralPath || (primaryBlockId ? `/?bloco=${encodeURIComponent(primaryBlockId)}&publicado=1` : "/");
      window.setTimeout(() => {
        window.location.href = muralPath;
      }, 700);
    } catch (error) {
      setPersonalizationMessage(error instanceof Error ? error.message : "Erro inesperado ao salvar personalização.");
    } finally {
      setIsSavingPersonalization(false);
    }
  }

  if (!isCheckoutReady) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">Carregando checkout...</p>
        </div>
      </main>
    );
  }

  if (selectedBlocks.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl">🧱</div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">Selecione os tijolinhos primeiro</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Volte ao mural, toque nos espaços desejados e continue para gerar o PIX.</p>
          <div className="mt-5 grid gap-2">
            <Link href="/" className="flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Voltar ao mural</Link>
            {recoveryLink && <a href={recoveryLink} className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50">Continuar compra anterior</a>}
          </div>
          {recoveryLink && <p className="mt-3 text-xs leading-relaxed text-slate-500">Encontramos um link salvo neste aparelho. Ele permite voltar para personalizar depois do pagamento aprovado.</p>}
        </div>
      </main>
    );
  }

  const coordinates = selectedBlocks.slice(0, 12).map((block) => `x${block.gridX}/y${block.gridY}`).join(" • ");
  const extraCoordinates = selectedBlocks.length > 12 ? ` +${selectedBlocks.length - 12}` : "";
  const steps: Array<{ key: CheckoutStep; label: string }> = [
    { key: "data", label: "Dados" },
    { key: "pix", label: "PIX" },
    { key: "customize", label: "Personalizar" },
  ];
  const stepIndex = Math.max(0, steps.findIndex((item) => item.key === step));
  const generatePixDisabled = isLoading || !acceptedTerms || (mustBeRectangle && !isRectangle) || Boolean(operationalSettings?.maintenanceMode || operationalSettings?.blockNewPurchases);
  const displayTotalCents = pixResult?.transaction.totalPaidCents ?? totalCents;

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 pb-28 sm:px-4 lg:py-6 lg:pb-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">← Voltar ao mural</Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">Checkout seguro</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between gap-2">
                {steps.map((item, index) => {
                  const isActive = item.key === step;
                  const isDone = index < stepIndex;
                  return (
                    <div key={item.key} className="flex min-w-0 flex-1 items-center gap-2">
                      <div className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-[11px] font-semibold transition ${isActive ? "bg-slate-950 text-white shadow-sm" : isDone ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-500"}`}>
                        <span className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[10px]">{isDone ? "✓" : index + 1}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {index < steps.length - 1 && <span className="hidden h-px w-3 bg-slate-200 sm:block" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {step === "data" && (
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.bg} ${theme.text}`}>Checkout rápido</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Etapa 1 de 3</span>
                </div>
                <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Finalize sua reserva</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Complete os dados para gerar o PIX. Depois da aprovação, você adiciona nome público, imagem e link.</p>

                {operationalSettings?.checkoutNotice && <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-medium leading-relaxed text-yellow-900">{operationalSettings.checkoutNotice}</div>}
                {(operationalSettings?.maintenanceMode || operationalSettings?.blockNewPurchases) && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium leading-relaxed text-red-800">{operationalSettings?.maintenanceMode ? "O Mural29 está em manutenção no momento." : "Novas compras estão temporariamente bloqueadas."}</div>}
                {errorMessage && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium leading-relaxed text-red-800">{errorMessage}</div>}

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">Nome completo</span>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome completo" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">E-mail</span>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">WhatsApp</span>
                    <input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))} placeholder="(35) 99999-9999" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">CPF</span>
                    <input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                  </label>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 text-xs font-medium text-slate-600 sm:grid-cols-3">
                    <p className="flex items-center gap-2"><span className="text-emerald-600">●</span> PIX via Mercado Pago</p>
                    <p className="flex items-center gap-2"><span className="text-emerald-600">●</span> Dados privados protegidos</p>
                    <p className="flex items-center gap-2"><span className="text-emerald-600">●</span> Personalização após pagar</p>
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium leading-relaxed text-slate-600">
                  <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950" />
                  <span>Aceito os <Link href="/termos" className="font-semibold text-slate-950 underline underline-offset-2">Termos de Uso</Link> e entendo que meu espaço entra no mural após o PIX aprovado.</span>
                </label>

                <button type="button" onClick={handleGeneratePix} disabled={generatePixDisabled} className="mt-4 hidden h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:flex">
                  {isLoading ? "Gerando PIX..." : "Gerar PIX"}
                </button>
              </div>
            )}

            {step === "pix" && pixResult && (
              <div className="mt-5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">PIX criado</p>
                  <h1 className="mt-1 text-xl font-bold tracking-tight text-emerald-950">Pague para confirmar sua reserva</h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">Use o QR Code ou copie o código. A confirmação é verificada automaticamente a cada poucos segundos.</p>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
                  {pixResult.pix.qrCodeBase64 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                      <img src={getQrImageSrc(pixResult.pix.qrCodeBase64)} alt="QR Code PIX" className="mx-auto h-56 w-56 rounded-xl sm:h-64 sm:w-64" />
                      <p className="mt-2 text-xs font-medium text-slate-500">Escaneie com o app do seu banco.</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {pixResult.pix.qrCode && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">PIX copia e cola</p>
                        <textarea readOnly value={pixResult.pix.qrCode} rows={6} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-600 outline-none" />
                        <button type="button" onClick={handleCopyPix} className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50">Copiar código PIX</button>
                        {copyMessage && <p className="mt-2 text-center text-xs font-semibold text-emerald-700">{copyMessage}</p>}
                      </div>
                    )}
                    {getManagementHref() && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-900">Link seguro da compra</p>
                        <p className="mt-1 text-xs leading-relaxed text-blue-800">Se fechar esta tela sem querer, volte por este link para acompanhar o pagamento e personalizar depois.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <a href={getManagementHref()} className="flex h-10 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-blue-900 shadow-sm ring-1 ring-blue-200">Abrir área do comprador</a>
                          <button type="button" onClick={handleCopyManagementLink} className="flex h-10 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm">Copiar link</button>
                        </div>
                        {managementCopyMessage && <p className="mt-2 text-xs font-semibold text-blue-900">{managementCopyMessage}</p>}
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-500">
                      Verificação automática ativa. Se o Mercado Pago demorar, você também pode tocar no botão abaixo.
                    </div>
                    <button type="button" onClick={handleCheckPayment} disabled={isCheckingPayment} className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isCheckingPayment ? "Verificando..." : "Já paguei, verificar pagamento"}</button>
                    {verifyMessage && <div className={`rounded-2xl border p-3 text-sm font-medium ${paymentApproved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-yellow-200 bg-yellow-50 text-yellow-800"}`}>{verifyMessage}</div>}
                  </div>
                </div>
              </div>
            )}

            {step === "customize" && pixResult && (
              <div className="mt-5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">Pagamento confirmado</p>
                  <h1 className="mt-1 text-xl font-bold tracking-tight text-emerald-950">Personalize seu espaço</h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">Seu tijolinho já é seu. Agora coloque nome público, imagem e link.</p>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[200px_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {imagePreview ? <img src={imagePreview} alt="Prévia" className="h-full w-full object-cover" /> : <span className="px-4 text-xs font-semibold text-slate-400">Prévia da imagem</span>}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">Use logo, foto ou arte simples. JPG, PNG ou WEBP.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">Nome público</span>
                      <input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder="Nome que aparece no mural" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">Link público</span>
                      <input value={publicLink} onChange={(event) => setPublicLink(event.target.value)} placeholder="https://instagram.com/meuusuario" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">Imagem do mural</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-600 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-slate-950 focus:ring-4 focus:ring-slate-100" />
                    </label>
                    <button type="button" onClick={handleSavePersonalization} disabled={isSavingPersonalization || personalized} className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingPersonalization ? "Salvando..." : personalized ? "Personalização salva" : "Salvar e publicar"}</button>
                    {personalizationMessage && <div className={`rounded-2xl border p-3 text-sm font-medium ${personalized ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-yellow-200 bg-yellow-50 text-yellow-800"}`}>{personalizationMessage}</div>}
                    {personalized && <div className="grid gap-2 sm:grid-cols-2"><Link href="/" className="flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800">Ver no mural</Link>{pixResult.managementUrl && <a href={pixResult.managementUrl} className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50">Guardar link de edição</a>}</div>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="order-first rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:order-none lg:sticky lg:top-5">
            <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${theme.text}`}>Seu espaço</p>
                  <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-slate-950">{getCategoryLabel(category)}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-600 ring-1 ring-black/5">{theme.label}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-600">{selectedBlocks.length} tijolinho(s) selecionado(s)</p>
              <p className="mt-3 max-h-16 overflow-hidden rounded-xl bg-white/80 p-2.5 text-[11px] font-medium leading-relaxed text-slate-500 ring-1 ring-black/5">{coordinates}{extraCoordinates}</p>
              {mustBeRectangle && !isRectangle && <p className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-2.5 text-xs font-semibold text-yellow-800">Selecione uma área retangular para a imagem ficar bem encaixada.</p>}
            </div>

            <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex justify-between text-sm"><span className="font-medium text-slate-500">Tijolinhos</span><span className="font-semibold text-slate-950">{money(subtotalCents)}</span></div>
              {operationalFeeCents > 0 && <div className="flex justify-between text-sm"><span className="font-medium text-slate-500">Taxa operacional</span><span className="font-semibold text-slate-950">{money(operationalFeeCents)}</span></div>}
              <div className="border-t border-slate-200 pt-2"><div className="flex items-end justify-between gap-3"><span className="font-semibold text-slate-700">Total PIX</span><span className="text-xl font-bold tracking-tight text-slate-950">{money(displayTotalCents)}</span></div></div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-500">
              <p className="font-semibold text-slate-700">Compra rápida e segura</p>
              <p className="mt-1.5">Primeiro você paga. Depois personaliza com nome, imagem e link.</p>
              <p className="mt-1.5">PIX via Mercado Pago. Dados privados não aparecem no mural.</p>
              <p className="mt-1.5">Reserva estimada: {reservationMinutes} minutos.</p>
            </div>
          </aside>
        </div>
      </div>

      {step === "data" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-500">Total no PIX</p>
              <p className="truncate text-lg font-bold tracking-tight text-slate-950">{money(totalCents)}</p>
            </div>
            <button type="button" onClick={handleGeneratePix} disabled={generatePixDisabled} className="flex h-11 min-w-[128px] items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? "Gerando..." : "Gerar PIX"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
