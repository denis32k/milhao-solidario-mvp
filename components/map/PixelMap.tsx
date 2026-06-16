"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";

const GRID_COLS = 200;
const GRID_ROWS = 145;
const BLOCK_SIZE = 10;
const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;
const MAX_SCALE = 8;

type BlockCategory = "SOLIDARITY" | "PREMIUM" | "GRAND_CENTER";
type BuyableCategory = "SOLIDARITY" | "PREMIUM";

type Camera = {
  x: number;
  y: number;
  scale: number;
};

type SelectedBlock = {
  gridX: number;
  gridY: number;
  category: BuyableCategory;
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
  | { type: "sold"; block: ApiMapBlock };

type PointerPoint = {
  x: number;
  y: number;
};

type PinchStart = {
  distance: number;
  scale: number;
  worldX: number;
  worldY: number;
};

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

function getPointerDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPointerCenter(a: PointerPoint, b: PointerPoint) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
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
    block.placement?.title ||
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

function getCategoryLabel(category: BuyableCategory) {
  return category === "SOLIDARITY" ? "Mosaico" : "Premium";
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

  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const isDraggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef<PinchStart | null>(null);

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

  function getMinScale() {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return 1;
    }

    const rect = wrapper.getBoundingClientRect();

    return Math.max(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
  }

  function clampCamera(nextCamera: Camera): Camera {
    const wrapper = wrapperRef.current;

    if (!wrapper) return nextCamera;

    const rect = wrapper.getBoundingClientRect();
    const minScale = getMinScale();
    const scale = clamp(nextCamera.scale, minScale, MAX_SCALE);

    const scaledWidth = MAP_WIDTH * scale;
    const scaledHeight = MAP_HEIGHT * scale;

    let nextX = nextCamera.x;
    let nextY = nextCamera.y;

    if (scaledWidth <= rect.width) {
      nextX = (rect.width - scaledWidth) / 2;
    } else {
      nextX = clamp(nextX, rect.width - scaledWidth, 0);
    }

    if (scaledHeight <= rect.height) {
      nextY = (rect.height - scaledHeight) / 2;
    } else {
      nextY = clamp(nextY, rect.height - scaledHeight, 0);
    }

    return {
      x: nextX,
      y: nextY,
      scale,
    };
  }

  function fitGridToScreen() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const nextScale = Math.max(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);

    setCamera(
      clampCamera({
        x: (rect.width - MAP_WIDTH * nextScale) / 2,
        y: (rect.height - MAP_HEIGHT * nextScale) / 2,
        scale: nextScale,
      })
    );
  }

  useEffect(() => {
    fitGridToScreen();

    function handleResize() {
      fitGridToScreen();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
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

    ctx.fillStyle = "#e2e8f0";
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
          ctx.fillStyle = "#eef2ff";
        }

        ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        ctx.strokeStyle = "rgba(15, 23, 42, 0.24)";
        ctx.lineWidth = 0.38;
        ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        if (isSelected(x, y)) {
          ctx.fillStyle = "rgba(37, 99, 235, 0.85)";
          ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

          ctx.strokeStyle = "#1d4ed8";
          ctx.lineWidth = 1.8;
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

  function clearSelection(event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
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
        setSelectionMessage("Continue selecionando blocos do mesmo tipo ou limpe para começar outro tipo.");
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

  function getPointerList() {
    return Array.from(activePointersRef.current.values());
  }

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function startPinchIfPossible() {
    const wrapper = wrapperRef.current;
    const pointers = getPointerList();

    if (!wrapper || pointers.length < 2) {
      pinchStartRef.current = null;
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const first = pointers[0];
    const second = pointers[1];
    const center = getPointerCenter(first, second);
    const screenX = center.x - rect.left;
    const screenY = center.y - rect.top;

    pinchStartRef.current = {
      distance: getPointerDistance(first, second),
      scale: camera.scale,
      worldX: (screenX - camera.x) / camera.scale,
      worldY: (screenY - camera.y) / camera.scale,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointer(event);

    movedRef.current = false;

    if (activePointersRef.current.size >= 2) {
      isDraggingRef.current = false;
      startPinchIfPossible();
      return;
    }

    isDraggingRef.current = true;
    pinchStartRef.current = null;
    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!activePointersRef.current.has(event.pointerId)) return;

    updatePointer(event);

    const pointers = getPointerList();

    if (pointers.length >= 2) {
      const wrapper = wrapperRef.current;
      const pinchStart = pinchStartRef.current;

      if (!wrapper || !pinchStart) return;

      movedRef.current = true;

      const rect = wrapper.getBoundingClientRect();
      const first = pointers[0];
      const second = pointers[1];
      const center = getPointerCenter(first, second);
      const distance = getPointerDistance(first, second);

      const screenX = center.x - rect.left;
      const screenY = center.y - rect.top;
      const minScale = getMinScale();
      const nextScale = clamp(
        pinchStart.scale * (distance / pinchStart.distance),
        minScale,
        MAX_SCALE
      );

      setCamera(
        clampCamera({
          x: screenX - pinchStart.worldX * nextScale,
          y: screenY - pinchStart.worldY * nextScale,
          scale: nextScale,
        })
      );

      return;
    }

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

    setCamera((current) =>
      clampCamera({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      })
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    pinchStartRef.current = null;

    const pointers = getPointerList();

    if (pointers.length === 1) {
      isDraggingRef.current = true;
      lastPointerRef.current = pointers[0];
    } else {
      isDraggingRef.current = false;
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (movedRef.current) return;

    const gridPosition = getGridPosition(event.clientX, event.clientY);

    if (!gridPosition) return;

    selectBlock(gridPosition.x, gridPosition.y, gridPosition.type);
  }

  function zoomBy(multiplier: number) {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - camera.x) / camera.scale;
    const worldY = (centerY - camera.y) / camera.scale;
    const nextScale = clamp(camera.scale * multiplier, getMinScale(), MAX_SCALE);

    setCamera(
      clampCamera({
        x: centerX - worldX * nextScale,
        y: centerY - worldY * nextScale,
        scale: nextScale,
      })
    );
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldX = (screenX - camera.x) / camera.scale;
    const worldY = (screenY - camera.y) / camera.scale;
    const nextScale = clamp(
      event.deltaY > 0 ? camera.scale * 0.9 : camera.scale * 1.1,
      getMinScale(),
      MAX_SCALE
    );

    setCamera(
      clampCamera({
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
        scale: nextScale,
      })
    );
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

      <div
        className="absolute right-3 top-3 z-40 flex flex-col gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-slate-950 shadow-lg"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.8)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-slate-950 shadow-lg"
        >
          -
        </button>
        <button
          type="button"
          onClick={fitGridToScreen}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-black text-slate-950 shadow-lg"
        >
          ⌂
        </button>
      </div>

      {selectedBlocks.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  Blocos
                </p>
                <p className="text-base font-black text-slate-950">
                  {selectedBlocks.length}
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-2">
                <p className="text-[10px] font-black uppercase text-green-700">
                  Tipo
                </p>
                <p className="text-xs font-black text-green-900">
                  {getCategoryLabel(selectedBlocks[0].category)}
                </p>
              </div>

              <div className="rounded-2xl bg-orange-50 p-2">
                <p className="text-[10px] font-black uppercase text-orange-700">
                  Total
                </p>
                <p className="text-xs font-black text-orange-900">
                  {money(selectedTotalCents)}
                </p>
              </div>
            </div>

            <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-bold text-slate-500">
              {selectedBlocks
                .map((block) => `x${block.gridX}/y${block.gridY}`)
                .join(" • ")}
            </p>

            {selectionMessage && (
              <p className="mt-2 rounded-2xl bg-yellow-100 p-2 text-center text-xs font-black text-yellow-800">
                {selectionMessage}
              </p>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-2xl bg-slate-100 py-3 text-sm font-black text-slate-800"
              >
                Limpar
              </button>

              <a
                href={buildCheckoutHref(selectedBlocks)}
                onClick={(event) => event.stopPropagation()}
                className="rounded-2xl bg-green-600 py-3 text-center text-sm font-black text-white shadow-lg"
              >
                Continuar
              </a>
            </div>
          </div>
        </div>
      )}


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
