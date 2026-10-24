import { getBackgroundImageUrl, loadDecodedImage } from "./homeImage";

const GRID = 6;
const MAX_GLINTS = 96;
const WATERLINE = 0.51;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FRAME_INTERVAL_MS = 1000 / 24;
const REFRESH_DEBOUNCE_MS = 120;
// Decorative subpixel glints do not need a HiDPI backing store; cap memory at CSS resolution.
const CANVAS_PIXEL_RATIO = 1;

type Glint = {
  x: number;
  y: number;
  radius: number;
  phase: number;
  period: number;
  strength: number;
};

function luminance(data: Uint8ClampedArray, index: number): number {
  return (
    data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
  );
}

function findWaterGlints({
  image,
  scene,
  bounds,
  dayTheme,
}: {
  image: HTMLImageElement;
  scene: HTMLElement;
  bounds: DOMRect;
  dayTheme: boolean;
}): Glint[] {
  const gridX = (bounds.width / Math.max(1, scene.offsetWidth)) * GRID;
  const gridY = (bounds.height / Math.max(1, scene.offsetHeight)) * GRID;
  const width = Math.max(1, Math.ceil(bounds.width / gridX));
  const height = Math.max(1, Math.ceil(bounds.height / gridY));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const fit = Math.max(
    bounds.width / image.naturalWidth,
    bounds.height / image.naturalHeight
  );
  const imageWidth = image.naturalWidth * fit;
  const imageHeight = image.naturalHeight * fit;
  context.drawImage(
    image,
    (bounds.width - imageWidth) / (2 * gridX),
    0,
    imageWidth / gridX,
    imageHeight / gridY
  );

  const pixels = context.getImageData(0, 0, width, height).data;
  const brightnessFloor = dayTheme ? 205 : 70;
  const localContrastFloor = dayTheme ? 4 : 9;
  const candidates: Array<Glint & { score: number }> = [];

  // The waterline belongs to the source landscape; highlights are selected from
  // its visible pixels, so cover-cropping never pins them to viewport percentages.
  const firstWaterRow = Math.max(
    2,
    Math.floor((imageHeight * WATERLINE) / gridY)
  );
  for (let row = firstWaterRow; row < height - 2; row++) {
    for (let column = 2; column < width - 2; column++) {
      const index = (row * width + column) * 4;
      const center = luminance(pixels, index);
      if (center < brightnessFloor) continue;

      let neighborTotal = 0;
      let neighborMaximum = 0;
      let neighborCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = luminance(
            pixels,
            ((row + dy) * width + column + dx) * 4
          );
          neighborTotal += neighbor;
          neighborMaximum = Math.max(neighborMaximum, neighbor);
          neighborCount++;
        }
      }

      const localContrast = center - neighborTotal / neighborCount;
      if (
        localContrast < localContrastFloor ||
        center - neighborMaximum < localContrastFloor * 0.28
      ) {
        continue;
      }

      candidates.push({
        x: bounds.left + column * gridX + gridX / 2,
        y: bounds.top + row * gridY + gridY / 2,
        radius: dayTheme
          ? 0.75 + (center % 3) * 0.12
          : 0.7 + (center % 3) * 0.13,
        phase: (column * 17 + row * 31) % 97,
        period: 3.8 + ((column * 7 + row * 13) % 44) / 10,
        strength: Math.min(1, 0.42 + localContrast / (dayTheme ? 45 : 70)),
        score: localContrast + center * 0.04,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: Glint[] = [];
  const minimumDistance = Math.min(gridX, gridY) * 2.4;
  for (const candidate of candidates) {
    if (
      selected.some(
        point =>
          Math.hypot(point.x - candidate.x, point.y - candidate.y) <
          minimumDistance
      )
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= MAX_GLINTS) break;
  }
  return selected;
}

function drawGlints({
  context,
  points,
  bounds,
  elapsed,
  dayTheme,
  reducedMotion,
}: {
  context: CanvasRenderingContext2D;
  points: Glint[];
  bounds: DOMRect;
  elapsed: number;
  dayTheme: boolean;
  reducedMotion: boolean;
}): void {
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = dayTheme ? "#164d66" : "#fff4d6";

  for (const point of points) {
    const flicker = reducedMotion
      ? 0.34
      : 0.22 +
        0.62 * (0.5 + 0.5 * Math.sin(elapsed / point.period + point.phase));
    context.globalAlpha = flicker * point.strength;
    context.beginPath();
    context.ellipse(
      point.x - bounds.left,
      point.y - bounds.top,
      point.radius,
      point.radius * 0.68,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  }
  context.globalAlpha = 1;
}

export function setupHomeWaterGlints(shell: HTMLElement): () => void {
  const canvas = shell.querySelector<HTMLCanvasElement>("[data-home-glints]");
  const dayScene = shell.querySelector<HTMLElement>(
    ".home-backdrop__scene--day"
  );
  const nightScene = shell.querySelector<HTMLElement>(
    ".home-backdrop__scene--night"
  );
  const context = canvas?.getContext("2d");
  if (!canvas || !dayScene || !nightScene || !context) return () => {};

  const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);
  let points: Glint[] = [];
  let bounds = canvas.getBoundingClientRect();
  let animationFrame = 0;
  let refreshTimer = 0;
  let previousFrameAt = 0;
  let refreshGeneration = 0;
  let disposed = false;

  const render = (timestamp: number) => {
    animationFrame = 0;
    if (disposed || document.hidden) return;
    if (
      !motionPreference.matches &&
      timestamp - previousFrameAt < FRAME_INTERVAL_MS
    ) {
      animationFrame = requestAnimationFrame(render);
      return;
    }
    previousFrameAt = timestamp;
    drawGlints({
      context,
      points,
      bounds,
      elapsed: timestamp / 1000,
      dayTheme: document.documentElement.dataset.theme === "light",
      reducedMotion: motionPreference.matches,
    });
    if (!motionPreference.matches && points.length > 0)
      animationFrame = requestAnimationFrame(render);
  };

  const scheduleRender = () => {
    if (!disposed && !animationFrame && !document.hidden)
      animationFrame = requestAnimationFrame(render);
  };

  const refresh = async (generation: number) => {
    const dayTheme = document.documentElement.dataset.theme === "light";
    const scene = dayTheme ? dayScene : nightScene;
    const url = getBackgroundImageUrl(scene);
    if (!url) {
      points = [];
      scheduleRender();
      return;
    }
    try {
      const image = await loadDecodedImage(url);
      if (disposed || generation !== refreshGeneration) return;
      const nextBounds = canvas.getBoundingClientRect();
      const sceneBounds = scene.getBoundingClientRect();
      if (nextBounds.width < 1 || nextBounds.height < 1) {
        points = [];
        scheduleRender();
        return;
      }
      bounds = nextBounds;
      const ratio = Math.min(window.devicePixelRatio || 1, CANVAS_PIXEL_RATIO);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      points = findWaterGlints({
        image,
        scene,
        bounds: sceneBounds,
        dayTheme,
      });
      scheduleRender();
    } catch {
      if (disposed || generation !== refreshGeneration) return;
      points = [];
      scheduleRender();
    }
  };

  const scheduleRefresh = () => {
    if (disposed) return;
    const generation = ++refreshGeneration;
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      void refresh(generation);
    }, REFRESH_DEBOUNCE_MS);
  };

  const resizeObserver = new ResizeObserver(scheduleRefresh);
  resizeObserver.observe(shell);
  const themeObserver = new MutationObserver(scheduleRefresh);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const onVisibilityChange = () => {
    if (document.hidden) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else {
      scheduleRefresh();
    }
  };
  const onMotionChange = () => scheduleRender();

  window.addEventListener("resize", scheduleRefresh, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  motionPreference.addEventListener("change", onMotionChange);
  scheduleRefresh();

  return () => {
    disposed = true;
    resizeObserver.disconnect();
    themeObserver.disconnect();
    window.removeEventListener("resize", scheduleRefresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionPreference.removeEventListener("change", onMotionChange);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (refreshTimer) window.clearTimeout(refreshTimer);
    context.clearRect(0, 0, canvas.width, canvas.height);
  };
}
