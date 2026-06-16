import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>

        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Regras do projeto</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Termos de Uso</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Estes termos organizam as regras do Milhão Solidário. Antes de divulgação em grande escala, revise com advogado/contador.
        </p>

        <div className="mt-6 space-y-4">
          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">1. Sobre o projeto</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">O Milhão Solidário é um mapa digital de blocos. A pessoa compra um ou mais blocos, personaliza as informações públicas e participa da arrecadação.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">2. Modalidades</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
              <p><strong>Mosaico Solidário:</strong> R$10 por bloco, com cor, nome público, descrição curta e Instagram/link opcional.</p>
              <p><strong>Área Premium:</strong> R$100 por bloco, com imagem no grid, nome público, descrição e link.</p>
              <p><strong>Área Ouro:</strong> R$500 por bloco, com destaque próximo ao centro bloqueado.</p>
              <p><strong>Centro bloqueado:</strong> área reservada para ação futura, sem venda direta no momento.</p>
            </div>
          </section>

          <section className="rounded-3xl bg-orange-50 p-5">
            <h2 className="text-lg font-black text-orange-900">3. Taxa operacional</h2>
            <p className="mt-2 text-sm leading-relaxed text-orange-900/80">Além do valor principal dos blocos, será adicionada uma taxa de 10% para custos de pagamento, tributos, infraestrutura, armazenamento, moderação, atendimento e operação.</p>
          </section>

          <section className="rounded-3xl bg-green-50 p-5">
            <h2 className="text-lg font-black text-green-900">4. Destinação do valor principal</h2>
            <p className="mt-2 text-sm leading-relaxed text-green-900/80">O valor principal dos blocos vendidos será dividido em 50% para o criador e 50% para um Hospital do Câncer. A taxa operacional não entra nessa divisão.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">5. Publicação automática</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Após a aprovação do PIX, o bloco poderá aparecer automaticamente no mapa. O conteúdo pode ser removido ou ocultado posteriormente em caso de denúncia ou análise administrativa.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">6. Conteúdos proibidos</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">É proibido enviar conteúdo ilegal, ofensivo, pornográfico, discriminatório, fraudulento, violento, com golpe, malware, link perigoso ou que viole direitos de terceiros.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">7. Denúncias e moderação</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Qualquer visitante pode denunciar um bloco. O administrador pode bloquear imagem, bloquear link, ocultar descrição, banir comprador, resolver denúncia ou liberar bloco conforme a gravidade.</p>
          </section>

          <section className="rounded-3xl bg-red-50 p-5">
            <h2 className="text-lg font-black text-red-900">8. Banimento</h2>
            <p className="mt-2 text-sm leading-relaxed text-red-900/80">Em caso de violação grave, o comprador pode ser banido. O bloco pode continuar vendido, mas imagem, link e descrição pública podem ser ocultados.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">9. Privacidade</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">CPF e WhatsApp são dados privados usados para controle administrativo, pagamento, segurança e contato. O que aparece publicamente é apenas o nome público, descrição e link/Instagram informados pelo comprador.</p>
          </section>

          <section className="rounded-3xl bg-slate-950 p-5 text-white">
            <h2 className="text-lg font-black">10. Atualizações</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">As regras podem ser atualizadas para melhorar segurança, transparência, operação e moderação do projeto.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
