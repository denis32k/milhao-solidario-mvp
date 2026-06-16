import Link from "next/link";

export default function TransparenciaPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950"
        >
          ← Voltar
        </Link>

        <p className="text-xs font-black uppercase tracking-wide text-green-600">
          Prestação de contas
        </p>

        <h1 className="mt-2 text-3xl font-black text-slate-950">
          Transparência
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          O objetivo do projeto é arrecadar R$ 2.000.000,00 em valor principal
          de blocos. A regra prevista é dividir esse valor principal em 50% para
          o criador e 50% para um Hospital do Câncer.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase text-slate-500">
              Criador
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              50%
            </p>

            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
              Calculado sobre o valor principal dos blocos vendidos.
            </p>
          </div>

          <div className="rounded-3xl bg-green-50 p-5">
            <p className="text-xs font-black uppercase text-green-700">
              Hospital do Câncer
            </p>

            <p className="mt-2 text-3xl font-black text-green-800">
              50%
            </p>

            <p className="mt-2 text-xs font-semibold leading-relaxed text-green-700">
              Calculado sobre o valor principal dos blocos vendidos.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">
            Taxa operacional e tributária
          </p>

          <h2 className="mt-2 text-2xl font-black text-orange-900">
            10%
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-orange-900/80">
            Além do valor principal do bloco, será adicionada uma taxa
            operacional e tributária de 10%. Essa taxa ajuda a cobrir custos de
            pagamento, impostos, servidor, domínio, infraestrutura, manutenção,
            contador e operação do projeto.
          </p>

          <p className="mt-3 text-sm leading-relaxed text-orange-900/80">
            A divisão 50% criador / 50% hospital considera o valor principal dos
            blocos, sem incluir a taxa operacional.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">
            Exemplo prático
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Bloco Premium</span>
              <span className="font-black">R$ 100,00</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-300">
                Taxa operacional 10%
              </span>
              <span className="font-black">R$ 10,00</span>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between">
                <span className="font-black">Total PIX</span>
                <span className="font-black">R$ 110,00</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Esta página é uma versão inicial de transparência. Antes do lançamento
          público, o modelo financeiro e tributário deve ser revisado por um
          contador.
        </p>
      </div>
    </main>
  );
}