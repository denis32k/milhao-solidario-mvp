"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import { getAreaName, getAreaPriceCents, siteConfig } from "@/lib/site-config";
import {
  AREA_DIVIDERS,
  BLOCK_SIZE,
  getBlockCategory,
  GRID_COLS,
  GRID_ROWS,
  MAP_HEIGHT,
  MAP_WIDTH,
  NOBLE_AREAS,
} from "@/lib/grid";

const MAX_SCALE = 8;
const MURAL_IMAGE_URL = "/mural-rio.png";
// As linhas finas amarelas precisam ficar exatamente no centro do vão preto entre as duas linhas douradas grossas da arte.
const VISUAL_AREA_DIVIDERS_PX = [646.5, 1555.5] as const;

type BlockCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";
type BuyableCategory = "SOLIDARITY" | "PREMIUM" | "GOLD" | "GRAND_CENTER";

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

function isAdjacentToSelection(selectedBlocks: SelectedBlock[], gridX: number, gridY: number) {
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
    "Comprador"
  );
}

function getSoldBlockOverlayColor(block: ApiMapBlock) {
  if (block.status === "BLOCKED") return "rgba(100,116,139,0.85)";
  if (block.placement?.status === "BANNED" || block.placement?.status === "REMOVED") return "rgba(100,116,139,0.85)";
  if (block.status === "RESERVED") return "rgba(148,163,184,0.75)";
  if (block.category === "SOLIDARITY") return `${block.placement?.fillColor || "#22c55e"}CC`;
  if (block.category === "GRAND_CENTER") return "rgba(168,85,247,0.30)";
  if (block.category === "GOLD") return "rgba(245,158,11,0.32)";
  if (block.category === "PREMIUM") return "rgba(14,116,144,0.28)";
  return "rgba(148,163,184,0.7)";
}

function getCategoryLabel(category: BuyableCategory) {
  return getAreaName(category);
}

function buildCheckoutHref(selectedBlocks: SelectedBlock[]) {
  const params = new URLSearchParams();
  params.set(
    "blocks",
    selectedBlocks.map((block) => `${block.gridX}:${block.gridY}`).join(",")
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
  const selectedNeedsRectangle = selectedCategory === "PREMIUM" || selectedCategory === "GOLD" || selectedCategory === "GRAND_CENTER";
  const selectedIsRectangle = blocksFormRectangle(selectedBlocks);
  const canContinue = selectedBlocks.length > 0 && (!selectedNeedsRectangle || selectedIsRectangle);

  const selectedSubtotalCents = selectedBlocks.reduce((total, block) => total + block.priceCents, 0);
  const selectedFeeCents = Math.ceil(selectedSubtotalCents * (siteConfig.operationalFeePercent / 100));
  const selectedTotalCents = selectedSubtotalCents + selectedFeeCents;

  function getMinScale() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 1;

    const rect = wrapper.getBoundingClientRect();

    // O grid precisa ficar preso na tela e não pode diminuir até virar miniatura.
    // Então o zoom mínimo sempre cobre toda a área visível.
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
    const nextScale = clamp(minScale * 1.02, minScale, MAX_SCALE);

    setCamera(
      clampCamera({
        x: rect.width / 2 - (MAP_WIDTH / 2) * nextScale,
        y: rect.height / 2 - (MAP_HEIGHT / 2) * nextScale,
        scale: nextScale,
      })
    );
  }


  function zoomFromScreenPoint(screenX: number, screenY: number, factor: number) {
    const nextScale = clamp(camera.scale * factor, getMinScale(), MAX_SCALE);
    const worldX = (screenX - camera.x) / camera.scale;
    const worldY = (screenY - camera.y) / camera.scale;

    setCamera(
      clampCamera({
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
        scale: nextScale,
      })
    );
  }

  function zoomBy(factor: number) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    zoomFromScreenPoint(rect.width / 2, rect.height / 2, factor);
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
        console.error("Erro ao carregar tijolinhos do mural:", error);
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
  }, [camera, mapBlocks, selectedBlocks, isLoadingBlocks]);

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

    ctx.imageSmoothingEnabled = false;

    const muralImage = getImage(MURAL_IMAGE_URL);
    const blockByCoord = new Map(mapBlocks.map((block) => [getBlockKey(block.gridX, block.gridY), block]));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const bgGradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    bgGradient.addColorStop(0, "#04101f");
    bgGradient.addColorStop(0.45, "#08243a");
    bgGradient.addColorStop(1, "#04101f");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Fundo de preenchimento leve nas sobras, usando a própria arte sem criar duplicação forte.
    if (muralImage.complete && muralImage.naturalWidth) {
      ctx.save();
      ctx.filter = "blur(80px)";
      ctx.globalAlpha = 0.16;
      drawImageCover(ctx, muralImage, -24, -24, rect.width + 48, rect.height + 48);
      ctx.restore();

      ctx.fillStyle = "rgba(2,6,23,0.42)";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    if (muralImage.complete && muralImage.naturalWidth) {
      ctx.drawImage(muralImage, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, MAP_WIDTH, MAP_HEIGHT);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(0.5, "#164e63");
      gradient.addColorStop(1, "#0f172a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }

    // divisões visuais principais das três áreas.
    // A linha fina amarela fica centralizada entre as duas linhas douradas grossas da própria arte.
    ctx.strokeStyle = "rgba(255,214,10,0.72)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const dividerX of VISUAL_AREA_DIVIDERS_PX) {
      ctx.moveTo(dividerX, 0);
      ctx.lineTo(dividerX, MAP_HEIGHT);
    }
    ctx.stroke();

    // desenha blocos especiais e overlays
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const category = getBlockCategory(x, y);
        const block = blockByCoord.get(getBlockKey(x, y));
        const px = x * BLOCK_SIZE;
        const py = y * BLOCK_SIZE;

        if (category === "GRAND_CENTER") {
          ctx.fillStyle = "rgba(168,85,247,0.10)";
          ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
        }

        if (block && (!block.placement?.imageUrl || block.status === "RESERVED" || block.status === "BLOCKED")) {
          ctx.fillStyle = getSoldBlockOverlayColor(block);
          ctx.fillRect(px + 0.6, py + 0.6, BLOCK_SIZE - 1.2, BLOCK_SIZE - 1.2);
        }

        if (isSelected(x, y)) {
          ctx.fillStyle = "rgba(59,130,246,0.85)";
          ctx.fillRect(px + 0.8, py + 0.8, BLOCK_SIZE - 1.6, BLOCK_SIZE - 1.6);
          ctx.strokeStyle = "rgba(29,78,216,0.95)";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px + 0.6, py + 0.6, BLOCK_SIZE - 1.2, BLOCK_SIZE - 1.2);
        }

        // Grade branca do site. A nova imagem veio sem micrograde, então agora a grade técnica pode aparecer.
        if (camera.scale > 0.45) {
          ctx.strokeStyle = category === "GRAND_CENTER" ? "rgba(250,204,21,0.28)" : "rgba(255,255,255,0.20)";
          ctx.lineWidth = camera.scale > 2 ? 0.28 : 0.16;
          ctx.strokeRect(px + 0.1, py + 0.1, BLOCK_SIZE - 0.2, BLOCK_SIZE - 0.2);
        }
      }
    }

    // imagens de áreas vendidas
    const imageGroups = new Map<string, ApiMapBlock[]>();
    for (const block of mapBlocks) {
      const placement = block.placement;
      if (!placement?.imageUrl) continue;
      if (placement.status !== "ACTIVE") continue;
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

      ctx.strokeStyle = blocks[0].category === "GRAND_CENTER" ? "#a855f7" : blocks[0].category === "GOLD" ? "#f59e0b" : "#0f766e";
      ctx.lineWidth = 2.1;
      ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    }

    // redesenha as divisões no final para ficarem sempre exatamente visíveis entre as duas linhas douradas.
    ctx.strokeStyle = "rgba(255,214,10,0.82)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const dividerX of VISUAL_AREA_DIVIDERS_PX) {
      ctx.moveTo(dividerX, 0);
      ctx.lineTo(dividerX, MAP_HEIGHT);
    }
    ctx.stroke();

    // destaque visual da área nobre Tom Delfim Moreira
    for (const area of NOBLE_AREAS) {
      const x = area.minX * BLOCK_SIZE;
      const y = area.minY * BLOCK_SIZE;
      const width = (area.maxX - area.minX + 1) * BLOCK_SIZE;
      const height = (area.maxY - area.minY + 1) * BLOCK_SIZE;

      ctx.strokeStyle = "rgba(168,85,247,0.78)";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

      if (camera.scale > 1.1) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = camera.scale > 2 ? "18px Arial" : "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("TOM DELFIM MOREIRA", x + width / 2, y + 10);
      }
    }

    if (isLoadingBlocks) {
      const loaderWidth = 420;
      const loaderHeight = 84;
      const loaderX = (MAP_WIDTH - loaderWidth) / 2;
      const loaderY = (MAP_HEIGHT - loaderHeight) / 2;
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      ctx.fillRect(loaderX, loaderY, loaderWidth, loaderHeight);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Carregando mural...", MAP_WIDTH / 2, MAP_HEIGHT / 2);
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

    return { x: gridX, y: gridY, type: getBlockCategory(gridX, gridY) };
  }

  function clearSelection(event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    setSelectedBlocks([]);
    setSelectionMessage("");
  }

  function selectBlock(gridX: number, gridY: number, category: BlockCategory, clientX: number, clientY: number) {

    const soldBlock = getMapBlockAt(gridX, gridY);
    if (soldBlock) {
      setSelectedSheet({ type: "sold", block: soldBlock, anchorX: clientX, anchorY: clientY });
      return;
    }

    if (isSelected(gridX, gridY)) {
      setSelectionMessage("Esse tijolinho já está selecionado. Use limpar para começar de novo.");
      return;
    }

    if (selectedBlocks.length > 0) {
      const firstCategory = selectedBlocks[0].category;
      if (firstCategory !== category) {
        setSelectionMessage("Continue selecionando tijolinhos da mesma área ou limpe para começar outra área.");
        return;
      }
    }

    if (!isAdjacentToSelection(selectedBlocks, gridX, gridY)) {
      setSelectionMessage("Escolha um tijolinho encostado nos que já selecionou.");
      return;
    }

    const nextBlocks = [...selectedBlocks, { gridX, gridY, category, priceCents: getBlockPrice(category) }];
    if ((category === "PREMIUM" || category === "GOLD" || category === "GRAND_CENTER") && !blocksFormRectangle(nextBlocks)) {
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

    setCamera((current) => clampCamera({ ...current, x: current.x + dx, y: current.y + dy }));
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
    zoomFromScreenPoint(screenX, screenY, event.deltaY > 0 ? 0.9 : 1.1);
  }

  function getBubbleStyle(anchorX: number, anchorY: number) {
    if (typeof window === "undefined") {
      return { left: anchorX, top: anchorY };
    }

    const width = 292;
    const height = 220;
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

      alert("Denúncia enviada. Obrigado por ajudar a manter o mural seguro.");
      setSelectedSheet(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao denunciar.");
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden bg-slate-900 active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div
        className="absolute right-3 top-24 z-40 hidden flex-col gap-2 md:flex"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); zoomBy(1.2); }}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-2xl font-black text-slate-900 shadow-xl"
        >
          +
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); zoomBy(1 / 1.2); }}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-2xl font-black text-slate-900 shadow-xl"
        >
          −
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); focusCenter(); }}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-xs font-black text-slate-900 shadow-xl"
        >
          Centro
        </button>
      </div>

      {selectedBlocks.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/98 p-3 shadow-2xl backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Tijolinhos</p>
                <p className="text-base font-black text-slate-950">{selectedBlocks.length}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-2">
                <p className="text-[10px] font-black uppercase text-amber-700">Área</p>
                <p className="text-xs font-black text-amber-900">{getCategoryLabel(selectedBlocks[0].category)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-2">
                <p className="text-[10px] font-black uppercase text-emerald-700">Total</p>
                <p className="text-xs font-black text-emerald-900">{money(selectedTotalCents)}</p>
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
                onPointerDown={(event) => event.stopPropagation()}
                onClick={clearSelection}
                className="rounded-2xl bg-slate-100 py-3 text-sm font-black text-slate-800"
              >
                Limpar
              </button>

              {canContinue ? (
                <a
                  href={buildCheckoutHref(selectedBlocks)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-2xl bg-emerald-600 py-3 text-center text-sm font-black text-white shadow-lg"
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

      {selectedSheet?.type === "sold" && (
        <div
          className="fixed z-[999] w-[292px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl"
          style={getBubbleStyle(selectedSheet.anchorX, selectedSheet.anchorY)}
          onPointerDown={(event) => event.stopPropagation()}
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
            {selectedSheet.block.status === "RESERVED" ? "reservado" : selectedSheet.block.status === "BLOCKED" ? "bloqueado" : "vendido"} • {getAreaName(selectedSheet.block.category)}
          </p>

          <h2 className="mt-1 pr-8 text-lg font-black leading-tight text-slate-950">{getDisplayName(selectedSheet.block)}</h2>

          {selectedSheet.block.placement?.description && (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{selectedSheet.block.placement.description}</p>
          )}

          <div className="mt-4 grid gap-2">
            {selectedSheet.block.placement?.redirectUrl && !selectedSheet.block.placement.linkDisabled && (
              <a
                href={normalizeExternalUrl(selectedSheet.block.placement.redirectUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-slate-950 py-3 text-center text-xs font-black text-white"
              >
                Abrir link
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
