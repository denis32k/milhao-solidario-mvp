import Link from "next/link";
import ReportQueue from "@/components/admin/ReportQueue";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow"
        >
          ← Voltar ao mapa
        </Link>

        <section className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wide text-yellow-300">
            Painel do dono
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Admin
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Essa é uma versão visual mockada. Depois ligaremos login real,
            denúncias reais e ações no banco.
          </p>
        </section>

        <ReportQueue />
      </div>
    </main>
  );
}
