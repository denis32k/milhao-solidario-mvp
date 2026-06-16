import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950"
        >
          ← Voltar
        </Link>

        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Regras do projeto
        </p>

        <h1 className="mt-2 text-3xl font-black text-slate-950">
          Termos de Uso
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Estes termos são uma versão inicial para organizar as regras do
          projeto. Antes do lançamento público, o texto deve ser revisado por um
          advogado ou contador.
        </p>

        <div className="mt-6 space-y-4">
          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              1. Sobre o projeto
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              O projeto é um mapa gamificado de doações, onde apoiadores podem
              comprar blocos digitais para participar da arrecadação. O objetivo
              é atingir R$ 2.000.000,00 em valor principal de blocos vendidos.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              2. Modalidades de participação
            </h2>

            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                <strong>Mosaico Solidário:</strong> bloco de R$ 10,00. O
                apoiador informa apenas o nome completo. Essa modalidade não
                possui upload de imagem nem link externo.
              </p>

              <p>
                <strong>Área Premium:</strong> bloco de R$ 100,00. O apoiador
                pode comprar um ou mais blocos e enviar imagem, título,
                descrição e link de redirecionamento.
              </p>

              <p>
                <strong>Centro Grandioso:</strong> área central bloqueada para
                venda direta, reservada para uma ação futura.
              </p>
            </div>
          </section>

          <section className="rounded-3xl bg-orange-50 p-5">
            <h2 className="text-lg font-black text-orange-900">
              3. Taxa operacional e tributária
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-orange-900/80">
              Além do valor principal do bloco, será adicionada uma taxa
              operacional e tributária de 10%. Essa taxa ajuda a cobrir custos
              de pagamento, impostos, servidor, domínio, infraestrutura,
              manutenção, contador e operação do projeto.
            </p>

            <p className="mt-2 text-sm leading-relaxed text-orange-900/80">
              Exemplo: um bloco premium de R$ 100,00 terá taxa operacional de R$
              10,00, totalizando R$ 110,00 no PIX.
            </p>
          </section>

          <section className="rounded-3xl bg-green-50 p-5">
            <h2 className="text-lg font-black text-green-900">
              4. Destinação dos valores principais
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-green-900/80">
              A divisão 50% criador / 50% Hospital do Câncer será calculada
              sobre o valor principal dos blocos vendidos, sem incluir a taxa
              operacional e tributária.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              5. Conteúdos proibidos
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              É proibido enviar conteúdos ofensivos, ilegais, discriminatórios,
              violentos, pornográficos, fraudulentos, que violem direitos de
              terceiros ou que prejudiquem a imagem do projeto.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              6. Denúncias e moderação
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Blocos premium poderão ser denunciados por qualquer visitante. O
              administrador poderá analisar o conteúdo e tomar medidas como
              advertência, bloqueio de imagem, desativação de link ou banimento
              definitivo do bloco.
            </p>
          </section>

          <section className="rounded-3xl bg-red-50 p-5">
            <h2 className="text-lg font-black text-red-900">
              7. Banimento definitivo
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-red-900/80">
              Em caso de violação grave das regras, o bloco poderá ser banido
              definitivamente. Nessa situação, os dados do comprador poderão ser
              removidos do bloco, o link desativado e o espaço liberado para
              nova compra, sem reembolso.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              8. Links externos
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              O projeto não se responsabiliza pelo conteúdo de sites externos
              adicionados pelos compradores nos blocos premium. Links que
              direcionem para páginas inadequadas poderão ser removidos.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">
              9. Pagamento e publicação
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Após a aprovação do pagamento via PIX, o bloco poderá ser
              publicado automaticamente no mapa, sem aprovação humana prévia.
              Conteúdos inadequados poderão ser removidos posteriormente por
              denúncia ou análise administrativa.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-950 p-5 text-white">
            <h2 className="text-lg font-black">
              10. Alterações nos termos
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Estes termos poderão ser atualizados para melhorar a segurança,
              transparência e funcionamento do projeto.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}