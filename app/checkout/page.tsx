"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CheckoutMode = "solidarity" | "premium";

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

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getQrImageSrc(qrCodeBase64: string) {
  if (qrCodeBase64.startsWith("data:")) {
    return qrCodeBase64;
  }

  return `data:image/png;base64,${qrCodeBase64}`;
}

export default function CheckoutPage() {
  const [mode, setMode] = useState<CheckoutMode>("solidarity");
  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const unitPriceCents = mode === "solidarity" ? 1000 : 10000;

  const subtotalCents = useMemo(() => {
    return unitPriceCents * quantity;
  }, [unitPriceCents, quantity]);

  const operationalFeeCents = useMemo(() => {
    return Math.ceil(subtotalCents * OPERATIONAL_FEE_PERCENT);
  }, [subtotalCents]);

  const totalCents = subtotalCents + operationalFeeCents;

  async function handleGeneratePix() {
    try {
      setPixResult(null);
      setCopyMessage("");

      if (!fullName.trim()) {
        alert("Digite o nome completo.");
        return;
      }

      if (mode === "premium") {
        alert(
          "O PIX real agora será conectado primeiro no Mosaico Solidário. Depois vamos ligar o Premium com seleção de blocos, upload e link."
        );
        return;
      }

      setIsLoading(true);

      const response = await fetch("/api/mercado-pago-pi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
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
          data.message ||
            data.error ||
            "Erro ao criar PIX no Mercado Pago."
        );
      }

      setPixResult({
        payment: data.payment,
        pix: data.pix,
        transaction: data.transaction,
        block: data.block,
      });
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
      setCopyMessage("Não consegui copiar automaticamente. Selecione e copie manualmente.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow"
        >
          ← Voltar ao mapa
        </Link>

        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-orange-500">
            Pagamento via PIX
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-950">
            Escolha seu bloco
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            O Mosaico Solidário já pode gerar QR Code PIX pelo Mercado Pago.
            Depois vamos conectar o webhook para confirmar o pagamento
            automaticamente.
          </p>

          {pixResult && (
            <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 p-4">
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
                Status Mercado Pago: {pixResult.payment.status}
              </p>

              <p className="mt-1 text-xs font-semibold leading-relaxed text-green-700">
                Pagamento: #{pixResult.payment.id}
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("solidarity");
                setQuantity(1);
                setPixResult(null);
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
                setPixResult(null);
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
                R$ 100 por bloco
              </p>
            </button>
          </div>

          <div className="mt-5 space-y-4">
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

            {mode === "premium" && (
              <>
                <div>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Quantidade de blocos premium
                  </span>

                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((value) => Math.max(1, value - 1))
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black"
                    >
                      -
                    </button>

                    <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-50 text-lg font-black text-slate-950">
                      {quantity}
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuantity((value) => value + 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Título do bloco
                  </span>

                  <input
                    type="text"
                    placeholder="Ex: Minha marca apoiando essa causa"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Descrição
                  </span>

                  <textarea
                    placeholder="Escreva uma pequena descrição"
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Link de redirecionamento
                  </span>

                  <input
                    type="url"
                    placeholder="https://..."
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none focus:border-slate-950"
                  />
                </label>

                <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <div className="text-3xl">🖼️</div>

                  <p className="mt-2 text-sm font-black text-slate-700">
                    Upload de imagem
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Será conectado depois.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 space-y-3 rounded-3xl bg-slate-50 p-4">
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
                <span className="font-black text-slate-950">
                  Total PIX
                </span>

                <span className="text-xl font-black text-slate-950">
                  {money(totalCents)}
                </span>
              </div>

              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                A taxa operacional e tributária ajuda a cobrir custos de
                pagamento, impostos, infraestrutura, manutenção e operação do
                projeto. A divisão 50% criador / 50% hospital considera o valor
                principal dos blocos.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            {!pixResult && (
              <div className="flex h-40 items-center justify-center">
                <div>
                  <div className="text-4xl">🔳</div>

                  <p className="mt-2 text-sm font-black text-slate-600">
                    QR Code PIX aparecerá aqui
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Gere o PIX para visualizar o código.
                  </p>
                </div>
              </div>
            )}

            {pixResult?.pix.qrCodeBase64 && (
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

            {pixResult?.pix.ticketUrl && (
              <a
                href={pixResult.pix.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white"
              >
                Abrir pagamento no Mercado Pago
              </a>
            )}

            {pixResult?.pix.qrCode && (
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
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGeneratePix}
            disabled={isLoading}
            className="mt-5 w-full rounded-2xl bg-orange-500 py-4 text-sm font-extrabold text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Gerando PIX..." : "Gerar PIX Mercado Pago"}
          </button>

          <p className="mt-4 text-center text-[11px] font-semibold leading-relaxed text-slate-500">
            Nesta etapa, o sistema apenas gera o PIX real. A confirmação
            automática do pagamento será conectada no próximo passo com webhook.
          </p>
        </section>
      </div>
    </main>
  );
}