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

const rankingSlots = [
  { rank: 1, label: "1º lugar", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { rank: 2, label: "2º lugar", tone: "border-slate-200 bg-slate-50 text-slate-700" },
  { rank: 3, label: "3º lugar", tone: "border-orange-200 bg-orange-50 text-orange-800" },
] as const;

function getRankItem(ranking: RankingItem[], rank: number) {
  return ranking[rank - 1] || null;
}

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
  const soldText = `${sold.toLocaleString("pt-BR")} tijolinhos vendidos`;
  const nextText = `faltam ${phase.missingToNext.toLocaleString("pt-BR")} para a próxima fase`;
  const topThree = ranking.slice(0, 3);

  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-slate-200 bg-white/92 px-3 py-2 shadow-sm lg:px-3.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <p className="min-w-0 truncate text-slate-700">
            <span>{phase.currentPhase}</span>
            <span className="ml-1 normal-case tracking-normal text-slate-500">• {soldText}</span>
          </p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{phase.progressPercent}%</span>
        </div>

        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300"
            style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
          />
        </div>

        <p className="mt-1 truncate text-[10px] font-bold text-slate-500">{nextText}</p>

        {topThree.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 lg:gap-2">
            {rankingSlots.map((slot) => {
              const item = getRankItem(topThree, slot.rank);
              return (
                <div key={slot.rank} className={`min-w-0 rounded-2xl border px-2 py-1.5 text-center ${slot.tone}`}>
                  <p className="text-[10px] font-black leading-none">{slot.label}</p>
                  <p title={item?.publicName || ""} className="mt-1 truncate text-[10px] font-black leading-tight lg:text-[11px]">
                    {item?.publicName || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
