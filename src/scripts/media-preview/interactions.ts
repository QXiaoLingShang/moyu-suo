import ZoomIn from "@/assets/icons/IconZoomIn.svg?raw";
import ZoomOut from "@/assets/icons/IconZoomOut.svg?raw";
import Fit from "@/assets/icons/IconFocusCentered.svg?raw";
import { createIconControl } from "./controls";
import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";

/** Shared photo/diagram gestures and zoom dock. Scale 1 is the fitted media size. */
export function setupPreviewInteractions(
  overlay: HTMLElement,
  media: HTMLElement,
  close: () => void
) {
  const controller = new AbortController();
  const { signal } = controller;
  const updateDescription = () =>
    overlay.setAttribute("aria-description", getUIString("mediaPreview.hint"));
  updateDescription();
  document.addEventListener(UI_LANGUAGE_CHANGE_EVENT, updateDescription, {
    signal,
  });
  let scale = 1;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;
  let pinchDistance = 0;
  let pinchScale = 1;
  let lastTap = 0;
  let dragPointer: number | undefined;
  let frame = 0;
  let viewportHeight = window.innerHeight;
  const maxScale = 4;

  const dock = document.createElement("div");
  dock.className = "media-preview-dock";
  const zoomOut = createIconControl("mediaPreview.zoomOut", ZoomOut);
  const fit = createIconControl("mediaPreview.reset", Fit);
  const zoomIn = createIconControl("mediaPreview.zoomIn", ZoomIn);
  const level = document.createElement("output");
  level.setAttribute("aria-live", "polite");
  dock.append(zoomOut, fit, zoomIn, level);
  overlay.append(dock);
  media.classList.add("media-preview-movable");

  function apply(): void {
    viewportHeight = overlay.clientHeight;
    const maxX = Math.max(
      0,
      (media.clientWidth - overlay.clientWidth / scale) / 2
    );
    const maxY = Math.max(0, (media.clientHeight - viewportHeight / scale) / 2);
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
    media.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
    media.dataset.zoomed = String(scale > 1);
    level.value = `${Math.round(scale * 100)}%`;
    zoomOut.disabled = scale <= 1;
    zoomIn.disabled = scale >= maxScale;
  }
  function scheduleDraw(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }
  function refresh(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    apply();
  }
  function zoom(next: number): void {
    scale = Math.min(maxScale, Math.max(1, next));
    scheduleDraw();
  }
  function reset(): void {
    scale = 1;
    x = 0;
    y = 0;
    scheduleDraw();
  }
  function startPan(clientX: number, clientY: number): void {
    // Commit a previous gesture before taking the next gesture's origin.
    refresh();
    startX = clientX;
    startY = clientY;
    startTranslateX = x;
    startTranslateY = y;
  }
  function pan(clientX: number, clientY: number): void {
    x = startTranslateX + (clientX - startX) / scale;
    y = startTranslateY + (clientY - startY) / scale;
    scheduleDraw();
  }
  const isControl = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest("button, .media-preview-dock");
  zoomOut.addEventListener("click", () => zoom(scale / 1.5), { signal });
  zoomIn.addEventListener("click", () => zoom(scale * 1.5), { signal });
  fit.addEventListener("click", reset, { signal });
  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay && scale <= 1) close();
    },
    { signal }
  );
  overlay.addEventListener(
    "dblclick",
    event => {
      if (isControl(event.target)) return;
      event.preventDefault();
      if (scale > 1) reset();
      else zoom(2);
    },
    { signal }
  );
  overlay.addEventListener(
    "wheel",
    event => {
      if (isControl(event.target)) return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
      zoom(scale * Math.exp(-event.deltaY * unit * 0.002));
    },
    { signal, passive: false }
  );
  overlay.addEventListener(
    "keydown",
    event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoom(scale * 1.5);
      } else if (event.key === "-") {
        event.preventDefault();
        zoom(scale / 1.5);
      } else if (event.key === "0") {
        event.preventDefault();
        reset();
      } else if (scale > 1 && event.key.startsWith("Arrow")) {
        event.preventDefault();
        if (event.key === "ArrowLeft") x += 80 / scale;
        if (event.key === "ArrowRight") x -= 80 / scale;
        if (event.key === "ArrowUp") y += 80 / scale;
        if (event.key === "ArrowDown") y -= 80 / scale;
        scheduleDraw();
      }
    },
    { signal }
  );
  overlay.addEventListener(
    "pointerdown",
    event => {
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        scale <= 1 ||
        isControl(event.target)
      )
        return;
      event.preventDefault();
      dragPointer = event.pointerId;
      startPan(event.clientX, event.clientY);
      media.dataset.dragging = "true";
      overlay.setPointerCapture(event.pointerId);
    },
    { signal }
  );
  overlay.addEventListener(
    "pointermove",
    event => {
      if (event.pointerId === dragPointer) pan(event.clientX, event.clientY);
    },
    { signal }
  );
  function stopDrag(): void {
    if (frame) refresh();
    const pointer = dragPointer;
    dragPointer = undefined;
    if (pointer !== undefined && overlay.hasPointerCapture(pointer))
      overlay.releasePointerCapture(pointer);
    media.dataset.dragging = "false";
  }
  function stopMouseDrag(event: PointerEvent): void {
    if (event.pointerId === dragPointer) stopDrag();
  }
  overlay.addEventListener("pointerup", stopMouseDrag, { signal });
  overlay.addEventListener("pointercancel", stopMouseDrag, { signal });
  overlay.addEventListener("lostpointercapture", stopMouseDrag, { signal });
  overlay.addEventListener(
    "touchstart",
    event => {
      if (isControl(event.target)) return;
      const touches = event.touches;
      media.dataset.dragging = "true";
      if (touches.length === 2) {
        pinchDistance = Math.hypot(
          touches[1].clientX - touches[0].clientX,
          touches[1].clientY - touches[0].clientY
        );
        pinchScale = scale;
      } else if (touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          event.preventDefault();
          if (scale > 1) reset();
          else zoom(2);
          lastTap = 0;
        } else lastTap = now;
        startPan(touches[0].clientX, touches[0].clientY);
      }
    },
    { signal, passive: false }
  );
  overlay.addEventListener(
    "touchmove",
    event => {
      if (isControl(event.target)) return;
      const touches = event.touches;
      event.preventDefault();
      if (touches.length === 2 && pinchDistance > 0) {
        const distance = Math.hypot(
          touches[1].clientX - touches[0].clientX,
          touches[1].clientY - touches[0].clientY
        );
        zoom((pinchScale * distance) / pinchDistance);
      } else if (touches.length === 1 && scale > 1)
        pan(touches[0].clientX, touches[0].clientY);
    },
    { signal, passive: false }
  );
  overlay.addEventListener(
    "touchend",
    event => {
      if (event.touches.length === 1)
        startPan(event.touches[0].clientX, event.touches[0].clientY);
      if (!event.touches.length) {
        if (scale <= 1.05) reset();
        stopDrag();
      }
    },
    { signal }
  );
  overlay.addEventListener("touchcancel", stopDrag, { signal });
  reset();
  return {
    refresh,
    dispose() {
      // Stop listeners before releasing capture, which emits lostpointercapture.
      controller.abort();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (dragPointer !== undefined && overlay.hasPointerCapture(dragPointer))
        overlay.releasePointerCapture(dragPointer);
      dock.remove();
      media.classList.remove("media-preview-movable");
    },
  };
}
