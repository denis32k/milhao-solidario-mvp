"use client";

import { useEffect, useState } from "react";
import { buyableAreaKeys, formatMoney, getAreaPriceCents, siteConfig, type BuyableAreaKey } from "@/lib/site-config";

type AreaStats = {
  total: number;
  sold: number;
  available: number;
};

type Stats = {
  ok: boolean;
  blocks: {
    byCategory?: Record<string, AreaStats>;
  };
};

function themeClass(category: BuyableAreaKey) {
  if (category === "SOLIDARITY") {
    return "border-slate-200 bg-[radial-gradient(circle_at_20%_20%,#ffffff,transparent_28%),repeating-linear-gradient(135deg,#0f172a_0_6px,#f8fafc_6px_14px)] text-slate-950";
  }
  if (category === "PREMIUM") {
    return "border-emerald-200 bg-[radial-gradient(circle_at_top,#bbf7d0,transparent_35%),linear-gradient(135deg,#064e3b,#f8fafc)] text-white";
  }
  if (category === "GRAND_CENTER") {
    return "border-fuchsia-200 bg-[radial-gradient(circle_at_top,#f5d0fe,transparent_35%),linear-gradient(135deg,#581c87,#fdf4ff)] text-white";
  }
  return "border-yellow-200 bg-[radial-gradient(circle_at_top,#fde68a,transparent_35%),linear-gradient(135deg,#fff7ed,#f59e0b)] text-slate-950";
}

function areaIcon(category: BuyableAreaKey) {
  if (category === "SOLIDARITY") return "〰️";
  if (category === "PREMIUM") return "🌿";
  if (category === "GRAND_CENTER") return "👑";
  return "✨";
}

export default function AreaCards() {
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

  return (
    <section id="areas" className="bg-white px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Escolha sua área</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Escolha onde sua marca vai ficar: Copacabana, Ipanema, Leblon ou Tom Delfim Moreira.</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
            Cada espaço comprado deixa uma marca nessa obra. As áreas têm estilos, preços e níveis de destaque diferentes.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {buyableAreaKeys.map((key) => {
            const area = siteConfig.areas[key];
            const areaStats = stats?.blocks.byCategory?.[key];
            return (
              <article key={key} className={`overflow-hidden rounded-[2rem] border-2 p-5 shadow-xl ${themeClass(key)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-4xl">{areaIcon(key)}</p>
                    <h3 className="mt-4 text-2xl font-black">{area.name}</h3>
                  </div>
                  <div className="rounded-2xl bg-white/85 px-3 py-2 text-right text-slate-950 shadow">
                    <p className="text-[10px] font-black uppercase text-slate-500">A partir de</p>
                    <p className="text-lg font-black">{formatMoney(getAreaPriceCents(key))}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-bold leading-relaxed opacity-90">{area.description}</p>
                <p className="mt-2 text-xs font-semibold opacity-80">{area.cardText}</p>
                <div className="mt-5 rounded-2xl bg-white/85 p-3 text-slate-950">
                  <p className="text-[10px] font-black uppercase text-slate-500">Espaços disponíveis</p>
                  <p className="mt-1 text-xl font-black">
                    {areaStats ? areaStats.available.toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <a href="#mural" className="pixel-btn pixel-btn--dark mt-4 flex justify-center !rounded-2xl !py-3 !text-sm">
                  Escolher esta área
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
