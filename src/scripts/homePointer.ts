import { HomePointerParticles } from "./homePointerParticles";
import { HomePointerHighlight } from "./homePointerHighlight";
import { HomePointerTargets } from "./homePointerTargets";
import { createHomePointerMotion } from "./homePointerMotion";

function createPointerLayer(): {
  layer: HTMLDivElement;
  glow: HTMLSpanElement;
  pointer: HTMLSpanElement;
} {
  const layer = document.createElement("div");
  layer.className = "home-effects-layer home-pointer-layer";
  layer.setAttribute("aria-hidden", "true");

  const glow = document.createElement("span");
  glow.className = "home-pointer-glow";

  const pointer = document.createElement("span");
  pointer.className = "home-pointer";

  layer.append(glow, pointer);
  document.body.append(layer);
  return { layer, glow, pointer };
}

/** Bind the pointer effect to browser lifecycle events and return its cleanup. */
export function setupHomePointer(): () => void {
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { layer, glow, pointer } = createPointerLayer();
  const targets = new HomePointerTargets();
  const highlight = new HomePointerHighlight(targets);
  const particles = new HomePointerParticles(layer);
  const motion = createHomePointerMotion({
    root,
    glow,
    pointer,
    finePointer,
    reducedMotion,
    targets,
    highlight,
    particles,
  });
  const controller = new AbortController();
  const { signal } = controller;

  window.addEventListener("pointermove", motion.updatePointer, { signal });
  window.addEventListener("pointerleave", motion.deactivate, { signal });
  window.addEventListener("blur", motion.deactivate, { signal });
  window.addEventListener("scroll", motion.refreshTextBounds, {
    signal,
    passive: true,
  });
  window.addEventListener("resize", motion.refreshTextBounds, { signal });
  document.fonts.addEventListener("loadingdone", motion.refreshTextBounds, {
    signal,
  });
  finePointer.addEventListener("change", motion.syncPreferences, { signal });
  reducedMotion.addEventListener("change", motion.syncPreferences, { signal });

  return () => {
    controller.abort();
    motion.destroy();
    layer.remove();
  };
}
