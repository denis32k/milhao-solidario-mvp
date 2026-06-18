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

const podiumSlots = [
  { rank: 2, icon: "🥈", label: "2º lugar" },
  { rank: 1, icon: "🥇", label: "1º lugar" },
  { rank: 3, icon: "🥉", label: "3º lugar" },
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
    <div className="min-w-0 flex-1 px-1 sm:px-3">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <p className="min-w-0 truncate">
            <span>{phase.currentPhase}</span>
            <span className="ml-1 normal-case tracking-normal text-slate-700">• {soldText}</span>
          </p>
          <span className="shrink-0">{phase.progressPercent}%</span>
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300"
            style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
          />
        </div>

        <p className="mt-1 hidden truncate text-[9px] font-bold text-slate-500 sm:block">{nextText}</p>

        {topThree.length > 0 && (
          <div className="mt-1 hidden grid-cols-3 items-end gap-1 text-center sm:grid">
            {podiumSlots.map((slot) => {
              const item = getRankItem(topThree, slot.rank);
              const isLeader = slot.rank === 1;

              return (
                <div
                  key={slot.rank}
                  className={`min-w-0 rounded-2xl px-1 ${isLeader ? "pb-1.5 pt-1" : "pb-1 pt-0.5"}`}
                >
                  <div className={`flex items-center justify-center gap-1 leading-none ${isLeader ? "text-[10px]" : "text-[9px]"}`}>
                    <span>{slot.icon}</span>
                    <span className="font-black text-slate-600">{slot.label}</span>
                  </div>
                  <p
                    title={item?.publicName || ""}
                    className={`mt-0.5 truncate font-black text-slate-900 ${isLeader ? "text-[10px]" : "text-[9px]"}`}
                  >
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
