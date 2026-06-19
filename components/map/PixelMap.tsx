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
  reservationToken: string | null;
  reservedUntil: string | null;
  owner: {
    id: string;
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

type PixelMapMode = "official" | "purchase";

type SelectedSheet =
  | null
  | { type: "sold"; block: ApiMapBlock; gridX: number; gridY: number }
  | { type: "available"; gridX: number; gridY: number; category: BuyableCategory; priceCents: number };


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


function getRemainingSeconds(value: string | null | undefined) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

function formatMapTimer(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

function getOwnerRanking(blocks: ApiMapBlock[]) {
  const owners = new Map<string, { id: string; name: string; totalApprovedCents: number }>();

  for (const block of blocks) {
    if (!block.owner?.id) continue;
    const current = owners.get(block.owner.id);
    const totalApprovedCents = Number(block.owner.totalApprovedCents || 0);
    if (!current || totalApprovedCents > current.totalApprovedCents) {
      owners.set(block.owner.id, {
        id: block.owner.id,
        name: block.owner.publicName || block.owner.name || "Comprador",
        totalApprovedCents,
      });
    }
  }

  return Array.from(owners.values())
    .filter((owner) => owner.totalApprovedCents > 0)
    .sort((a, b) => b.totalApprovedCents - a.totalApprovedCents);
}

function getOwnerRank(block: ApiMapBlock, blocks: ApiMapBlock[]) {
  if (!block.owner?.id) return null;
  const ranking = getOwnerRanking(blocks);
  const index = ranking.findIndex((owner) => owner.id === block.owner?.id);
  return index >= 0 ? index + 1 : null;
}

function getBubbleTheme(block: ApiMapBlock, rank: number | null) {
  if (rank === 1) return { box: "border-yellow-300 bg-gradient-to-br from-yellow-50 via-white to-amber-100", badge: "bg-yellow-400 text-yellow-950", label: "🥇 1º lugar" };
  if (rank === 2) return { box: "border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-200", badge: "bg-slate-300 text-slate-950", label: "🥈 2º lugar" };
  if (rank === 3) return { box: "border-orange-300 bg-gradient-to-br from-orange-50 via-white to-orange-100", badge: "bg-orange-300 text-orange-950", label: "🥉 3º lugar" };
  if (rank && rank >= 4 && rank <= 10) return { box: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-white", badge: "bg-fuchsia-600 text-white", label: "VIP Top 10" };
  if (block.category === "GRAND_CENTER") return { box: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-white", badge: "bg-fuchsia-600 text-white", label: "Tom Delfim" };
  if (block.category === "GOLD") return { box: "border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-white", badge: "bg-yellow-400 text-yellow-950", label: "Leblon" };
  if (block.category === "PREMIUM") return { box: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white", badge: "bg-orange-500 text-white", label: "Ipanema" };
  return { box: "border-slate-200 bg-white", badge: "bg-slate-900 text-white", label: getAreaName(block.category) };
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

function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const filename = url.split("/").pop();
    return filename ? `/api/uploads/file/${encodeURIComponent(filename)}` : url;
  }
  return url;
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

export default function PixelMap({ mode = "official" }: { mode?: PixelMapMode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const isDraggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef<PinchStart | null>(null);
  const focusedBlockFromUrlRef = useRef(false);
  const tutorialBlocksRef = useRef<SelectedBlock[]>([]);
  const continueButtonRef = useRef<HTMLAnchorElement | null>(null);

  const [selectedSheet, setSelectedSheet] = useState<SelectedSheet>(null);
  const [mapBlocks, setMapBlocks] = useState<ApiMapBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [clockTick, setClockTick] = useState(0);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const isPurchaseMode = mode === "purchase";
  const selectedCategory = selectedBlocks[0]?.category || null;
  const selectedNeedsRectangle = selectedBlocks.length > 1;
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

  function focusTutorialBlocks(blocks: SelectedBlock[]) {
    const wrapper = wrapperRef.current;
    if (!wrapper || blocks.length === 0) return;

    const rect = wrapper.getBoundingClientRect();
    const minX = Math.min(...blocks.map((block) => block.gridX));
    const maxX = Math.max(...blocks.map((block) => block.gridX));
    const minY = Math.min(...blocks.map((block) => block.gridY));
    const maxY = Math.max(...blocks.map((block) => block.gridY));
    const centerX = ((minX + maxX + 1) / 2) * BLOCK_SIZE;
    const centerY = ((minY + maxY + 1) / 2) * BLOCK_SIZE;
    const nextScale = clamp(MAX_SCALE, getMinScale(), MAX_SCALE);

    setCamera(
      clampCamera({
        x: rect.width / 2 - centerX * nextScale,
        y: rect.height / 2 - centerY * nextScale,
        scale: Math.max(nextScale, getMinScale()),
      })
    );
  }


  function focusPurchasedBlock(block: ApiMapBlock, mode: "placement" | "cell" = "placement") {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const minScale = getMinScale();
    const nextScale = mode === "cell"
      ? clamp(Math.max(minScale * 4.2, 2.1), minScale, MAX_SCALE)
      : clamp(Math.max(minScale * 2.8, 1.15), minScale, MAX_SCALE);
    const centerX = mode === "cell"
      ? (block.gridX + 0.5) * BLOCK_SIZE
      : ((block.placement?.originX ?? block.gridX) + Math.max(1, block.placement?.widthBlocks || 1) / 2) * BLOCK_SIZE;
    const centerY = mode === "cell"
      ? (block.gridY + 0.5) * BLOCK_SIZE
      : ((block.placement?.originY ?? block.gridY) + Math.max(1, block.placement?.heightBlocks || 1) / 2) * BLOCK_SIZE;

    setCamera(
      clampCamera({
        x: rect.width / 2 - centerX * nextScale,
        y: rect.height / 2 - centerY * nextScale,
        scale: nextScale,
      })
    );

    setSelectedSheet({
      type: "sold",
      block,
      gridX: block.gridX,
      gridY: block.gridY,
    });
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
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isPurchaseMode || typeof window === "undefined") {
      setTutorialVisible(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const forcedTour = params.get("tour") === "1" || params.get("tutorial") === "1";

    setTutorialVisible(forcedTour);
    setTutorialStep(0);
  }, [isPurchaseMode]);

  function markPurchaseTutorialSeen() {
    try {
      localStorage.setItem("mural29:purchaseTutorialDone", "1");
    } catch {
      // ignore
    }

    fetch("/api/tutorial/seen", {
      method: "POST",
      keepalive: true,
    }).catch(() => null);
  }

  function finishPurchaseTutorial() {
    markPurchaseTutorialSeen();
    setTutorialVisible(false);
    window.setTimeout(() => {
      window.location.href = "/";
    }, 250);
  }

  function closePurchaseTutorial() {
    finishPurchaseTutorial();
  }

  function advancePurchaseTutorial() {
    setTutorialStep((current) => {
      if (current >= 2) {
        finishPurchaseTutorial();
        return current;
      }
      return current + 1;
    });
  }

  function backPurchaseTutorial() {
    setTutorialStep((current) => Math.max(0, current - 1));
  }

  useEffect(() => {
    if (!tutorialVisible || !isPurchaseMode || isLoadingBlocks) return;

    if (tutorialStep === 0) {
      tutorialBlocksRef.current = [];
      setSelectedBlocks([]);
      return;
    }

    if (tutorialBlocksRef.current.length === 0) {
      tutorialBlocksRef.current = getTutorialSelectionBlocks();
    }

    const demoBlocks = tutorialBlocksRef.current;
    focusTutorialBlocks(demoBlocks);

    if (tutorialStep === 2) {
      setSelectedBlocks(demoBlocks);
      return;
    }

    let index = 0;
    setSelectedBlocks([]);

    const interval = window.setInterval(() => {
      index += 1;
      setSelectedBlocks(demoBlocks.slice(0, index));
      if (index >= demoBlocks.length) window.clearInterval(interval);
    }, 650);

    return () => window.clearInterval(interval);
  }, [tutorialVisible, tutorialStep, isPurchaseMode, isLoadingBlocks]);

  useEffect(() => {
    let isAlive = true;

    let firstLoad = true;

    async function loadMapBlocks() {
      try {
        if (firstLoad) setIsLoadingBlocks(true);
        const response = await fetch(`/api/map/blocks?ts=${Date.now()}`, { cache: "no-store" });
        const data = await response.json();
        if (!isAlive) return;
        if (data.ok) setMapBlocks(data.blocks);
      } catch (error) {
        console.error("Erro ao carregar tijolinhos do mural:", error);
      } finally {
        firstLoad = false;
        if (isAlive) setIsLoadingBlocks(false);
      }
    }

    loadMapBlocks();
    const interval = window.setInterval(loadMapBlocks, 2000);
    return () => {
      isAlive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (focusedBlockFromUrlRef.current || isLoadingBlocks || mapBlocks.length === 0) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const blockId = params.get("bloco") || params.get("block") || params.get("blockId");
    if (!blockId) return;

    const block = mapBlocks.find((item) => item.id === blockId);
    if (!block) return;

    const focusMode = params.get("foco") === "celula" || params.get("focus") === "cell" ? "cell" : "placement";

    focusedBlockFromUrlRef.current = true;
    window.setTimeout(() => focusPurchasedBlock(block, focusMode), 120);
  }, [mapBlocks, isLoadingBlocks]);

  useEffect(() => {
    drawMap();
  }, [camera, mapBlocks, selectedBlocks, isLoadingBlocks, mode, tutorialVisible, tutorialStep, clockTick]);

  function getMapBlockAt(x: number, y: number) {
    return mapBlocks.find((block) => block.gridX === x && block.gridY === y);
  }

  function getTutorialSelectionBlocks(): SelectedBlock[] {
    const blocked = new Set(mapBlocks.map((block) => getBlockKey(block.gridX, block.gridY)));

    for (let y = 8; y < GRID_ROWS - 2; y++) {
      for (let x = 8; x < GRID_COLS - 2; x++) {
        const category = getBlockCategory(x, y) as BuyableCategory;
        if (!["SOLIDARITY", "PREMIUM", "GOLD", "GRAND_CENTER"].includes(category)) continue;

        const demo = [
          { gridX: x, gridY: y, category, priceCents: getAreaPriceCents(category) },
          { gridX: x + 1, gridY: y, category, priceCents: getAreaPriceCents(category) },
          { gridX: x, gridY: y + 1, category, priceCents: getAreaPriceCents(category) },
          { gridX: x + 1, gridY: y + 1, category, priceCents: getAreaPriceCents(category) },
        ];

        const isFreeRectangle = demo.every((block) => {
          if (blocked.has(getBlockKey(block.gridX, block.gridY))) return false;
          return getBlockCategory(block.gridX, block.gridY) === category;
        });

        if (isFreeRectangle) return demo;
      }
    }

    const fallbackCategory = getBlockCategory(10, 10) as BuyableCategory;
    return [
      { gridX: 10, gridY: 10, category: fallbackCategory, priceCents: getAreaPriceCents(fallbackCategory) },
      { gridX: 11, gridY: 10, category: fallbackCategory, priceCents: getAreaPriceCents(fallbackCategory) },
      { gridX: 10, gridY: 11, category: fallbackCategory, priceCents: getAreaPriceCents(fallbackCategory) },
      { gridX: 11, gridY: 11, category: fallbackCategory, priceCents: getAreaPriceCents(fallbackCategory) },
    ];
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

        if (block?.status === "RESERVED") {
          ctx.strokeStyle = "rgba(245,158,11,0.92)";
          ctx.lineWidth = camera.scale > 2 ? 1.1 : 0.7;
          ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          if (camera.scale > 3.5) {
            ctx.fillStyle = "rgba(120,53,15,0.95)";
            ctx.font = "bold 4px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("R", px + BLOCK_SIZE / 2, py + BLOCK_SIZE / 2);
          }
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

      const image = getImage(normalizeImageUrl(placement.imageUrl));
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

    }

    if (isPurchaseMode) {
      for (const block of mapBlocks) {
        if (block.available && block.status === "AVAILABLE") continue;
        const px = block.gridX * BLOCK_SIZE;
        const py = block.gridY * BLOCK_SIZE;
        ctx.fillStyle = block.status === "RESERVED" ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.28)";
        ctx.fillRect(px + 0.5, py + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.lineWidth = 0.35;
        ctx.strokeRect(px + 0.8, py + 0.8, BLOCK_SIZE - 1.6, BLOCK_SIZE - 1.6);
      }
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

  function getCellScreenAnchor(gridX: number, gridY: number) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;

    const rect = wrapper.getBoundingClientRect();
    const worldX = (gridX + 0.5) * BLOCK_SIZE;
    const worldY = (gridY + 0.5) * BLOCK_SIZE;

    return {
      x: rect.left + camera.x + worldX * camera.scale,
      y: rect.top + camera.y + worldY * camera.scale,
    };
  }

  function getTutorialBubbleStyle() {
    const safeWidth = typeof window === "undefined" ? 360 : window.innerWidth;
    const safeHeight = typeof window === "undefined" ? 720 : window.innerHeight;
    const width = 220;

    if (tutorialStep === 1 && selectedBlocks.length > 0) {
      const anchor = getCellScreenAnchor(selectedBlocks[0].gridX, selectedBlocks[0].gridY);
      if (anchor) {
        const left = clamp(anchor.x + 34, 12, safeWidth - width - 12);
        const top = clamp(anchor.y - 38, 86, safeHeight - 180);
        return { left, top, width };
      }
    }

    if (tutorialStep === 2 && continueButtonRef.current) {
      const rect = continueButtonRef.current.getBoundingClientRect();
      const left = clamp(rect.left + rect.width / 2 - width / 2, 12, safeWidth - width - 12);
      const top = clamp(rect.top - 96, 86, safeHeight - 170);
      return { left, top, width };
    }

    return { left: Math.max(12, safeWidth / 2 - width / 2), top: 8, width };
  }

  function selectBlock(gridX: number, gridY: number, category: BlockCategory, clientX: number, clientY: number) {

    const soldBlock = getMapBlockAt(gridX, gridY);
    if (soldBlock && (!soldBlock.available || soldBlock.status !== "AVAILABLE")) {
      setSelectedSheet({ type: "sold", block: soldBlock, gridX, gridY });
      if (isPurchaseMode) setSelectionMessage("Esse tijolinho já está indisponível. Escolha um espaço livre ao lado.");
      return;
    }

    if (!isPurchaseMode) {
      setSelectedSheet({
        type: "available",
        gridX,
        gridY,
        category: category as BuyableCategory,
        priceCents: getBlockPrice(category),
      });
      return;
    }

    if (isSelected(gridX, gridY)) {
      setSelectedSheet(null);
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

    setSelectedSheet(null);
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
    if (!gridPosition) {
      setSelectedSheet(null);
      return;
    }

    setSelectedSheet(null);
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

  function getBubblePosition(anchorX: number, anchorY: number) {
    if (typeof window === "undefined") {
      return { box: { left: anchorX, top: anchorY }, arrowLeft: 24, isAbove: false };
    }

    const width = 292;
    const estimatedHeight = 320;
    const gap = 18;
    const topBoundary = 166;
    const isAbove = anchorY + gap + estimatedHeight > window.innerHeight - 12;
    const left = clamp(anchorX - width / 2, 12, window.innerWidth - width - 12);
    const top = isAbove
      ? clamp(anchorY - estimatedHeight - gap, topBoundary, window.innerHeight - estimatedHeight - 12)
      : clamp(anchorY + gap, topBoundary, window.innerHeight - estimatedHeight - 12);

    return {
      box: { left, top },
      arrowLeft: clamp(anchorX - left - 8, 18, width - 18),
      isAbove,
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

      {tutorialVisible && (() => {
        const bubbleStyle = getTutorialBubbleStyle();

        return (
          <div
            className="fixed inset-0 z-[998]"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              advancePurchaseTutorial();
            }}
          >
            <div
              className="fixed rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center shadow-2xl"
              style={bubbleStyle}
            >
              {tutorialStep === 0 && <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-white ring-1 ring-slate-200" />}
              {tutorialStep === 1 && <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-sm bg-white ring-1 ring-slate-200" />}
              {tutorialStep === 2 && <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-white ring-1 ring-slate-200" />}

              <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-wide text-orange-600">{tutorialStep + 1}/3</p>
                <h2 className="mt-0.5 text-sm font-black text-slate-950">
                  {tutorialStep === 0 && "Clique aqui para comprar"}
                  {tutorialStep === 1 && "Selecione seus tijolinhos"}
                  {tutorialStep === 2 && "Clique em Continuar"}
                </h2>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {tutorialStep > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        backPurchaseTutorial();
                      }}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-700"
                    >
                      Voltar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      closePurchaseTutorial();
                    }}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-700"
                  >
                    Pular
                  </button>
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">Avançar</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {isPurchaseMode && selectedBlocks.length > 0 && (
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
                {selectionMessage || "Selecione uma área retangular para a imagem ficar bem encaixada."}
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
                  ref={continueButtonRef}
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

      {selectedSheet?.type === "available" && (() => {
        const anchor = getCellScreenAnchor(selectedSheet.gridX, selectedSheet.gridY) || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const bubblePosition = getBubblePosition(anchor.x, anchor.y);

        return (
          <div
            className="fixed z-[999] w-[292px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl"
            style={bubblePosition.box}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`absolute h-4 w-4 rotate-45 border border-inherit bg-inherit ${bubblePosition.isAbove ? "-bottom-2" : "-top-2"}`} style={{ left: bubblePosition.arrowLeft }} />
            <button
              type="button"
              onClick={() => setSelectedSheet(null)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700"
            >
              ×
            </button>

            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">Espaço livre</span>
            <h2 className="mt-3 text-lg font-black leading-tight text-slate-950">{getAreaName(selectedSheet.category)}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">Coordenada x{selectedSheet.gridX}/y{selectedSheet.gridY}</p>
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-relaxed text-slate-600">
              Este espaço ainda está livre. No mural oficial ele aparece apenas como informação pública. Para comprar, acesse a página “Compre seu tijolinho” no cabeçalho.
            </p>
          </div>
        );
      })()}

      {selectedSheet?.type === "sold" && (() => {
        const rank = getOwnerRank(selectedSheet.block, mapBlocks);
        const bubbleTheme = getBubbleTheme(selectedSheet.block, rank);
        const hasImage = Boolean(selectedSheet.block.placement?.imageUrl && selectedSheet.block.placement?.status === "ACTIVE");
        const isWaitingPersonalization = getDisplayName(selectedSheet.block) === "Espaço comprado";
        const publicLink = selectedSheet.block.placement?.redirectUrl && !selectedSheet.block.placement.linkDisabled
          ? normalizeExternalUrl(selectedSheet.block.placement.redirectUrl)
          : "";
        const reservedRemaining = getRemainingSeconds(selectedSheet.block.reservedUntil) + clockTick * 0;
        const anchor = getCellScreenAnchor(selectedSheet.gridX, selectedSheet.gridY) || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const bubblePosition = getBubblePosition(anchor.x, anchor.y);

        return (
          <div
            className={`fixed z-[999] w-[292px] rounded-3xl border p-4 shadow-2xl ${bubbleTheme.box}`}
            style={bubblePosition.box}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`absolute h-4 w-4 rotate-45 border border-inherit bg-inherit ${bubblePosition.isAbove ? "-bottom-2" : "-top-2"}`} style={{ left: bubblePosition.arrowLeft }} />
            <button
              type="button"
              onClick={() => setSelectedSheet(null)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-black text-slate-700"
            >
              ×
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow">
                {hasImage ? (
                  <img src={normalizeImageUrl(selectedSheet.block.placement?.imageUrl)} alt={getDisplayName(selectedSheet.block)} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl">🧱</span>
                )}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase ${bubbleTheme.badge}`}>{bubbleTheme.label}</span>
                <h2 className="mt-2 truncate text-lg font-black leading-tight text-slate-950">{selectedSheet.block.status === "RESERVED" ? "Reservado" : getDisplayName(selectedSheet.block)}</h2>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{getAreaName(selectedSheet.block.category)}</p>
                {selectedSheet.block.status === "RESERVED" && <p className="mt-1 text-[11px] font-black text-amber-700">Tempo: {formatMapTimer(reservedRemaining)}</p>}
              </div>
            </div>

            {selectedSheet.block.status === "RESERVED" ? (
              <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-800">
                Este espaço está reservado por poucos minutos.
              </p>
            ) : isWaitingPersonalization ? (
              <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-relaxed text-slate-600">
                Espaço comprado. Aguardando personalização do comprador.
              </p>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Link público</p>
                {publicLink ? (
                  <a
                    href={publicLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4"
                  >
                    {selectedSheet.block.placement?.redirectUrl}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-400">Sem link público</p>
                )}
              </div>
            )}

            {isPurchaseMode && (
              <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-relaxed text-slate-600">
                Indisponível para compra. Você ainda consegue ver quem está aqui para escolher um espaço livre ao lado.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              {publicLink ? (
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
                >
                  Abrir link
                </a>
              ) : <span />}

              <a href={`/bloco/${selectedSheet.block.id}#denunciar`} className="inline-flex h-8 items-center justify-center rounded-full bg-red-50 px-3 text-[10px] font-black text-red-600">
                Denunciar
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
