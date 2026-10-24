import { getBackgroundImageUrl, loadDecodedImage } from "./homeImage";

const REFRESH_DELAY_MS = 100;
const MAX_PIXEL_RATIO = 1;
const LIGHT_INK = "#203a53";
const DARK_INK = "#e5d8bd";

type Theme = "light" | "dark";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toneFor(luminance: number, theme: Theme): number {
  // A curved tonal response keeps broad mid-tone areas from becoming a flat mesh.
  if (theme === "light") return clamp01((198 - luminance) / 120) ** 1.8;
  if (luminance > 170) return 0;
  return clamp01((luminance - 16) / 110) ** 1.5;
}

function drawHalftone({
  canvas,
  image,
  theme,
  cellSize,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  theme: Theme;
  cellSize: number;
}): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 1 || height < 1) return;

  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = columns;
  sampleCanvas.height = rows;
  const sampleContext = sampleCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  const context = canvas.getContext("2d");
  if (!sampleContext || !context) return;

  const fit = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  );
  const imageWidth = image.naturalWidth * fit;
  const imageHeight = image.naturalHeight * fit;
  sampleContext.drawImage(
    image,
    (width - imageWidth) / (2 * cellSize),
    0,
    imageWidth / cellSize,
    imageHeight / cellSize
  );

  const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme === "light" ? LIGHT_INK : DARK_INK;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const pixel = (row * columns + column) * 4;
      const luminance =
        pixels[pixel] * 0.2126 +
        pixels[pixel + 1] * 0.7152 +
        pixels[pixel + 2] * 0.0722;
      const tone = toneFor(luminance, theme);
      if (tone < 0.06) continue;

      const radius = 0.55 + tone * 3.65;
      context.globalAlpha = tone * (theme === "light" ? 0.48 : 0.34);
      context.beginPath();
      context.arc(
        (column + 0.5) * cellSize,
        (row + 0.5) * cellSize,
        radius,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

export function setupHomeHalftone(shell: HTMLElement): () => void {
  const canvas = shell.querySelector<HTMLCanvasElement>("[data-home-halftone]");
  const dayScene = shell.querySelector<HTMLElement>(
    ".home-backdrop__scene--day"
  );
  const nightScene = shell.querySelector<HTMLElement>(
    ".home-backdrop__scene--night"
  );
  if (!canvas || !dayScene || !nightScene) return () => {};

  let disposed = false;
  let timer = 0;
  let generation = 0;

  const refresh = async (request: number) => {
    const theme: Theme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const scene = theme === "light" ? dayScene : nightScene;
    const url = getBackgroundImageUrl(scene);
    if (!url) return;

    try {
      const image = await loadDecodedImage(url);
      if (disposed || request !== generation) return;
      const cellSize = Number.parseFloat(
        getComputedStyle(canvas).getPropertyValue("--home-halftone-cell")
      );
      drawHalftone({
        canvas,
        image,
        theme,
        cellSize: Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 12,
      });
    } catch {
      if (!disposed && request === generation) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const scheduleRefresh = () => {
    if (disposed) return;
    const request = ++generation;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      void refresh(request);
    }, REFRESH_DELAY_MS);
  };

  const resizeObserver = new ResizeObserver(scheduleRefresh);
  resizeObserver.observe(canvas);
  const themeObserver = new MutationObserver(scheduleRefresh);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  scheduleRefresh();

  return () => {
    disposed = true;
    generation++;
    window.clearTimeout(timer);
    resizeObserver.disconnect();
    themeObserver.disconnect();
  };
}
