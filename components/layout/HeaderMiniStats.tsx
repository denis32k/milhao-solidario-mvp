"use client";

import { useEffect, useState } from "react";
import { formatMoney, getConstructionPhase } from "@/lib/site-config";

type Stats = {
  ok: boolean;
  blocks: {
    total: number;
    sold: number;
  };
};

type RankingItem = {
  id: string;
  publicName: string;
  totalApprovedCents: number;
};

const medalConfig = [
  { icon: "🥇", ring: "border-yellow-300 bg-yellow-50 text-yellow-950" },
  { icon: "🥈", ring: "border-slate-300 bg-slate-50 text-slate-900" },
  { icon: "🥉", ring: "border-orange-300 bg-orange-50 text-orange-950" },
] as const;

export default function HeaderMiniStats({ ranking = [] }: { ranking?: RankingItem[] }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/stats", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (alive && data.ok) setStats(data);
      })
      .catch(() => null);

    return () => {
      alive = false;
    };
  }, []);

  const total = stats?.blocks.total || 29000;
  const sold = stats?.blocks.sold || 0;
  const phase = getConstructionPhase(sold, total);
  const summaryText = `${sold.toLocaleString("pt-BR")} tijolinhos vendidos • faltam ${phase.missingToNext.toLocaleString("pt-BR")} para a próxima fase`;
  const topThree = Array.from({ length: 3 }, (_, index) =>
    ranking[index] || { id: `placeholder-${index}`, publicName: `${index + 1}º lugar em breve`, totalApprovedCents: 0 }
  );

  return (
    <div className="min-w-0 flex-1 px-2 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <p className="min-w-0 truncate">
            <span>{phase.currentPhase}</span>
            <span className="hidden sm:inline"> • {summaryText}</span>
          </p>
          <span className="shrink-0">{phase.progressPercent}%</span>
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300"
            style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
          />
        </div>

        <p className="mt-1 truncate text-[9px] font-bold text-slate-500 sm:hidden">{summaryText}</p>

        <div className="mt-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1">
            {topThree.map((item, index) => {
              const medal = medalConfig[index];
              return (
                <div
                  key={item.id}
                  className={`flex min-w-[110px] items-center gap-1 rounded-xl border px-1.5 py-1 shadow-sm ${medal.ring}`}
                  title={`${index + 1}º lugar — ${item.publicName}`}
                >
                  <span className="shrink-0 text-[10px] leading-none">{medal.icon}</span>
                  <div className="min-w-0 leading-none">
                    <p className="text-[8px] font-black uppercase opacity-70">{index + 1}º lugar</p>
                    <p className="text-[9px] font-black leading-tight sm:text-[10px]">{item.publicName}</p>
                    <p className="text-[8px] font-bold opacity-75">
                      {item.totalApprovedCents > 0 ? formatMoney(item.totalApprovedCents) : "aguardando"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
