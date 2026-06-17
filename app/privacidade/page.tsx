import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <Link href="/" className="mb-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950">← Voltar</Link>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Dados pessoais</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Política de Privacidade</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">Esta página explica de forma simples quais dados são usados no {siteConfig.brand.name} e o que aparece publicamente.</p>

        <div className="mt-6 space-y-4">
          <section className="rounded-3xl bg-orange-50 p-5">
            <h2 className="text-lg font-black text-orange-900">O que aparece publicamente</h2>
            <p className="mt-2 text-sm leading-relaxed text-orange-900/80">Nome público, descrição curta, cor do tijolinho, imagem enviada em qualquer área comprada e link/Instagram informado pelo comprador.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">O que fica privado</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Nome completo, WhatsApp e CPF não aparecem no mural. Esses dados são usados para controle, segurança, pagamento, atendimento e moderação.</p>
          </section>

          <section className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-black text-slate-950">CPF</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">O CPF é usado no processo de pagamento e controle. O sistema guarda o CPF de forma protegida/hash e os últimos dígitos para conferência administrativa.</p>
          </section>

          <section className="rounded-3xl bg-slate-950 p-5 text-white">
            <h2 className="text-lg font-black">Contato e remoção</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Caso precise corrigir informações públicas de um tijolinho, a alteração precisará de motivo e aprovação administrativa antes de mudar o mural público.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
