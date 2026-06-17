const reports = [
  {
    brick: "x88 / y58",
    title: "Marca Exemplo",
    reason: "Imagem denunciada por conteúdo inadequado.",
    status: "Aberta",
  },
  {
    brick: "x99 / y72",
    title: "Centro bloqueado",
    reason: "Teste de fila administrativa.",
    status: "Em análise",
  },
];

export default function ReportQueue() {
  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <article
          key={report.brick}
          className="rounded-3xl border border-slate-200 bg-white p-4 shadow"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Tijolinho {report.brick}
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                {report.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {report.reason}
              </p>
            </div>

            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
              {report.status}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button className="rounded-2xl bg-yellow-400 py-3 text-xs font-black text-yellow-950">
              Advertir
            </button>
            <button className="rounded-2xl bg-slate-800 py-3 text-xs font-black text-white">
              Bloquear imagem
            </button>
            <button className="rounded-2xl bg-red-600 py-3 text-xs font-black text-white">
              Banir e liberar tijolinho
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
