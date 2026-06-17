import Link from "next/link";
import { formatMoney, siteConfig } from "@/lib/site-config";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>

        <p className="text-xs font-black uppercase tracking-wide text-orange-600">Regras do mural</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Termos de Uso</h1>
        <p className="mt-4 rounded-3xl bg-orange-50 p-4 text-sm font-bold leading-relaxed text-orange-900">
          {siteConfig.copy.legalNotice}
        </p>

        <div className="mt-6 space-y-4">
          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">1. Sobre o projeto</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {siteConfig.brand.name} é um mural público comercial formado por tijolinhos digitais. A pessoa compra um ou mais espaços, personaliza sua presença e passa a aparecer em uma página pública do projeto.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">2. Áreas do mural</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
              <p><strong>{siteConfig.areas.SOLIDARITY.name}:</strong> {formatMoney(siteConfig.areas.SOLIDARITY.priceCents)} por tijolinho, com cor, nome público, descrição curta e link opcional.</p>
              <p><strong>{siteConfig.areas.PREMIUM.name}:</strong> {formatMoney(siteConfig.areas.PREMIUM.priceCents)} por tijolinho, com imagem no mural, nome público, descrição e link.</p>
              <p><strong>{siteConfig.areas.GOLD.name}:</strong> {formatMoney(siteConfig.areas.GOLD.priceCents)} por tijolinho, com imagem no mural, nome público, descrição, link e maior destaque visual.</p>
              <p><strong>Áreas restritas:</strong> as placas com os nomes dos bairros estão bloqueadas no momento e serão liberadas em uma fase especial da obra.</p>
            </div>
          </section>

          <section className="rounded-3xl bg-orange-50 p-5">
            <h2 className="text-lg font-black text-orange-900">3. Pagamento</h2>
            <p className="mt-2 text-sm leading-relaxed text-orange-900/80">
              O checkout atual trabalha com PIX. Nesta versão, o valor exibido para cada tijolinho é o valor final cobrado no pedido, sem acréscimo de taxa operacional.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">4. Publicação automática</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Após a confirmação do PIX, os tijolinhos podem aparecer automaticamente no mural. Conteúdos públicos podem ser removidos, ocultados ou bloqueados posteriormente em caso de denúncia, abuso ou análise administrativa.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">5. Conteúdos proibidos</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              É proibido enviar conteúdo ilegal, ofensivo, pornográfico, discriminatório, fraudulento, violento, com golpe, malware, link perigoso ou que viole direitos de terceiros.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">6. Denúncias e moderação</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Qualquer visitante pode denunciar um tijolinho. O administrador pode bloquear imagem, bloquear link, ocultar descrição, ocultar nome público, banir comprador, resolver denúncia ou liberar o espaço conforme a gravidade.
            </p>
          </section>

          <section className="rounded-3xl bg-red-50 p-5">
            <h2 className="text-lg font-black text-red-900">7. Banimento</h2>
            <p className="mt-2 text-sm leading-relaxed text-red-900/80">
              Em caso de violação grave, o comprador pode ser banido. O tijolinho pode continuar vendido, mas imagem, link, nome público e descrição podem ser ocultados.
            </p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">8. Privacidade</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              CPF e WhatsApp são dados privados usados para controle administrativo, pagamento, segurança e contato. Publicamente aparecem apenas os dados que o comprador decidiu exibir no mural.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
