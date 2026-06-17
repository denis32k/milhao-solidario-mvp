"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GRID_COLS, GRID_ROWS } from "@/lib/grid";
import { getAreaName, getAreaPriceCents, getOperationalFeeCents, siteConfig } from "@/lib/site-config";

type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
type CheckoutStep = "data" | "pix";

type SelectedBlock = {
  gridX: number;
  gridY: number;
};


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
  payment: {
    id: string | number;
    status: string;
    statusDetail: string;
  };
  pix: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    ticketUrl: string | null;
  };
  transaction: {
    id: string;
    subtotalCents?: number;
    operatorFeeCents?: number;
    totalPaidCents: number;
  };
  blocks: Array<{
    id: string;
    gridX: number;
    gridY: number;
    category: string;
    priceCents: number;
  }>;
  managementPath?: string;
  managementUrl?: string;
};

const SOLIDARITY_COLORS = siteConfig.mosaicColors;

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatWhatsApp(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
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

    if (
      Number.isInteger(gridX) &&
      Number.isInteger(gridY) &&
      gridX >= 0 &&
      gridX < GRID_COLS &&
      gridY >= 0 &&
      gridY < GRID_ROWS
    ) {
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

function getUnitPrice(category: BuyableCategory) {
  return getAreaPriceCents(category);
}


async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) return file;

  return new Promise<File>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxSide = 1400;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(file);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], `imagem-premium-${Date.now()}.jpg`, {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        0.84
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    image.src = objectUrl;
  });
}

function getCategoryTheme(category: BuyableCategory) {
  if (category === "GRAND_CENTER") {
    return {
      border: "border-fuchsia-300",
      bg: "bg-fuchsia-50",
      text: "text-fuchsia-800",
      button: "bg-fuchsia-600",
      buttonText: "text-white",
    };
  }

  if (category === "GOLD") {
    return {
      border: "border-yellow-300",
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      button: "bg-yellow-500",
      buttonText: "text-yellow-950",
    };
  }

  if (category === "PREMIUM") {
    return {
      border: "border-orange-200",
      bg: "bg-orange-50",
      text: "text-orange-700",
      button: "bg-orange-500",
      buttonText: "text-white",
    };
  }

  return {
    border: "border-green-200",
    bg: "bg-green-50",
    text: "text-green-700",
    button: "bg-green-600",
    buttonText: "text-white",
  };
}

export default function CompraPage() {
  const [step, setStep] = useState<CheckoutStep>("data");
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [category, setCategory] = useState<BuyableCategory>("SOLIDARITY");

  const [fullName, setFullName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");

  const [description, setDescription] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [fillColor, setFillColor] = useState(SOLIDARITY_COLORS[0].value);

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
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
    const blocks = parseBlocksFromQuery(params.get("blocks"));
    const categoryParam = String(params.get("category") || "SOLIDARITY").toUpperCase();

    setSelectedBlocks(blocks);

    if (categoryParam === "GRAND_CENTER") {
      setCategory("GRAND_CENTER");
    } else if (categoryParam === "GOLD") {
      setCategory("GOLD");
    } else if (categoryParam === "PREMIUM") {
      setCategory("PREMIUM");
    } else {
      setCategory("SOLIDARITY");
    }
  }, []);

  const unitPriceCents = getUnitPrice(category);
  const subtotalCents = useMemo(() => unitPriceCents * selectedBlocks.length, [unitPriceCents, selectedBlocks.length]);
  const operationalFeeCents = useMemo(() => getOperationalFeeCents(subtotalCents), [subtotalCents]);
  const totalCents = subtotalCents + operationalFeeCents;
  const theme = getCategoryTheme(category);
  const requiresImageShape = category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER";
  const isRectangle = blocksFormRectangle(selectedBlocks);

  async function uploadImageIfNeeded() {
    if (!imageFile) return imageUrl.trim();

    const formData = new FormData();
    const compressedFile = await compressImageFile(imageFile);
    formData.set("file", compressedFile);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Erro ao enviar imagem.");
    }

    setImageUrl(data.url);
    return String(data.url || "");
  }

  async function handleGeneratePix() {
    try {
      setPixResult(null);
      setCopyMessage("");
      setVerifyMessage("");
      setPaymentApproved(false);

      if (selectedBlocks.length === 0) {
        alert("Volte ao mural e selecione pelo menos um tijolinho.");
        return;
      }

      if (requiresImageShape && !isRectangle) {
        alert("Para áreas com imagem, selecione uma área retangular.");
        return;
      }

      if (!fullName.trim() || fullName.trim().length < 3) {
        alert("Digite o nome completo.");
        return;
      }

      const publicNameToSend = publicName.trim() || fullName.trim();

      if (publicNameToSend.length < 2) {
        alert("Digite o nome que vai aparecer no mural.");
        return;
      }

      const whatsappDigits = onlyDigits(whatsapp);

      if (whatsappDigits.length < 10) {
        alert("Digite um WhatsApp válido.");
        return;
      }

      const cpfDigits = onlyDigits(cpf);

      if (cpfDigits.length !== 11) {
        alert("Digite um CPF válido com 11 números.");
        return;
      }

      if (!acceptedTerms) {
        alert("Aceite os termos para gerar o PIX.");
        return;
      }

      if (operationalSettings?.maintenanceMode || operationalSettings?.blockNewPurchases) {
        alert(operationalSettings?.maintenanceMode ? "O Mural29 está em manutenção no momento." : "Novas compras estão temporariamente bloqueadas.");
        return;
      }

      if (redirectUrl.trim() && operationalSettings?.publicLinksEnabled === false) {
        alert("Links públicos estão temporariamente desativados.");
        return;
      }

      if (imageFile && operationalSettings?.uploadsEnabled === false) {
        alert("Uploads estão temporariamente desativados.");
        return;
      }

      setIsLoading(true);
      const finalImageUrl = await uploadImageIfNeeded();

      const response = await fetch("/api/mercado-pago-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          publicName: publicNameToSend,
          whatsapp: whatsappDigits,
          cpf: cpfDigits,
          selectedBlocks,
          title: publicNameToSend,
          description,
          redirectUrl,
          imageUrl: finalImageUrl,
          fillColor,
          acceptedTerms,
        }),
      });

      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(responseText || "Resposta inválida do servidor.");
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || "Erro ao criar PIX no Mercado Pago.");
      }

      setPixResult({
        payment: data.payment,
        pix: data.pix,
        transaction: data.transaction,
        blocks: data.blocks,
        managementPath: data.managementPath,
        managementUrl: data.managementUrl,
      });

      setStep("pix");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro inesperado ao gerar PIX.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPix() {
    if (!pixResult?.pix.qrCode) return;

    try {
      await navigator.clipboard.writeText(pixResult.pix.qrCode);
      setCopyMessage("Código PIX copiado!");
    } catch {
      setCopyMessage("Não consegui copiar automaticamente. Selecione e copie manualmente.");
    }
  }

  async function handleCheckPayment() {
    try {
      if (!pixResult?.payment.id) {
        alert("Gere o PIX primeiro.");
        return;
      }

      setIsCheckingPayment(true);
      setVerifyMessage("");
      setPaymentApproved(false);

      const paymentId = String(pixResult.payment.id);
      const response = await fetch(
        `/api/mercado-pago-pix/webhook?type=payment&data.id=${encodeURIComponent(paymentId)}`,
        { method: "GET", cache: "no-store" }
      );

      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(responseText || "Resposta inválida do servidor.");
      }

      const result = data.result || {};
      const nestedResult = result.result || {};
      const mercadoPagoStatus = String(
        result.mercadoPagoStatus ||
          result.paymentStatus ||
          result.status ||
          nestedResult.mercadoPagoStatus ||
          nestedResult.paymentStatus ||
          nestedResult.status ||
          ""
      ).toLowerCase();
      const transactionStatus = String(
        result.transactionStatus ||
          nestedResult.transactionStatus ||
          result.status ||
          nestedResult.status ||
          ""
      ).toUpperCase();

      const isApproved = mercadoPagoStatus === "approved" || transactionStatus === "APPROVED";

      if (isApproved) {
        setPaymentApproved(true);
        setVerifyMessage("Pagamento aprovado! Seus tijolinhos já foram marcados como vendidos.");
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

  if (selectedBlocks.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🧩</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">Selecione os tijolinhos primeiro</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Volte ao mural, toque nos tijolinhos desejados e depois continue para o checkout.
          </p>
          <Link href="/" className="mt-5 block rounded-2xl bg-green-600 py-4 text-sm font-black text-white shadow-lg">
            Voltar ao mural
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">
          ← Voltar ao mural
        </Link>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>
            Compra {getCategoryLabel(category)}
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{siteConfig.copy.checkoutTitle}</h1>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
            <div className="rounded-2xl bg-green-500 p-3 text-white">1. Tijolinhos</div>
            <div className={`rounded-2xl p-3 ${step === "data" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"}`}>2. Dados</div>
            <div className={`rounded-2xl p-3 ${step === "pix" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"}`}>3. PIX</div>
          </div>

          {operationalSettings?.checkoutNotice && (
            <div className="mt-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-black leading-relaxed text-yellow-900">
              {operationalSettings?.checkoutNotice}
            </div>
          )}

          {(operationalSettings?.maintenanceMode || operationalSettings?.blockNewPurchases) && (
            <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-black leading-relaxed text-red-800">
              {operationalSettings?.maintenanceMode ? "O Mural29 está em manutenção no momento." : "Novas compras estão temporariamente bloqueadas."}
            </div>
          )}

          {step === "data" && (
            <div className="mt-6 space-y-4">
              <div className={`rounded-3xl border ${theme.border} ${theme.bg} p-4`}>
                <p className={`text-xs font-black uppercase ${theme.text}`}>Tijolinhos selecionados</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {selectedBlocks.length} tijolinho(s) — {getCategoryLabel(category)}
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-600">
                  {selectedBlocks.map((block) => `x${block.gridX}/y${block.gridY}`).join(" • ")}
                </p>
                {requiresImageShape && !isRectangle && (
                  <p className="mt-3 rounded-2xl bg-yellow-100 p-3 text-xs font-black text-yellow-800">
                    Para usar imagem, a área precisa formar um retângulo. Volte ao mural e complete os tijolinhos.
                  </p>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Nome completo</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    if (!publicName.trim()) setPublicName(event.target.value);
                  }}
                  placeholder="Digite seu nome completo"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">Esse dado fica privado no admin.</p>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Nome que vai aparecer no mural</span>
                <input
                  type="text"
                  value={publicName}
                  onChange={(event) => setPublicName(event.target.value)}
                  placeholder="Ex: Pessoa Fictícia, Marca Exemplo..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">WhatsApp</span>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))}
                  placeholder="(35) 99999-9999"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">O WhatsApp fica privado no admin.</p>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">CPF</span>
                <input
                  type="text"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">O CPF não aparece publicamente no mural.</p>
              </label>

              <div className={`space-y-4 rounded-3xl border ${theme.border} ${theme.bg} p-4`}>
                <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Informações públicas do tijolinho</p>

                <label className="block">
                  <span className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Link público</span>
                  <input
                    type="text"
                    value={redirectUrl}
                    onChange={(event) => setRedirectUrl(event.target.value)}
                    placeholder="https://instagram.com/meuusuario"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                  />
                </label>
                <p className="-mt-2 text-xs font-semibold text-slate-500">Use o link completo com https:// ou http://.</p>

                <label className="block">
                  <span className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Descrição curta</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value.slice(0, 180))}
                    placeholder="Escreva uma mensagem curta para aparecer no balãozinho"
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                  />
                  <p className="mt-2 text-right text-xs font-bold text-slate-500">{description.length}/180</p>
                </label>

                {category === "SOLIDARITY" && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-green-700">Cor do tijolinho</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {SOLIDARITY_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFillColor(color.value)}
                          className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-xs font-black ${fillColor === color.value ? "border-slate-950 bg-white" : "border-transparent bg-white/70"}`}
                        >
                          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color.value }} />
                          {color.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(
                  <div className="space-y-3">
                    <label className="block">
                      <span className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Imagem que aparecerá no mural</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                      />
                    </label>
                    <p className="text-xs font-bold text-slate-500">A imagem é compactada automaticamente antes do envio.</p>

                    <label className="block">
                      <span className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Ou URL de imagem</span>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                      />
                    </label>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300"
                />
                <span>
                  Aceito os <Link href="/termos" className="font-black text-slate-950 underline">Termos de Uso</Link> e entendo que, após o PIX aprovado, o conteúdo entra no mural automaticamente como publicado e ainda não revisado.
                </span>
              </label>

              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-600">Valor dos tijolinhos</span>
                  <span className="font-black text-slate-950">{money(subtotalCents)}</span>
                </div>
                {operationalFeeCents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-600">Taxa operacional</span>
                    <span className="font-black text-slate-950">{money(operationalFeeCents)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-black text-slate-950">Total PIX</span>
                    <span className="text-xl font-black text-slate-950">{money(totalCents)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePix}
                disabled={isLoading || !acceptedTerms || (requiresImageShape && !isRectangle)}
                className={`w-full rounded-2xl ${theme.button} py-4 text-sm font-extrabold ${theme.buttonText} shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isLoading ? "Gerando PIX..." : siteConfig.copy.pixButton}
              </button>
            </div>
          )}

          {step === "pix" && pixResult && (
            <div className="mt-6">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-green-700">PIX criado com sucesso</p>
                <h2 className="mt-2 text-xl font-black text-green-950">Tijolinhos reservados</h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-green-800">{pixResult.blocks.length} tijolinho(s) reservado(s)</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-green-700">Pagamento: #{pixResult.payment.id}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-green-700">Status inicial: {pixResult.payment.status}</p>
              </div>

              {paymentApproved && (
                <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-3xl">✅</div>
                  <h2 className="mt-2 text-xl font-black text-emerald-950">Pagamento confirmado</h2>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-emerald-800">Seus tijolinhos já entraram no mural.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Link href="/" className="rounded-2xl bg-emerald-600 py-3 text-center text-xs font-black text-white">Ver no mural</Link>
                    <Link href="/ranking" className="rounded-2xl bg-slate-950 py-3 text-center text-xs font-black text-white">Ver destaques</Link>
                    {(pixResult.managementUrl || pixResult.managementPath) && (
                      <a href={pixResult.managementUrl || pixResult.managementPath} className="rounded-2xl bg-yellow-400 py-3 text-center text-xs font-black text-yellow-950">Gerenciar conteúdo</a>
                    )}
                  </div>
                  {(pixResult.managementUrl || pixResult.managementPath) && (
                    <p className="mt-3 text-xs font-bold leading-relaxed text-emerald-800">Guarde este link para solicitar alterações futuras. Toda edição vai para análise antes de mudar o mural.</p>
                  )}
                </div>
              )}

              {pixResult.pix.qrCodeBase64 && (
                <div className="mt-5 rounded-3xl bg-white p-4 text-center shadow">
                  <img src={getQrImageSrc(pixResult.pix.qrCodeBase64)} alt="QR Code PIX" className="mx-auto h-64 w-64 rounded-2xl" />
                </div>
              )}

              {pixResult.pix.qrCode && (
                <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">PIX copia e cola</p>
                  <textarea readOnly value={pixResult.pix.qrCode} rows={5} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700" />
                  <button type="button" onClick={handleCopyPix} className="mt-3 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white">Copiar código PIX</button>
                  {copyMessage && <p className="mt-2 text-center text-xs font-black text-green-700">{copyMessage}</p>}
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckPayment}
                disabled={isCheckingPayment}
                className="mt-5 w-full rounded-2xl bg-green-600 py-4 text-sm font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingPayment ? "Verificando..." : "Já paguei, verificar pagamento"}
              </button>

              {verifyMessage && (
                <div className={`mt-4 rounded-3xl p-4 text-sm font-black ${paymentApproved ? "bg-emerald-50 text-emerald-800" : "bg-yellow-50 text-yellow-800"}`}>
                  {verifyMessage}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
