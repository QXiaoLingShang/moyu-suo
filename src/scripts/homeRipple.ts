import {
  addRippleImpulse,
  createRippleRegionEdgeDistance,
  createRippleWaveField,
  expandRippleWaveBounds,
  stepRippleWaveField,
  viewportCoordinateToGridIndex,
  type RippleWaveBounds,
  type RippleWaveField,
} from "../utils/homeRippleWave";
import { getBackgroundImageUrl, loadDecodedImage } from "./homeImage";

const RIPPLE = {
  frameIntervalMs: 1000 / 24,
  lowPowerFrameIntervalMs: 1000 / 15,
  dotSpacing: 6,
  dotCenter: 3,
  colorShift: { normal: 42, reduced: 28 },
  alphaGain: { normal: 1.55, reduced: 1.2 },
  maxAlpha: 0.82,
  radiusCells: 24,
  maxOriginAgeFrames: 180,
};

const INTERACTIVE_TARGET =
  "a, button, input, select, textarea, summary, [role='button'], [role='link'], [contenteditable='true'], [tabindex]:not([tabindex='-1'])";

type ScenePixelCache = {
  key: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

type ActiveRippleOrigin = {
  x: number;
  y: number;
  ageFrames: number;
};

let scenePixelCache: ScenePixelCache | undefined;

function readScenePixels(
  scene: HTMLElement,
  image: HTMLImageElement,
  width: number,
  height: number
): Uint8ClampedArray {
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D context is unavailable");

  const bounds = scene.getBoundingClientRect();
  const fit = Math.max(
    bounds.width / image.naturalWidth,
    bounds.height / image.naturalHeight
  );
  const imageWidth = image.naturalWidth * fit;
  const imageHeight = image.naturalHeight * fit;
  const scaleX = width / window.innerWidth;
  const scaleY = height / window.innerHeight;
  const sceneFilter = getComputedStyle(scene).filter;

  // Keep the scene's color treatment while expressing blur in grid pixels.
  context.filter = sceneFilter.replace(
    /blur\(([\d.]+)px\)/,
    (_match, radius: string) =>
      `blur(${Number(radius) * Math.max(scaleX, scaleY)}px)`
  );
  context.drawImage(
    image,
    (bounds.left + (bounds.width - imageWidth) / 2) * scaleX,
    bounds.top * scaleY,
    imageWidth * scaleX,
    imageHeight * scaleY
  );
  return context.getImageData(0, 0, width, height).data;
}

function isInteractiveClick(event: PointerEvent): boolean {
  return event
    .composedPath()
    .some(
      target => target instanceof Element && target.matches(INTERACTIVE_TARGET)
    );
}

function drawRippleField({
  imageData,
  field,
  bounds,
  sourcePixels,
  sourceWidth,
  sourceHeight,
  reducedMotion,
}: {
  imageData: ImageData;
  field: RippleWaveField;
  bounds: RippleWaveBounds;
  sourcePixels: Uint8ClampedArray;
  sourceWidth: number;
  sourceHeight: number;
  reducedMotion: boolean;
}): void {
  const { current, previous, width, height } = field;
  const output = imageData.data;
  const colorShift = reducedMotion
    ? RIPPLE.colorShift.reduced
    : RIPPLE.colorShift.normal;
  const alphaGain = reducedMotion
    ? RIPPLE.alphaGain.reduced
    : RIPPLE.alphaGain.normal;
  output.fill(0);

  for (let row = bounds.top; row <= bounds.bottom; row++) {
    const screenY = row * RIPPLE.dotSpacing + RIPPLE.dotCenter;
    if (screenY >= window.innerHeight) continue;

    for (let column = bounds.left; column <= bounds.right; column++) {
      const screenX = column * RIPPLE.dotSpacing + RIPPLE.dotCenter;
      if (screenX >= window.innerWidth) continue;

      const index = row * width + column;
      const heightAtPoint = current[index];
      const velocity = heightAtPoint - previous[index];
      const left = current[row * width + Math.max(0, column - 1)];
      const right = current[row * width + Math.min(width - 1, column + 1)];
      const above = current[Math.max(0, row - 1) * width + column];
      const below = current[Math.min(height - 1, row + 1) * width + column];
      const gradientX = (right - left) * 0.5;
      const gradientY = (below - above) * 0.5;
      const gradientLength = Math.hypot(gradientX, gradientY);
      if (gradientLength < 0.004) continue;

      const activity = Math.min(
        1,
        Math.abs(heightAtPoint) * 0.4 +
          Math.abs(velocity) * 0.8 +
          gradientLength * 0.55
      );
      if (activity < 0.018) continue;

      const shift = colorShift * activity;
      const sampleX = Math.max(
        0,
        Math.min(
          window.innerWidth - 1,
          Math.round(screenX - (gradientX / gradientLength) * shift)
        )
      );
      const sampleY = Math.max(
        0,
        Math.min(
          window.innerHeight - 1,
          Math.round(screenY - (gradientY / gradientLength) * shift)
        )
      );
      const sourceColumn = viewportCoordinateToGridIndex(
        sampleX,
        window.innerWidth,
        sourceWidth
      );
      const sourceRow = viewportCoordinateToGridIndex(
        sampleY,
        window.innerHeight,
        sourceHeight
      );
      const sourceOffset = (sourceRow * sourceWidth + sourceColumn) * 4;
      const outputOffset = index * 4;
      const alpha = Math.min(RIPPLE.maxAlpha, activity * alphaGain);
      // Refractive sampling preserves the scene's light; the ripple should not emit its own.
      output[outputOffset] = sourcePixels[sourceOffset];
      output[outputOffset + 1] = sourcePixels[sourceOffset + 1];
      output[outputOffset + 2] = sourcePixels[sourceOffset + 2];
      output[outputOffset + 3] = Math.round(alpha * 255);
    }
  }
}

export function setupHomeRipple(shell: HTMLElement): () => void {
  const backdrop = shell.querySelector<HTMLElement>(".home-backdrop");
  if (!backdrop) return () => {};

  const layer = document.createElement("div");
  layer.className = "home-ripple-layer";
  layer.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "home-ripple";
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const rippleContext: CanvasRenderingContext2D = context;
  layer.append(canvas);
  backdrop.append(layer);

  const controller = new AbortController();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const lowPowerInput = matchMedia("(pointer: coarse)");
  const { signal } = controller;
  let disposed = false;
  let frame = 0;
  let lastFrameAt = 0;
  let field = createRippleWaveField(1, 1);
  let regionEdgeDistance: Float32Array = new Float32Array(1).fill(-1);
  let activeBounds: RippleWaveBounds | null = null;
  const activeOrigins: ActiveRippleOrigin[] = [];
  let regionNeedsUpdate = false;
  let imageData = rippleContext.createImageData(1, 1);
  let hasActiveWaves = false;
  let resizeTimer: number | undefined;
  let resizeGeneration = 0;
  let isResizing = false;

  function clearField(): void {
    field.current.fill(0);
    field.previous.fill(0);
    field.next.fill(0);
    imageData.data.fill(0);
    activeOrigins.length = 0;
    activeBounds = null;
    regionEdgeDistance.fill(-1);
    regionNeedsUpdate = false;
    rippleContext.putImageData(imageData, 0, 0);
    hasActiveWaves = false;
    lastFrameAt = 0;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function resizeField(): void {
    resizeGeneration += 1;
    clearField();
    const width = Math.max(1, Math.ceil(window.innerWidth / RIPPLE.dotSpacing));
    const height = Math.max(
      1,
      Math.ceil(window.innerHeight / RIPPLE.dotSpacing)
    );
    canvas.width = width;
    canvas.height = height;
    field = createRippleWaveField(width, height);
    regionEdgeDistance = new Float32Array(width * height).fill(-1);
    imageData = rippleContext.createImageData(width, height);
  }

  function updateActiveRegion(): void {
    if (!regionNeedsUpdate) return;
    regionEdgeDistance = createRippleRegionEdgeDistance(
      field.width,
      field.height,
      activeOrigins,
      RIPPLE.radiusCells
    );
    activeBounds = activeOrigins.reduce<RippleWaveBounds | null>(
      (bounds, origin) =>
        expandRippleWaveBounds(
          bounds,
          field.width,
          field.height,
          origin,
          RIPPLE.radiusCells
        ),
      null
    );
    regionNeedsUpdate = false;
  }

  function scheduleFrame(): void {
    if (!disposed && !document.hidden && !frame && hasActiveWaves)
      frame = requestAnimationFrame(render);
  }

  function render(now: number): void {
    frame = 0;
    if (disposed || document.hidden) return;

    const frameIntervalMs = lowPowerInput.matches
      ? RIPPLE.lowPowerFrameIntervalMs
      : RIPPLE.frameIntervalMs;
    if (lastFrameAt && now - lastFrameAt < frameIntervalMs) {
      scheduleFrame();
      return;
    }
    lastFrameAt = now;

    for (let index = activeOrigins.length - 1; index >= 0; index--) {
      const origin = activeOrigins[index];
      origin.ageFrames++;
      if (origin.ageFrames <= RIPPLE.maxOriginAgeFrames) continue;
      activeOrigins.splice(index, 1);
      regionNeedsUpdate = true;
    }
    if (!activeOrigins.length) {
      clearField();
      return;
    }
    updateActiveRegion();

    if (
      !activeBounds ||
      !stepRippleWaveField(field, {
        regionEdgeDistance,
        bounds: activeBounds,
      })
    ) {
      clearField();
      return;
    }

    const isDark = document.documentElement.dataset.theme === "dark";
    const pixelCache = scenePixelCache;
    const themeKey = isDark ? "night" : "day";
    const scene = shell.querySelector<HTMLElement>(
      isDark ? ".home-backdrop__scene--night" : ".home-backdrop__scene--day"
    );
    if (!scene || !pixelCache?.key.startsWith(`${themeKey}:`)) {
      clearField();
      return;
    }

    drawRippleField({
      imageData,
      field,
      bounds: activeBounds,
      sourcePixels: pixelCache.pixels,
      sourceWidth: pixelCache.width,
      sourceHeight: pixelCache.height,
      reducedMotion: reducedMotion.matches,
    });
    rippleContext.putImageData(imageData, 0, 0);
    scheduleFrame();
  }

  async function addRipple(event: PointerEvent): Promise<void> {
    if (
      disposed ||
      reducedMotion.matches ||
      isResizing ||
      event.button !== 0 ||
      isInteractiveClick(event)
    )
      return;
    if (
      event.clientX < 0 ||
      event.clientY < 0 ||
      event.clientX > window.innerWidth ||
      event.clientY > window.innerHeight
    )
      return;

    const click = { x: event.clientX, y: event.clientY };
    const clickGeneration = resizeGeneration;
    const isDark = document.documentElement.dataset.theme === "dark";
    const themeKey = isDark ? "night" : "day";
    const scene = shell.querySelector<HTMLElement>(
      isDark ? ".home-backdrop__scene--night" : ".home-backdrop__scene--day"
    );
    const imageUrl = scene && getBackgroundImageUrl(scene);
    if (!scene || !imageUrl) return;

    try {
      const image = await loadDecodedImage(imageUrl);
      if (
        disposed ||
        reducedMotion.matches ||
        clickGeneration !== resizeGeneration ||
        (document.documentElement.dataset.theme === "dark") !== isDark
      )
        return;

      const viewportWidth = Math.max(1, Math.ceil(window.innerWidth));
      const viewportHeight = Math.max(1, Math.ceil(window.innerHeight));
      const width = Math.max(1, Math.ceil(viewportWidth / RIPPLE.dotSpacing));
      const height = Math.max(1, Math.ceil(viewportHeight / RIPPLE.dotSpacing));
      const key = `${themeKey}:${imageUrl}:${viewportWidth}x${viewportHeight}`;
      if (!scenePixelCache || scenePixelCache.key !== key) {
        scenePixelCache = {
          key,
          width,
          height,
          pixels: readScenePixels(scene, image, width, height),
        };
      }

      const originX = Math.round(
        (click.x - RIPPLE.dotCenter) / RIPPLE.dotSpacing
      );
      const originY = Math.round(
        (click.y - RIPPLE.dotCenter) / RIPPLE.dotSpacing
      );
      addRippleImpulse(field, originX, originY);
      activeOrigins.push({ x: originX, y: originY, ageFrames: 0 });
      regionNeedsUpdate = true;
      hasActiveWaves = true;
      scheduleFrame();
    } catch {
      return;
    }
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrameAt = 0;
    } else {
      scheduleFrame();
    }
  }

  resizeField();
  document.addEventListener("pointerdown", event => void addRipple(event), {
    signal,
    capture: true,
  });
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    signal,
  });
  reducedMotion.addEventListener(
    "change",
    event => {
      if (event.matches) clearField();
    },
    { signal }
  );
  window.addEventListener(
    "resize",
    () => {
      isResizing = true;
      resizeGeneration += 1;
      clearField();
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = undefined;
        resizeField();
        isResizing = false;
      }, 120);
    },
    { signal, passive: true }
  );
  const themeObserver = new MutationObserver(clearField);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => {
    disposed = true;
    controller.abort();
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
    themeObserver.disconnect();
    clearField();
    scenePixelCache = undefined;
    layer.remove();
  };
}
