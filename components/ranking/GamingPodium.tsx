const ranking = [
  {
    name: "Pessoa Fictícia",
    amount: 12500,
    medal: "🥇",
    style: "border-yellow-300 bg-yellow-50 shadow-yellow-200",
  },
  {
    name: "Marca Exemplo",
    amount: 8400,
    medal: "🥈",
    style: "border-slate-300 bg-slate-50 shadow-slate-200",
  },
  {
    name: "Grupo Exemplo",
    amount: 6200,
    medal: "🥉",
    style: "border-orange-300 bg-orange-50 shadow-orange-200",
  },
];

const others = [
  { name: "Comprador 04", amount: 3000 },
  { name: "Comprador 05", amount: 1800 },
  { name: "Comprador 06", amount: 950 },
  { name: "Comprador 07", amount: 500 },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function GamingPodium() {
  return (
    <section className="space-y-5">
      <div className="grid gap-4">
        {ranking.map((item, index) => (
          <article
            key={item.name}
            className={`rounded-3xl border-2 p-5 shadow-xl ${item.style}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow">
                {item.medal}
              </div>

              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {index + 1}º Lugar
                </p>
                <h2 className="text-xl font-black text-slate-950">
                  {item.name}
                </h2>
                <p className="mt-1 text-lg font-black text-slate-700">
                  {formatMoney(item.amount)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        {others.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between border-b border-slate-100 px-4 py-4 last:border-b-0"
          >
            <div>
              <p className="text-sm font-black text-slate-950">
                {index + 4}º {item.name}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Total em tijolinhos
              </p>
            </div>

            <p className="font-black text-slate-800">
              {formatMoney(item.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
