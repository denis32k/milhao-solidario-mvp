import Link from "next/link";

export default function TransparenciaPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>

        <p className="text-xs font-black uppercase tracking-wide text-green-600">Prestação de contas</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Transparência do Milhão Solidário</h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          O projeto usa um mapa gamificado com blocos digitais. O valor principal dos blocos vendidos é dividido em 50% para o criador e 50% para um Hospital do Câncer. A taxa operacional e tributária de 10% é cobrada por fora para ajudar nos custos da operação.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-green-50 p-5">
            <p className="text-xs font-black uppercase text-green-700">Mosaico Apoiador</p>
            <p className="mt-2 text-3xl font-black text-green-900">R$10</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-green-700">Blocos da moldura externa do mapa, com nome, cor, descrição e link opcional.</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase text-slate-500">Área Gold</p>
            <p className="mt-2 text-3xl font-black text-slate-950">R$100</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">Blocos do miolo do mapa, com imagem, nome, descrição e link.</p>
          </div>
          <div className="rounded-3xl bg-yellow-50 p-5">
            <p className="text-xs font-black uppercase text-yellow-700">Área Diamante</p>
            <p className="mt-2 text-3xl font-black text-yellow-900">R$500</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-yellow-700">Blocos nobres próximos ao centro bloqueado, com mais destaque visual.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-black uppercase text-yellow-300">Criador</p>
            <p className="mt-2 text-4xl font-black">50%</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300">Calculado sobre o valor principal dos blocos vendidos.</p>
          </div>
          <div className="rounded-3xl bg-green-600 p-5 text-white">
            <p className="text-xs font-black uppercase text-green-100">Hospital do Câncer</p>
            <p className="mt-2 text-4xl font-black">50%</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-green-100">Calculado sobre o valor principal dos blocos vendidos.</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">Taxa operacional e tributária</p>
          <h2 className="mt-2 text-2xl font-black text-orange-900">10% por cima</h2>
          <p className="mt-3 text-sm leading-relaxed text-orange-900/80">
            A taxa ajuda a cobrir Mercado Pago, impostos, servidor, domínio, armazenamento, manutenção, contador, atendimento, segurança, moderação e operação do projeto. A divisão 50%/50% considera o valor principal dos blocos, sem incluir essa taxa.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Como a prestação de contas deve evoluir</p>
          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <p>✅ Total arrecadado em tempo real</p>
            <p>✅ Taxas separadas do valor principal</p>
            <p>✅ Parte do criador separada</p>
            <p>✅ Parte do hospital separada</p>
            <p>✅ Histórico de repasses</p>
            <p>✅ Comprovantes futuros</p>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Antes do lançamento público em grande escala, o modelo financeiro, fiscal e jurídico deve ser revisado por contador e advogado. Esta página deixa clara a regra operacional prevista para o projeto.
        </p>
      </div>
    </main>
  );
}
