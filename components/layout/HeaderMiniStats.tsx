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

export default function HeaderMiniStats() {
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

  return (
    <div className="min-w-0 flex-1 px-2 sm:px-4">
      <div className="mx-auto max-w-md">
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
        <p className="mt-1 hidden truncate text-center text-[10px] font-bold text-slate-500 sm:block">
          {sold.toLocaleString("pt-BR")} tijolinhos vendidos • faltam {phase.missingToNext.toLocaleString("pt-BR")} para a próxima fase
        </p>
      </div>
    </div>
  );
}
