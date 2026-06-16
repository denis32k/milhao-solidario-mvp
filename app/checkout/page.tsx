"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CheckoutMode = "solidarity" | "premium";

const OPERATIONAL_FEE_PERCENT = 0.1;

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function CheckoutPage() {
  const [mode, setMode] = useState<CheckoutMode>("solidarity");
  const [quantity, setQuantity] = useState(1);

  const unitPriceCents = mode === "solidarity" ? 1000 : 10000;

  const subtotalCents = useMemo(() => {
    return unitPriceCents * quantity;
  }, [unitPriceCents, quantity]);

  const operationalFeeCents = useMemo(() => {
    return Math.ceil(subtotalCents * OPERATIONAL_FEE_PERCENT);
  }, [subtotalCents]);

  const totalCents = subtotalCents + operationalFeeCents;

  function handleGeneratePix() {
    alert(
      "Aqui vamos conectar o Mercado Pago para gerar o QR Code PIX real."
    );
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
            Essa tela ainda é visual. Depois vamos ligar o Mercado Pago para
            gerar o QR Code e liberar o bloco automaticamente após o pagamento.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
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

          <div className="mt-5 flex h-48 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
            <div>
              <div className="text-4xl">🔳</div>

              <p className="mt-2 text-sm font-black text-slate-600">
                QR Code PIX aparecerá aqui
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Depois da integração com Mercado Pago.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGeneratePix}
            className="mt-5 w-full rounded-2xl bg-orange-500 py-4 text-sm font-extrabold text-white shadow-lg active:scale-95"
          >
            Gerar PIX de teste
          </button>
        </section>
      </div>
    </main>
  );
}