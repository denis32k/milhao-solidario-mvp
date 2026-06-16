"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BuyableCategory = "SOLIDARITY" | "PREMIUM";
type CheckoutStep = "data" | "pix";

type SelectedBlock = {
  gridX: number;
  gridY: number;
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
};

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
  if (qrCodeBase64.startsWith("data:")) {
    return qrCodeBase64;
  }

  return `data:image/png;base64,${qrCodeBase64}`;
}

function parseBlocksFromQuery(value: string | null) {
  if (!value) {
    return [];
  }

  const unique = new Map<string, SelectedBlock>();

  for (const part of value.split(",")) {
    const [xRaw, yRaw] = part.split(":");
    const gridX = Number(xRaw);
    const gridY = Number(yRaw);

    if (
      Number.isInteger(gridX) &&
      Number.isInteger(gridY) &&
      gridX >= 0 &&
      gridX <= 199 &&
      gridY >= 0 &&
      gridY <= 144
    ) {
      unique.set(`${gridX}:${gridY}`, { gridX, gridY });
    }
  }

  return Array.from(unique.values());
}

function getCategoryLabel(category: BuyableCategory) {
  return category === "PREMIUM" ? "Premium" : "Mosaico";
}

function getUnitPrice(category: BuyableCategory) {
  return category === "PREMIUM" ? 10000 : 1000;
}

export default function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStep>("data");
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [category, setCategory] = useState<BuyableCategory>("SOLIDARITY");

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const blocks = parseBlocksFromQuery(params.get("blocks"));
    const categoryParam = String(params.get("category") || "SOLIDARITY").toUpperCase();

    setSelectedBlocks(blocks);

    if (categoryParam === "PREMIUM") {
      setCategory("PREMIUM");
    } else {
      setCategory("SOLIDARITY");
    }
  }, []);

  const unitPriceCents = getUnitPrice(category);

  const subtotalCents = useMemo(() => {
    return unitPriceCents * selectedBlocks.length;
  }, [unitPriceCents, selectedBlocks.length]);

  const operationalFeeCents = useMemo(() => {
    return Math.ceil(subtotalCents * 0.1);
  }, [subtotalCents]);

  const totalCents = subtotalCents + operationalFeeCents;

  async function handleGeneratePix() {
    try {
      setPixResult(null);
      setCopyMessage("");
      setVerifyMessage("");
      setPaymentApproved(false);

      if (selectedBlocks.length === 0) {
        alert("Volte ao grid e selecione pelo menos um bloco.");
        return;
      }

      if (!fullName.trim() || fullName.trim().length < 3) {
        alert("Digite o nome completo.");
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

      if (category === "PREMIUM" && !title.trim()) {
        alert("Digite um título para o bloco Premium.");
        return;
      }

      setIsLoading(true);

      const response = await fetch("/api/mercado-pago-pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          whatsapp: whatsappDigits,
          cpf: cpfDigits,
          selectedBlocks,
          title,
          description,
          redirectUrl,
          imageUrl,
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
        throw new Error(
          data.message || data.error || "Erro ao criar PIX no Mercado Pago."
        );
      }

      setPixResult({
        payment: data.payment,
        pix: data.pix,
        transaction: data.transaction,
        blocks: data.blocks,
      });

      setStep("pix");
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Erro inesperado ao gerar PIX.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPix() {
    if (!pixResult?.pix.qrCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pixResult.pix.qrCode);
      setCopyMessage("Código PIX copiado!");
    } catch {
      setCopyMessage(
        "Não consegui copiar automaticamente. Selecione e copie manualmente."
      );
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
        `/api/mercado-pago-pix/webhook?type=payment&data.id=${encodeURIComponent(
          paymentId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
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

      const message =
        result.message ||
        nestedResult.message ||
        data.message ||
        "Consulta realizada.";

      const isApproved =
        mercadoPagoStatus === "approved" || transactionStatus === "APPROVED";

      if (isApproved) {
        setPaymentApproved(true);
        setVerifyMessage(
          "Pagamento aprovado! Seus blocos já foram marcados como vendidos."
        );
        return;
      }

      setPaymentApproved(false);
      setVerifyMessage(
        message ||
          "Pagamento ainda não aprovado. Se você acabou de pagar, aguarde alguns segundos e tente novamente."
      );
    } catch (error) {
      setPaymentApproved(false);

      if (error instanceof Error) {
        setVerifyMessage(error.message);
      } else {
        setVerifyMessage("Erro inesperado ao verificar pagamento.");
      }
    } finally {
      setIsCheckingPayment(false);
    }
  }

  if (selectedBlocks.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
          <div className="text-5xl">🧩</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">
            Selecione os blocos primeiro
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Volte ao grid, toque nos blocos desejados e depois continue para o checkout.
          </p>
          <Link
            href="/"
            className="mt-5 block rounded-2xl bg-green-600 py-4 text-sm font-black text-white shadow-lg"
          >
            Voltar ao grid
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow"
        >
          ← Voltar ao grid
        </Link>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-orange-500">
            Pagamento via PIX
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-950">
            Finalizar compra
          </h1>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <div className="rounded-2xl bg-green-500 p-3 text-white">
              1. Blocos
            </div>
            <div
              className={`rounded-2xl p-3 ${
                step === "data" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              2. Dados
            </div>
            <div
              className={`rounded-2xl p-3 ${
                step === "pix" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              3. PIX
            </div>
          </div>

          {step === "data" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-black uppercase text-green-700">
                  Blocos selecionados
                </p>
                <h2 className="mt-1 text-xl font-black text-green-950">
                  {selectedBlocks.length} bloco(s) — {getCategoryLabel(category)}
                </h2>
                <p className="mt-1 text-xs font-bold text-green-700">
                  {selectedBlocks.map((block) => `x${block.gridX}/y${block.gridY}`).join(" • ")}
                </p>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Nome completo
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Digite seu nome"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  WhatsApp
                </span>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))}
                  placeholder="(35) 99999-9999"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  CPF
                </span>
                <input
                  type="text"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  O CPF não aparece publicamente no mapa.
                </p>
              </label>

              {category === "PREMIUM" && (
                <div className="space-y-4 rounded-3xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                    Dados Premium
                  </p>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Título do bloco
                    </span>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex: Minha marca apoiando essa causa"
                      className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-orange-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Descrição
                    </span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Escreva uma pequena descrição"
                      rows={3}
                      className="mt-2 w-full resize-none rounded-2xl border border-orange-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-orange-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Link de redirecionamento
                    </span>
                    <input
                      type="url"
                      value={redirectUrl}
                      onChange={(event) => setRedirectUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-orange-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-orange-700">
                      URL da imagem
                    </span>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-orange-500"
                    />
                    <p className="mt-2 text-xs font-semibold text-orange-700">
                      Upload direto será lapidado depois. Por enquanto pode usar URL de imagem.
                    </p>
                  </label>
                </div>
              )}

              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-600">
                    Valor principal dos blocos
                  </span>
                  <span className="font-black text-slate-950">
                    {money(subtotalCents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-600">
                    Taxa operacional e tributária 10%
                  </span>
                  <span className="font-black text-slate-950">
                    {money(operationalFeeCents)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-black text-slate-950">Total PIX</span>
                    <span className="text-xl font-black text-slate-950">
                      {money(totalCents)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePix}
                disabled={isLoading}
                className="w-full rounded-2xl bg-orange-500 py-4 text-sm font-extrabold text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Gerando PIX..." : "Gerar PIX Mercado Pago"}
              </button>
            </div>
          )}

          {step === "pix" && pixResult && (
            <div className="mt-6">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-green-700">
                  PIX criado com sucesso
                </p>
                <h2 className="mt-2 text-xl font-black text-green-950">
                  Blocos reservados
                </h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-green-800">
                  {pixResult.blocks.length} bloco(s) reservado(s)
                </p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-green-700">
                  Pagamento: #{pixResult.payment.id}
                </p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-green-700">
                  Status inicial: {pixResult.payment.status}
                </p>
              </div>

              {paymentApproved && (
                <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-3xl">✅</div>
                  <h2 className="mt-2 text-xl font-black text-emerald-950">
                    Pagamento confirmado
                  </h2>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-emerald-800">
                    Seus blocos já entraram no Milhão Solidário.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/"
                      className="rounded-2xl bg-emerald-600 py-3 text-center text-xs font-black text-white"
                    >
                      Ver no mapa
                    </Link>
                    <Link
                      href="/ranking"
                      className="rounded-2xl bg-slate-950 py-3 text-center text-xs font-black text-white"
                    >
                      Ver ranking
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                {pixResult.pix.qrCodeBase64 && (
                  <div>
                    <img
                      src={getQrImageSrc(pixResult.pix.qrCodeBase64)}
                      alt="QR Code PIX"
                      className="mx-auto h-56 w-56 rounded-2xl bg-white p-3 shadow"
                    />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      Escaneie o QR Code pelo app do banco
                    </p>
                  </div>
                )}

                {pixResult.pix.ticketUrl && (
                  <a
                    href={pixResult.pix.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white"
                  >
                    Abrir pagamento no Mercado Pago
                  </a>
                )}

                {pixResult.pix.qrCode && (
                  <div className="mt-4">
                    <label className="block text-left">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        PIX copia e cola
                      </span>
                      <textarea
                        value={pixResult.pix.qrCode}
                        readOnly
                        rows={5}
                        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 outline-none"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="mt-3 w-full rounded-2xl bg-green-600 py-4 text-sm font-extrabold text-white shadow-lg active:scale-95"
                    >
                      Copiar código PIX
                    </button>

                    {copyMessage && (
                      <p className="mt-2 text-xs font-black text-green-700">
                        {copyMessage}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleCheckPayment}
                      disabled={isCheckingPayment}
                      className="mt-3 w-full rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCheckingPayment
                        ? "Verificando pagamento..."
                        : "Já paguei, verificar pagamento"}
                    </button>

                    {verifyMessage && (
                      <p
                        className={`mt-3 rounded-2xl p-3 text-xs font-black ${
                          paymentApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {verifyMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
