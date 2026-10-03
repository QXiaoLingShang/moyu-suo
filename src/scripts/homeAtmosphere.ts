import { setupHomePointer } from "@/scripts/homePointer";
import { setupHomeHalftone } from "@/scripts/homeHalftone";
import { setupHomeRipple } from "@/scripts/homeRipple";
import { setupHomeWaterGlints } from "@/scripts/homeWaterGlints";

function revealRecentOnScroll(shell: HTMLElement): () => void {
  const targets = Array.from(
    shell.querySelectorAll<HTMLElement>(
      ".home-recent__heading, .home-recent__feature, .home-recent__secondary li"
    )
  );
  if (!targets.length) return () => {};

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    targets.forEach(target => target.setAttribute("data-visible", "true"));
    return () => {};
  }

  shell.dataset.homeRevealReady = "true";
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
  );
  targets.forEach((target, index) => {
    target.style.setProperty("--home-reveal-index", String(index % 4));
    observer.observe(target);
  });

  return () => {
    observer.disconnect();
    delete shell.dataset.homeRevealReady;
  };
}

function initHomeAtmosphere(): void {
  const shell = document.querySelector<HTMLElement>(".home-shell");
  const stage = document.querySelector<HTMLElement>(".home-stage");
  if (!shell || !stage || stage.dataset.atmosphereInitialized) return;

  const cleanupRipple = setupHomeRipple(shell);
  const cleanupPointer = setupHomePointer();
  const cleanupHalftone = setupHomeHalftone(shell);
  const cleanupWaterGlints = setupHomeWaterGlints(shell);
  const cleanupRecentReveal = revealRecentOnScroll(shell);
  stage.dataset.atmosphereInitialized = "true";

  document.addEventListener(
    "astro:before-swap",
    () => {
      cleanupRipple();
      cleanupPointer();
      cleanupHalftone();
      cleanupWaterGlints();
      cleanupRecentReveal();
      delete stage.dataset.atmosphereInitialized;
    },
    { once: true }
  );
}

let pageLoadListenerRegistered = false;

export function setupHomeAtmosphere(): void {
  initHomeAtmosphere();
  if (pageLoadListenerRegistered) return;
  document.addEventListener("astro:page-load", initHomeAtmosphere);
  pageLoadListenerRegistered = true;
}
