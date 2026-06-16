"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

const GRID_COLS = 200;
const GRID_ROWS = 145;
const BLOCK_SIZE = 10;

const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

const FAKE_PREMIUM = {
  originX: 88,
  originY: 58,
  widthBlocks: 8,
  heightBlocks: 8,
  title: "Apoiador Premium",
  description:
    "Esse é um exemplo de bloco premium comprado. Aqui entraria a imagem, descrição e link do comprador.",
  link: "https://example.com",
};

type Camera = {
  x: number;
  y: number;
  scale: number;
};

type SelectedSheet =
  | null
  | {
      type: "grand-center";
    }
  | {
      type: "premium";
    }
  | {
      type: "solidarity";
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBlockType(x: number, y: number) {
  const isGrandCenter =
    x >= 99 &&
    x <= 100 &&
    y >= 70 &&
    y <= 74;

  if (isGrandCenter) return "grand-center";

  if (y < 25 || y >= 120) return "solidarity";

  return "premium";
}

function isInsideFakePremium(x: number, y: number) {
  return (
    x >= FAKE_PREMIUM.originX &&
    x < FAKE_PREMIUM.originX + FAKE_PREMIUM.widthBlocks &&
    y >= FAKE_PREMIUM.originY &&
    y < FAKE_PREMIUM.originY + FAKE_PREMIUM.heightBlocks
  );
}

function isInsideGrandCenterClickArea(x: number, y: number) {
  return x >= 98 && x <= 101 && y >= 69 && y <= 75;
}

export default function PixelMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef(false);

  const lastPointerRef = useRef({
    x: 0,
    y: 0,
  });

  const [selectedSheet, setSelectedSheet] = useState<SelectedSheet>(null);

  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    scale: 1,
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();

    const randomX = Math.random() * MAP_WIDTH;
    const randomY = Math.random() * MAP_HEIGHT;

    setCamera({
      x: rect.width / 2 - randomX,
      y: rect.height / 2 - randomY,
      scale: 1,
    });
  }, []);

  useEffect(() => {
    drawMap();
  }, [camera]);

  function drawMap() {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();

    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const type = getBlockType(x, y);

        const px = x * BLOCK_SIZE;
        const py = y * BLOCK_SIZE;

        if (isInsideFakePremium(x, y)) {
          ctx.fillStyle = "#0f172a";
        } else if (type === "grand-center") {
          ctx.fillStyle = "#facc15";
        } else if (type === "solidarity") {
          ctx.fillStyle = "#bbf7d0";
        } else {
          ctx.fillStyle = "#e2e8f0";
        }

        ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
        ctx.lineWidth = 0.3;
        ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    const premiumX = FAKE_PREMIUM.originX * BLOCK_SIZE;
    const premiumY = FAKE_PREMIUM.originY * BLOCK_SIZE;
    const premiumW = FAKE_PREMIUM.widthBlocks * BLOCK_SIZE;
    const premiumH = FAKE_PREMIUM.heightBlocks * BLOCK_SIZE;

    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.strokeRect(premiumX, premiumY, premiumW, premiumH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "8px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "PREMIUM",
      premiumX + premiumW / 2,
      premiumY + premiumH / 2
    );

    ctx.fillStyle = "#78350f";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔒", 1000, 725);

    ctx.restore();
  }

  function getGridPosition(clientX: number, clientY: number) {
    const wrapper = wrapperRef.current;

    if (!wrapper) return null;

    const rect = wrapper.getBoundingClientRect();

    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const worldX = (screenX - camera.x) / camera.scale;
    const worldY = (screenY - camera.y) / camera.scale;

    const gridX = Math.floor(worldX / BLOCK_SIZE);
    const gridY = Math.floor(worldY / BLOCK_SIZE);

    if (
      gridX < 0 ||
      gridX >= GRID_COLS ||
      gridY < 0 ||
      gridY >= GRID_ROWS
    ) {
      return null;
    }

    return {
      x: gridX,
      y: gridY,
      type: getBlockType(gridX, gridY),
    };
  }

  function goToCenter() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();

    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - 1000 * current.scale,
      y: rect.height / 2 - 725 * current.scale,
    }));
  }

  function goToPremium() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();

    const premiumCenterX =
      (FAKE_PREMIUM.originX + FAKE_PREMIUM.widthBlocks / 2) * BLOCK_SIZE;

    const premiumCenterY =
      (FAKE_PREMIUM.originY + FAKE_PREMIUM.heightBlocks / 2) * BLOCK_SIZE;

    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - premiumCenterX * current.scale,
      y: rect.height / 2 - premiumCenterY * current.scale,
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);

    isDraggingRef.current = true;

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;

    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    setCamera((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    }));
  }

  function handlePointerUp() {
    isDraggingRef.current = false;
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const gridPosition = getGridPosition(event.clientX, event.clientY);

    if (!gridPosition) return;

    if (isInsideFakePremium(gridPosition.x, gridPosition.y)) {
      setSelectedSheet({
        type: "premium",
      });

      return;
    }

    if (isInsideGrandCenterClickArea(gridPosition.x, gridPosition.y)) {
      setSelectedSheet({
        type: "grand-center",
      });

      return;
    }

    if (gridPosition.type === "solidarity") {
      setSelectedSheet({
        type: "solidarity",
      });
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const nextScale =
      event.deltaY > 0
        ? camera.scale * 0.9
        : camera.scale * 1.1;

    setCamera((current) => ({
      ...current,
      scale: clamp(nextScale, 0.4, 4),
    }));
  }

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden bg-slate-100 active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="absolute left-4 right-4 top-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goToPremium();
          }}
          className="flex-1 rounded-full bg-orange-500 px-4 py-3 text-xs font-black text-white shadow-lg"
        >
          Ver Premium
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goToCenter();
          }}
          className="flex-1 rounded-full bg-yellow-400 px-4 py-3 text-xs font-black text-yellow-950 shadow-lg"
        >
          Centro 🔒
        </button>
      </div>

      {selectedSheet?.type === "grand-center" && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/50 p-6"
          onClick={() => setSelectedSheet(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-yellow-300 bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400 text-4xl shadow-lg">
              🔒
            </div>

            <h2 className="text-2xl font-black text-slate-950">
              Área bloqueada
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Reservado para algo grandioso. Em breve.
            </p>

            <button
              type="button"
              onClick={() => setSelectedSheet(null)}
              className="mt-6 w-full rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {selectedSheet?.type === "premium" && (
        <div
          className="fixed inset-x-0 bottom-0 z-[999] rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex h-44 w-full items-center justify-center rounded-3xl bg-slate-950 text-center text-white shadow-lg">
            <div>
              <div className="text-4xl">🧡</div>
              <p className="mt-2 text-sm font-black">
                Imagem Premium
              </p>
            </div>
          </div>

          <h2 className="mt-4 text-xl font-black text-slate-950">
            {FAKE_PREMIUM.title}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {FAKE_PREMIUM.description}
          </p>

          <a
            href={FAKE_PREMIUM.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block w-full rounded-2xl bg-orange-500 py-4 text-center text-sm font-extrabold text-white shadow-lg"
          >
            Visitar link do comprador
          </a>

          <button
            type="button"
            onClick={() => {
              alert("Denúncia registrada para teste.");
            }}
            className="mt-3 w-full rounded-2xl border border-slate-200 py-4 text-sm font-bold text-slate-500"
          >
            Denunciar conteúdo
          </button>

          <button
            type="button"
            onClick={() => setSelectedSheet(null)}
            className="mt-3 w-full rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {selectedSheet?.type === "solidarity" && (
        <div
          className="fixed inset-x-0 bottom-0 z-[999] rounded-t-3xl border border-green-200 bg-white p-5 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-400 text-3xl shadow-lg">
            💚
          </div>

          <h2 className="text-center text-xl font-black text-slate-950">
            Mosaico Solidário
          </h2>

          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            Bloco rápido de R$ 10,00. Aqui o apoiador informa apenas o nome completo.
          </p>

          <a
            href="/checkout"
            className="mt-5 block w-full rounded-2xl bg-green-500 py-4 text-center text-sm font-extrabold text-white shadow-lg"
          >
            Comprar por R$ 10,00
          </a>

          <button
            type="button"
            onClick={() => setSelectedSheet(null)}
            className="mt-3 w-full rounded-2xl bg-slate-950 py-4 text-sm font-extrabold text-white"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
