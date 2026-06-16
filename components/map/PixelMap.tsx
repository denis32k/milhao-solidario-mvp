"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import { getAreaName, getAreaPriceCents, siteConfig } from "@/lib/site-config";

const GRID_COLS = 200;
const GRID_ROWS = 145;
const BLOCK_SIZE = 10;
const MAP_WIDTH = GRID_COLS * BLOCK_SIZE;
const MAP_HEIGHT = GRID_ROWS * BLOCK_SIZE;
const MAX_SCALE = 8;

type BlockCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD";

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
    originX: number | null;
    originY: number | null;
    widthBlocks: number | null;
    heightBlocks: number | null;
  } | null;
};

type SelectedSheet =
  | null
  | { type: "grand-center" }
  | { type: "sold"; block: ApiMapBlock; anchorX: number; anchorY: number };

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
  const isGrandCenter = x >= 95 && x <= 104 && y >= 68 && y <= 77;
  const isGoldRing = x >= 90 && x <= 109 && y >= 63 && y <= 82 && !isGrandCenter;
  const isSolidarityFrame = y < 10 || y >= 135 || x < 24 || x >= 176;

  if (isGrandCenter) return "GRAND_CENTER";
  if (isGoldRing) return "GOLD";
  if (isSolidarityFrame) return "SOLIDARITY";
  return "PREMIUM";
}

function getBlockPrice(category: BlockCategory) {
  if (category === "SOLIDARITY" || category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER") {
    return getAreaPriceCents(category);
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

function blocksFormRectangle(blocks: Array<{ gridX: number; gridY: number }>) {
  if (blocks.length <= 1) return true;

  const minX = Math.min(...blocks.map((block) => block.gridX));
  const maxX = Math.max(...blocks.map((block) => block.gridX));
  const minY = Math.min(...blocks.map((block) => block.gridY));
  const maxY = Math.max(...blocks.map((block) => block.gridY));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  return width * height === blocks.length;
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
  if (block.status === "BLOCKED") return "#64748b";
  if (block.placement?.status === "BANNED" || block.placement?.status === "REMOVED") return "#64748b";
  if (block.category === "SOLIDARITY") return block.placement?.fillColor || "#22c55e";
  if (block.category === "GOLD") return "#f59e0b";
  if (block.category === "PREMIUM") return "#0f172a";
  return "#facc15";
}

function getAvailableBlockColor(category: BlockCategory) {
  if (category === "SOLIDARITY") return "#dcfce7";
  if (category === "GOLD") return "#fde68a";
  if (category === "PREMIUM") return "#eef2ff";
  return "#facc15";
}

function getCategoryLabel(category: BuyableCategory) {
  return getAreaName(category);
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

function normalizeExternalUrl(url: string | null | undefined) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!image.naturalWidth || !image.naturalHeight) return;

  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

export default function PixelMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const isDraggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef<PinchStart | null>(null);

  const [selectedSheet, setSelectedSheet] = useState<SelectedSheet>(null);
  const [mapBlocks, setMapBlocks] = useState<ApiMapBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });

  const selectedCategory = selectedBlocks[0]?.category || null;
  const selectedNeedsRectangle = selectedCategory === "PREMIUM" || selectedCategory === "GOLD";
  const selectedIsRectangle = blocksFormRectangle(selectedBlocks);
  const canContinue = selectedBlocks.length > 0 && (!selectedNeedsRectangle || selectedIsRectangle);

  const selectedSubtotalCents = selectedBlocks.reduce(
    (total, block) => total + block.priceCents,
    0
  );
  const selectedFeeCents = Math.ceil(selectedSubtotalCents * 0.1);
  const selectedTotalCents = selectedSubtotalCents + selectedFeeCents;

  function getMinScale() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 1;
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

    return { x: nextX, y: nextY, scale };
  }

  function focusCenter() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const minScale = getMinScale();
    const nextScale = clamp(minScale * 2.15, minScale, MAX_SCALE);

    setCamera(
      clampCamera({
        x: rect.width / 2 - (MAP_WIDTH / 2) * nextScale,
        y: rect.height / 2 - (MAP_HEIGHT / 2) * nextScale,
        scale: nextScale,
      })
    );
  }

  useEffect(() => {
    focusCenter();

    function handleResize() {
      focusCenter();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let isAlive = true;

    async function loadMapBlocks() {
      try {
        setIsLoadingBlocks(true);
        const response = await fetch("/api/map/blocks", { cache: "no-store" });
        const data = await response.json();
        if (!isAlive) return;
        if (data.ok) setMapBlocks(data.blocks);
      } catch (error) {
        console.error("Erro ao carregar blocos do mapa:", error);
      } finally {
        if (isAlive) setIsLoadingBlocks(false);
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

  function getMapBlockAt(x: number, y: number) {
    return mapBlocks.find((block) => block.gridX === x && block.gridY === y);
  }

  function isSelected(x: number, y: number) {
    return selectedBlocks.some((block) => block.gridX === x && block.gridY === y);
  }

  function getImage(url: string) {
    const cached = imageCacheRef.current.get(url);

    if (cached) return cached;

    const image = new Image();
    image.src = url;
    image.onload = () => drawMap();
    image.onerror = () => console.warn("Não foi possível carregar imagem do grid:", url);
    imageCacheRef.current.set(url, image);
    return image;
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

        ctx.fillStyle = soldBlock ? getSoldBlockColor(soldBlock) : getAvailableBlockColor(type);
        ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
        ctx.lineWidth = 0.35;
        ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    const imageGroups = new Map<string, ApiMapBlock[]>();

    for (const block of mapBlocks) {
      const placement = block.placement;
      if (!placement?.imageUrl) continue;
      if (placement.status !== "ACTIVE") continue;
      if (block.category === "SOLIDARITY") continue;

      const group = imageGroups.get(placement.id) || [];
      group.push(block);
      imageGroups.set(placement.id, group);
    }

    for (const blocks of imageGroups.values()) {
      const placement = blocks[0]?.placement;
      if (!placement?.imageUrl) continue;

      const image = getImage(placement.imageUrl);
      if (!image.complete || !image.naturalWidth) continue;

      const minX = Math.min(...blocks.map((block) => block.gridX));
      const maxX = Math.max(...blocks.map((block) => block.gridX));
      const minY = Math.min(...blocks.map((block) => block.gridY));
      const maxY = Math.max(...blocks.map((block) => block.gridY));
      const x = minX * BLOCK_SIZE;
      const y = minY * BLOCK_SIZE;
      const width = (maxX - minX + 1) * BLOCK_SIZE;
      const height = (maxY - minY + 1) * BLOCK_SIZE;

      drawImageCover(ctx, image, x, y, width, height);

      ctx.strokeStyle = blocks[0].category === "GOLD" ? "#92400e" : "#020617";
      ctx.lineWidth = 2.2;
      ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    }

    for (const block of selectedBlocks) {
      const px = block.gridX * BLOCK_SIZE;
      const py = block.gridY * BLOCK_SIZE;

      ctx.fillStyle = "rgba(37, 99, 235, 0.86)";
      ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(px + 0.5, py + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
    }

    ctx.fillStyle = "#78350f";
    ctx.font = "34px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔒", 1000, 725);

    if (isLoadingBlocks) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(850, 675, 300, 80);
      ctx.fillStyle = "#ffffff";
      ctx.font = "22px Arial";
      ctx.fillText("Carregando mapa...", 1000, 715);
    }

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

    if (gridX < 0 || gridX >= GRID_COLS || gridY < 0 || gridY >= GRID_ROWS) {
      return null;
    }

    return { x: gridX, y: gridY, type: getBlockType(gridX, gridY) };
  }

  function clearSelection(event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    setSelectedBlocks([]);
    setSelectionMessage("");
  }

  function selectBlock(gridX: number, gridY: number, category: BlockCategory, clientX: number, clientY: number) {
    if (category === "GRAND_CENTER") {
      setSelectedSheet({ type: "grand-center" });
      return;
    }

    const soldBlock = getMapBlockAt(gridX, gridY);

    if (soldBlock) {
      setSelectedSheet({ type: "sold", block: soldBlock, anchorX: clientX, anchorY: clientY });
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

    const nextBlocks = [
      ...selectedBlocks,
      { gridX, gridY, category, priceCents: getBlockPrice(category) },
    ];

    if ((category === "PREMIUM" || category === "GOLD") && !blocksFormRectangle(nextBlocks)) {
      setSelectionMessage("A imagem precisa de uma área retangular. Complete o retângulo para continuar.");
    } else {
      setSelectionMessage("");
    }

    setSelectedBlocks(nextBlocks as SelectedBlock[]);
  }

  function getPointerList() {
    return Array.from(activePointersRef.current.values());
  }

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function startPinchIfPossible() {
    const wrapper = wrapperRef.current;
    const pointers = getPointerList();
    if (!wrapper || pointers.length < 2) {
      pinchStartRef.current = null;
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const center = getPointerCenter(pointers[0], pointers[1]);
    const screenX = center.x - rect.left;
    const screenY = center.y - rect.top;

    pinchStartRef.current = {
      distance: getPointerDistance(pointers[0], pointers[1]),
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
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
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
      const center = getPointerCenter(pointers[0], pointers[1]);
      const distance = getPointerDistance(pointers[0], pointers[1]);
      const screenX = center.x - rect.left;
      const screenY = center.y - rect.top;
      const nextScale = clamp(
        pinchStart.scale * (distance / pinchStart.distance),
        getMinScale(),
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

    if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;

    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    setCamera((current) =>
      clampCamera({ ...current, x: current.x + dx, y: current.y + dy })
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

    selectBlock(gridPosition.x, gridPosition.y, gridPosition.type, event.clientX, event.clientY);
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

  function getBubbleStyle(anchorX: number, anchorY: number) {
    if (typeof window === "undefined") {
      return { left: anchorX, top: anchorY };
    }

    const width = 292;
    const height = 230;
    return {
      left: clamp(anchorX + 14, 12, window.innerWidth - width - 12),
      top: clamp(anchorY + 14, 74, window.innerHeight - height - 12),
    };
  }

  async function reportBlock(block: ApiMapBlock) {
    const reason = window.prompt("Conte rapidamente o motivo da denúncia:");
    if (!reason || reason.trim().length < 3) return;

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: block.id, reason }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Erro ao enviar denúncia.");
      }

      alert("Denúncia enviada. Obrigado por ajudar a manter o mapa seguro.");
      setSelectedSheet(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao denunciar.");
    }
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

      {selectedBlocks.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Blocos</p>
                <p className="text-base font-black text-slate-950">{selectedBlocks.length}</p>
              </div>

              <div className="rounded-2xl bg-green-50 p-2">
                <p className="text-[10px] font-black uppercase text-green-700">Tipo</p>
                <p className="text-xs font-black text-green-900">
                  {getCategoryLabel(selectedBlocks[0].category)}
                </p>
              </div>

              <div className="rounded-2xl bg-orange-50 p-2">
                <p className="text-[10px] font-black uppercase text-orange-700">Total</p>
                <p className="text-xs font-black text-orange-900">{money(selectedTotalCents)}</p>
              </div>
            </div>

            <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-bold text-slate-500">
              {selectedBlocks.map((block) => `x${block.gridX}/y${block.gridY}`).join(" • ")}
            </p>

            {(selectionMessage || (selectedNeedsRectangle && !selectedIsRectangle)) && (
              <p className="mt-2 rounded-2xl bg-yellow-100 p-2 text-center text-xs font-black text-yellow-800">
                {selectionMessage || "A imagem precisa de uma área retangular."}
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

              {canContinue ? (
                <a
                  href={buildCheckoutHref(selectedBlocks)}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-2xl bg-green-600 py-3 text-center text-sm font-black text-white shadow-lg"
                >
                  Continuar
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-slate-300 py-3 text-center text-sm font-black text-slate-500"
                >
                  Continuar
                </button>
              )}
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
            <h2 className="text-2xl font-black text-slate-950">Área Legendária</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {siteConfig.copy.legendaryMessage}
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
        <div
          className="fixed z-[999] w-[292px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl"
          style={getBubbleStyle(selectedSheet.anchorX, selectedSheet.anchorY)}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="absolute -left-2 top-6 h-4 w-4 rotate-45 border-b border-l border-slate-200 bg-white" />
          <button
            type="button"
            onClick={() => setSelectedSheet(null)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700"
          >
            ×
          </button>

          <p className="pr-8 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
            {selectedSheet.block.category === "GOLD"
              ? getAreaName("GOLD")
              : selectedSheet.block.category === "PREMIUM"
                ? getAreaName("PREMIUM")
                : getAreaName("SOLIDARITY")}
          </p>

          <h2 className="mt-1 pr-8 text-lg font-black leading-tight text-slate-950">
            {getDisplayName(selectedSheet.block)}
          </h2>

          {selectedSheet.block.placement?.description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {selectedSheet.block.placement.description}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            {selectedSheet.block.placement?.redirectUrl && !selectedSheet.block.placement.linkDisabled && (
              <a
                href={normalizeExternalUrl(selectedSheet.block.placement.redirectUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-slate-950 py-3 text-center text-xs font-black text-white"
              >
                Visitar link
              </a>
            )}

            <button
              type="button"
              onClick={() => reportBlock(selectedSheet.block)}
              className="mx-auto rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-600"
            >
              {siteConfig.copy.reportButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
