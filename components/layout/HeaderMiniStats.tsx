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
  const topThree = Array.from({ length: 3 }, (_, index) => ranking[index] || { id: `placeholder-${index}`, publicName: `${index + 1}º em breve`, totalApprovedCents: 0 });

  return (
    <div className="min-w-0 flex-1 px-2 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <span className="truncate">{phase.currentPhase}</span>
          <span>{phase.progressPercent}%</span>
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300"
            style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
          />
        </div>

        <div className="mt-1 flex items-center gap-1 overflow-hidden">
          {topThree.map((item, index) => {
            const medal = medalConfig[index];
            return (
              <div
                key={item.id}
                className={`flex min-w-0 flex-1 items-center gap-1 rounded-xl border px-1.5 py-1 shadow-sm ${medal.ring}`}
                title={`${index + 1}º lugar — ${item.publicName}`}
              >
                <span className="shrink-0 text-[11px] leading-none">{medal.icon}</span>
                <div className="min-w-0 leading-none">
                  <p className="truncate text-[9px] font-black uppercase opacity-70">{index + 1}º</p>
                  <p className={`truncate font-black ${index === 0 ? "text-[10px] sm:text-[11px]" : "text-[9px] sm:text-[10px]"}`}>{item.publicName}</p>
                  <p className="truncate text-[8px] font-bold opacity-75">
                    {item.totalApprovedCents > 0 ? formatMoney(item.totalApprovedCents) : "aguardando"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-1 hidden truncate text-center text-[10px] font-bold text-slate-500 sm:block">
          {sold.toLocaleString("pt-BR")} tijolinhos vendidos • faltam {phase.missingToNext.toLocaleString("pt-BR")} para a próxima fase
        </p>
      </div>
    </div>
  );
}
