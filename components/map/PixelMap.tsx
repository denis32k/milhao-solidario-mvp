"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

const GRID_COLS = 200;
const GRID_ROWS = 145;
const BLOCK_SIZE = 10;
const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;

type BlockCategory = "SOLIDARITY" | "PREMIUM" | "GRAND_CENTER";

type Camera = {
  x: number;
  y: number;
  scale: number;
};

type SelectedBlock = {
  gridX: number;
  gridY: number;
  category: Exclude<BlockCategory, "GRAND_CENTER">;
  priceCents: number;
};

type ApiMapBlock = {
  id: string;
  gridX: number;
  gridY: number;
  category: BlockCategory;
  status: string;
  available: boolean;
  priceCents: number;
  owner: {
    name: string;
    publicName: string | null;
    totalApprovedCents: number;
  } | null;
  placement: {
    id: string;
    kind: string;
    status: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    redirectUrl: string | null;
    linkDisabled: boolean;
    displayName: string | null;
    textLabel: string | null;
    fillColor: string | null;
    placeholderReason: string | null;
  } | null;
};

type SelectedSheet =
  | null
  | { type: "grand-center" }
  | { type: "sold"; block: ApiMapBlock }
  | { type: "premium-info" };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getBlockType(x: number, y: number): BlockCategory {
  const isGrandCenter = x >= 99 && x <= 100 && y >= 70 && y <= 74;

  if (isGrandCenter) {
    return "GRAND_CENTER";
  }

  if (y < 25 || y >= 120) {
    return "SOLIDARITY";
  }

  return "PREMIUM";
}

function getBlockPrice(category: BlockCategory) {
  if (category === "SOLIDARITY") {
    return 1000;
  }

  if (category === "PREMIUM") {
    return 10000;
  }

  return 0;
}

function getBlockKey(x: number, y: number) {
  return `${x}:${y}`;
}

function isAdjacentToSelection(
  selectedBlocks: SelectedBlock[],
  gridX: number,
  gridY: number
) {
  if (selectedBlocks.length === 0) {
    return true;
  }

  return selectedBlocks.some((block) => {
    const dx = Math.abs(block.gridX - gridX);
    const dy = Math.abs(block.gridY - gridY);

    return dx + dy === 1;
  });
}

function getDisplayName(block: ApiMapBlock) {
  return (
    block.placement?.displayName ||
    block.placement?.textLabel ||
    block.owner?.publicName ||
    block.owner?.name ||
    "Apoiador"
  );
}

function getSoldBlockColor(block: ApiMapBlock) {
  if (block.status === "BLOCKED") {
    return "#64748b";
  }

  if (block.category === "SOLIDARITY") {
    return block.placement?.fillColor || "#16a34a";
  }

  if (block.category === "PREMIUM") {
    return "#0f172a";
  }

  return "#facc15";
}

function buildCheckoutHref(selectedBlocks: SelectedBlock[]) {
  const params = new URLSearchParams();

  params.set(
    "blocks",
    selectedBlocks
      .map((block) => `${block.gridX}:${block.gridY}`)
      .join(",")
  );

  params.set("category", selectedBlocks[0]?.category || "SOLIDARITY");

  return `/checkout?${params.toString()}`;
}

export default function PixelMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const [selectedSheet, setSelectedSheet] = useState<SelectedSheet>(null);
  const [mapBlocks, setMapBlocks] = useState<ApiMapBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);

  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    scale: 1,
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const nextScale = Math.max(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);

    setCamera({
      x: (rect.width - MAP_WIDTH * nextScale) / 2,
      y: (rect.height - MAP_HEIGHT * nextScale) / 2,
      scale: nextScale,
    });
  }, []);

  useEffect(() => {
    let isAlive = true;

    async function loadMapBlocks() {
      try {
        setIsLoadingBlocks(true);

        const response = await fetch("/api/map/blocks", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!isAlive) return;

        if (data.ok) {
          setMapBlocks(data.blocks);
        }
      } catch (error) {
        console.error("Erro ao carregar blocos do mapa:", error);
      } finally {
        if (isAlive) {
          setIsLoadingBlocks(false);
        }
      }
    }

    loadMapBlocks();

    return () => {
      isAlive = false;
    };
  }, []);

  useEffect(() => {
    drawMap();
  }, [camera, mapBlocks, selectedBlocks]);

  const selectedSubtotalCents = selectedBlocks.reduce(
    (total, block) => total + block.priceCents,
    0
  );

  const selectedFeeCents = Math.ceil(selectedSubtotalCents * 0.1);
  const selectedTotalCents = selectedSubtotalCents + selectedFeeCents;

  function getMapBlockAt(x: number, y: number) {
    return mapBlocks.find((block) => block.gridX === x && block.gridY === y);
  }

  function isSelected(x: number, y: number) {
    return selectedBlocks.some(
      (block) => block.gridX === x && block.gridY === y
    );
  }

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

    const soldBlockByCoord = new Map(
      mapBlocks.map((block) => [getBlockKey(block.gridX, block.gridY), block])
    );

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "#dcfce7";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const type = getBlockType(x, y);
        const soldBlock = soldBlockByCoord.get(getBlockKey(x, y));

        const px = x * BLOCK_SIZE;
        const py = y * BLOCK_SIZE;

        if (soldBlock) {
          ctx.fillStyle = getSoldBlockColor(soldBlock);
        } else if (type === "GRAND_CENTER") {
          ctx.fillStyle = "#facc15";
        } else if (type === "SOLIDARITY") {
          ctx.fillStyle = "#bbf7d0";
        } else {
          ctx.fillStyle = "#e2e8f0";
        }

        ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
        ctx.lineWidth = 0.35;
        ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        if (isSelected(x, y)) {
          ctx.fillStyle = "rgba(37, 99, 235, 0.78)";
          ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

          ctx.strokeStyle = "#1d4ed8";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 0.5, py + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }

        if (soldBlock && camera.scale >= 1.8) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "7px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✓", px + BLOCK_SIZE / 2, py + BLOCK_SIZE / 2);
        }
      }
    }

    ctx.fillStyle = "#78350f";
    ctx.font = "26px Arial";
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

  function goToFullGrid() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const nextScale = Math.max(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);

    setCamera({
      x: (rect.width - MAP_WIDTH * nextScale) / 2,
      y: (rect.height - MAP_HEIGHT * nextScale) / 2,
      scale: nextScale,
    });
  }

  function clearSelection() {
    setSelectedBlocks([]);
    setSelectionMessage("");
  }

  function selectBlock(gridX: number, gridY: number, category: BlockCategory) {
    if (category === "GRAND_CENTER") {
      setSelectedSheet({ type: "grand-center" });
      return;
    }

    const soldBlock = getMapBlockAt(gridX, gridY);

    if (soldBlock) {
      setSelectedSheet({ type: "sold", block: soldBlock });
      return;
    }

    if (isSelected(gridX, gridY)) {
      setSelectionMessage("Esse bloco já está selecionado. Use limpar para começar de novo.");
      return;
    }

    if (selectedBlocks.length > 0) {
      const firstCategory = selectedBlocks[0].category;

      if (firstCategory !== category) {
        setSelectionMessage("Não misture tipos de bloco na mesma compra.");
        return;
      }
    }

    if (!isAdjacentToSelection(selectedBlocks, gridX, gridY)) {
      setSelectionMessage("Escolha um bloco encostado nos que já selecionou.");
      return;
    }

    setSelectionMessage("");

    setSelectedBlocks((current) => [
      ...current,
      {
        gridX,
        gridY,
        category,
        priceCents: getBlockPrice(category),
      },
    ]);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);

    isDraggingRef.current = true;
    movedRef.current = false;

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;

    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;

    if (Math.abs(dx) + Math.abs(dy) > 3) {
      movedRef.current = true;
    }

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
    if (movedRef.current) return;

    const gridPosition = getGridPosition(event.clientX, event.clientY);

    if (!gridPosition) return;

    selectBlock(gridPosition.x, gridPosition.y, gridPosition.type);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const nextScale =
      event.deltaY > 0 ? camera.scale * 0.9 : camera.scale * 1.1;

    setCamera((current) => ({
      ...current,
      scale: clamp(nextScale, 0.55, 7),
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

      <div className="absolute left-3 right-3 top-3 z-40 flex gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goToFullGrid();
          }}
          className="rounded-full bg-white px-4 py-3 text-xs font-black text-slate-950 shadow-lg"
        >
          Ver grid inteiro
        </button>

        <div className="ml-auto rounded-full bg-green-600 px-4 py-3 text-xs font-black text-white shadow-lg">
          {isLoadingBlocks ? "Carregando..." : `Vendidos ${mapBlocks.length}`}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mx-auto max-w-3xl">
          {selectedBlocks.length === 0 && (
            <div className="text-center">
              <p className="text-sm font-black text-slate-950">
                Toque nos blocos que deseja comprar
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Depois do primeiro bloco, os próximos precisam estar encostados.
              </p>
            </div>
          )}

          {selectedBlocks.length > 0 && (
            <div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    Blocos
                  </p>
                  <p className="text-lg font-black text-slate-950">
                    {selectedBlocks.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-green-50 p-3">
                  <p className="text-[10px] font-black uppercase text-green-700">
                    Tipo
                  </p>
                  <p className="text-sm font-black text-green-900">
                    {selectedBlocks[0].category === "SOLIDARITY"
                      ? "Mosaico"
                      : "Premium"}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-3">
                  <p className="text-[10px] font-black uppercase text-orange-700">
                    Total
                  </p>
                  <p className="text-sm font-black text-orange-900">
                    {money(selectedTotalCents)}
                  </p>
                </div>
              </div>

              {selectionMessage && (
                <p className="mt-3 rounded-2xl bg-yellow-100 p-3 text-center text-xs font-black text-yellow-800">
                  {selectionMessage}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-800"
                >
                  Limpar seleção
                </button>

                <a
                  href={buildCheckoutHref(selectedBlocks)}
                  className="rounded-2xl bg-green-600 py-4 text-center text-sm font-black text-white shadow-lg"
                >
                  Continuar
                </a>
              </div>

              <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                Valor inclui taxa operacional de 10%.
              </p>
            </div>
          )}
        </div>
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

      {selectedSheet?.type === "sold" && (
        <div className="fixed inset-x-0 bottom-0 z-[999] rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex h-32 w-full items-center justify-center rounded-3xl bg-green-600 text-center text-white shadow-lg">
            <div>
              <div className="text-4xl">
                {selectedSheet.block.category === "PREMIUM" ? "🔥" : "💚"}
              </div>
              <p className="mt-2 text-sm font-black">Bloco vendido</p>
            </div>
          </div>

          <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">
            {selectedSheet.block.category === "PREMIUM"
              ? "Área Premium"
              : "Mosaico Solidário"}
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            {getDisplayName(selectedSheet.block)}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {selectedSheet.block.placement?.description ||
              "Esse apoiador já faz parte do Milhão Solidário."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500">
                Posição
              </p>
              <p className="text-sm font-black text-slate-950">
                x{selectedSheet.block.gridX} / y{selectedSheet.block.gridY}
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase text-green-700">
                Valor
              </p>
              <p className="text-sm font-black text-green-800">
                {money(selectedSheet.block.priceCents)}
              </p>
            </div>
          </div>

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
