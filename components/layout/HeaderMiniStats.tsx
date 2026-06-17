"use client";

import { useEffect, useState } from "react";
import { getConstructionPhase } from "@/lib/site-config";

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
  { icon: "🥇", label: "1º lugar" },
  { icon: "🥈", label: "2º lugar" },
  { icon: "🥉", label: "3º lugar" },
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
  const topThree = ranking.slice(0, 3);

  return (
    <div className="min-w-0 flex-1 px-2 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <p className="min-w-0 truncate">
            <span>{phase.currentPhase}</span>
          </p>
          <span className="shrink-0">{phase.progressPercent}%</span>
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300"
            style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
          />
        </div>

        <p className="mt-1 truncate text-[9px] font-bold text-slate-500">{summaryText}</p>

        {topThree.length > 0 && (
          <div className="mt-1 overflow-x-auto whitespace-nowrap pb-0.5 text-[9px] font-bold text-slate-700 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-3">
              {topThree.map((item, index) => {
                const medal = medalConfig[index];
                return (
                  <span key={item.id} className="inline-flex items-center gap-1 whitespace-nowrap leading-none">
                    <span className="text-[10px] leading-none">{medal.icon}</span>
                    <span className="font-black text-slate-600">{medal.label}</span>
                    <span className="font-black text-slate-900">{item.publicName}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
