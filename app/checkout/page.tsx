"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CheckoutMode = "solidarity" | "premium";
type CheckoutStep = "area" | "data" | "pix";
type AreaCode =
  | "TOP_LEFT"
  | "TOP_CENTER"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_CENTER"
  | "BOTTOM_RIGHT"
  | "SURPRISE";

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
    totalPaidCents: number;
  };
  block: {
    id: string;
    gridX: number;
    gridY: number;
  };
};

const OPERATIONAL_FEE_PERCENT = 0.1;

const AREA_OPTIONS: Array<{ code: AreaCode; label: string; description: string }> = [
  { code: "TOP_LEFT", label: "Topo esquerdo", description: "Apareça no alto do mapa" },
  { code: "TOP_CENTER", label: "Topo centro", description: "Região mais visível do topo" },
  { code: "TOP_RIGHT", label: "Topo direito", description: "Canto superior direito" },
  { code: "BOTTOM_LEFT", label: "Baixo esquerdo", description: "Parte inferior esquerda" },
  { code: "BOTTOM_CENTER", label: "Baixo centro", description: "Região central de baixo" },
  { code: "BOTTOM_RIGHT", label: "Baixo direito", description: "Parte inferior direita" },
  { code: "SURPRISE", label: "Surpreenda-me", description: "O sistema escolhe um bloco livre" },
];

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

function getAreaLabel(area: AreaCode | "") {
  return AREA_OPTIONS.find((option) => option.code === area)?.label || "";
}

export default function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStep>("area");
  const [mode, setMode] = useState<CheckoutMode>("solidarity");
  const [quantity, setQuantity] = useState(1);

  const [selectedArea, setSelectedArea] = useState<AreaCode | "">("");
  const [selectedGridX, setSelectedGridX] = useState<number | null>(null);
  const [selectedGridY, setSelectedGridY] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const area = params.get("area") as AreaCode | null;
    const gridX = params.get("gridX");
    const gridY = params.get("gridY");

    if (area && AREA_OPTIONS.some((option) => option.code === area)) {
      setSelectedArea(area);
      setStep("data");
    }

    if (gridX && gridY) {
      const x = Number(gridX);
      const y = Number(gridY);

      if (Number.isFinite(x) && Number.isFinite(y)) {
        setSelectedGridX(x);
        setSelectedGridY(y);
      }
    }
  }, []);

  const unitPriceCents = mode === "solidarity" ? 1000 : 10000;

  const subtotalCents = useMemo(() => {
    return unitPriceCents * quantity;
  }, [unitPriceCents, quantity]);

  const operationalFeeCents = useMemo(() => {
    return Math.ceil(subtotalCents * OPERATIONAL_FEE_PERCENT);
  }, [subtotalCents]);

  const totalCents = subtotalCents + operationalFeeCents;

  function chooseArea(area: AreaCode) {
    setSelectedArea(area);
    setSelectedGridX(null);
    setSelectedGridY(null);
    setPixResult(null);
    setVerifyMessage("");
    setPaymentApproved(false);
    setStep("data");
  }

  async function handleGeneratePix() {
    try {
      setPixResult(null);
      setCopyMessage("");
      setVerifyMessage("");
      setPaymentApproved(false);

      if (!selectedArea) {
        alert("Escolha a área primeiro.");
        setStep("area");
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

      if (mode === "premium") {
        alert(
          "O PIX real está conectado primeiro no Mosaico Solidário. Depois vamos ligar o Premium com seleção de blocos, upload e link."
        );
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
          area: selectedArea,
          gridX: selectedGridX,
          gridY: selectedGridY,
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
        block: data.block,
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
          "Pagamento aprovado! Seu bloco já foi marcado como vendido."
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
            Reserve seu bloco
          </h1>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <div
              className={`rounded-2xl p-3 ${
                step === "area" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              1. Área
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

          {step === "area" && (
            <div className="mt-6">
              <h2 className="text-xl font-black text-slate-950">
                Escolha onde quer aparecer
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Toque em uma região. O sistema vai reservar um bloco disponível
                dentro dela.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3">
                {AREA_OPTIONS.map((area) => (
                  <button
                    key={area.code}
                    type="button"
                    onClick={() => chooseArea(area.code)}
                    className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-4 text-left transition active:scale-95"
                  >
                    <p className="text-sm font-black text-slate-950">
                      {area.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {area.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "data" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-black uppercase text-green-700">
                  Área escolhida
                </p>
                <h2 className="mt-1 text-xl font-black text-green-950">
                  {getAreaLabel(selectedArea)}
                </h2>
                {selectedGridX !== null && selectedGridY !== null && (
                  <p className="mt-1 text-xs font-bold text-green-700">
                    Bloco tocado: x{selectedGridX} / y{selectedGridY}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setStep("area")}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-green-700 shadow"
                >
                  Trocar área
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("solidarity");
                    setQuantity(1);
                  }}
                  className={`rounded-3xl border-2 p-4 text-left transition active:scale-95 ${
                    mode === "solidarity"
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="text-2xl">💚</div>
                  <h2 className="mt-2 text-sm font-black text-slate-950">
                    Mosaico
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    R$ 10 por bloco
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("premium");
                    setQuantity(1);
                  }}
                  className={`rounded-3xl border-2 p-4 text-left transition active:scale-95 ${
                    mode === "premium"
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="text-2xl">🔥</div>
                  <h2 className="mt-2 text-sm font-black text-slate-950">
                    Premium
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Em breve
                  </p>
                </button>
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
                  Bloco reservado
                </h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-green-800">
                  Posição reservada: x{pixResult.block.gridX} / y
                  {pixResult.block.gridY}
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
                    Seu bloco já entrou no Milhão Solidário.
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
