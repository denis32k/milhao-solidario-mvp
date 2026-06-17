import { formatMoney } from "@/lib/site-config";

type Item = {
  id: string;
  publicName: string;
  totalApprovedCents: number;
};

const medals = [
  { icon: "🥇", label: "1º lugar", card: "bg-yellow-50/95 border-yellow-300 text-yellow-950", name: "text-base sm:text-lg", amount: "text-[11px] sm:text-xs" },
  { icon: "🥈", label: "2º lugar", card: "bg-slate-50/95 border-slate-300 text-slate-900", name: "text-sm sm:text-base", amount: "text-[10px] sm:text-[11px]" },
  { icon: "🥉", label: "3º lugar", card: "bg-orange-50/95 border-orange-300 text-orange-950", name: "text-sm", amount: "text-[10px] sm:text-[11px]" },
] as const;

export default function HomeHallOfFame({ ranking }: { ranking: Item[] }) {
  const filled = Array.from({ length: 3 }, (_, index) => ranking[index] || { id: `placeholder-${index}`, publicName: "Em breve", totalApprovedCents: 0 });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 px-3 sm:top-3">
      <div className="mx-auto flex max-w-4xl items-start justify-center gap-2 sm:gap-3">
        {filled.map((item, index) => {
          const medal = medals[index];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-2 py-2 shadow-lg backdrop-blur ${medal.card} ${index === 0 ? "sm:-mt-1" : "mt-2"}`}
            >
              <div className={`shrink-0 ${index === 0 ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"}`}>{medal.icon}</div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-wide opacity-70">{medal.label}</p>
                <p className={`truncate font-black ${medal.name}`}>{item.publicName}</p>
                <p className={`truncate font-bold opacity-80 ${medal.amount}`}>
                  {item.totalApprovedCents > 0 ? formatMoney(item.totalApprovedCents) : "Aguardando primeiro destaque"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
