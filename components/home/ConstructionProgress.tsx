"use client";

import { useEffect, useState } from "react";
import { getConstructionPhase, siteConfig } from "@/lib/site-config";

type Stats = {
  ok: boolean;
  blocks: {
    total: number;
    sold: number;
    available: number;
  };
};

export default function ConstructionProgress() {
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
  const available = stats?.blocks.available || total;
  const phase = getConstructionPhase(sold, total);

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Fases da Obra</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Fase atual: {phase.currentPhase}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            {phase.isCompleted
              ? "A obra digital chegou ao mural completo."
              : `Faltam ${phase.missingToNext.toLocaleString("pt-BR")} tijolinhos para avançar para ${phase.nextPhase}.`}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-white">
          <p className="text-[10px] font-black uppercase text-slate-300">Progresso</p>
          <p className="text-lg font-black">{phase.progressPercent}%</p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all"
          style={{ width: `${Math.max(2, Math.min(100, phase.progressPercent))}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-500">Vendidos</p>
          <p className="text-lg font-black text-slate-950">{sold.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3">
          <p className="text-[10px] font-black uppercase text-orange-700">Disponíveis</p>
          <p className="text-lg font-black text-orange-900">{available.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl bg-yellow-50 p-3">
          <p className="text-[10px] font-black uppercase text-yellow-700">Total</p>
          <p className="text-lg font-black text-yellow-900">{total.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-bold leading-relaxed text-slate-500">
        {siteConfig.copy.constructionText}
      </p>
    </section>
  );
}
