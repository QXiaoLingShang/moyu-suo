import Close from "@/assets/icons/IconX.svg?raw";
import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";
import { acquirePageScrollLock } from "../pageScrollLock";
import { createIconControl } from "../post/previewControls";
import { setupPreviewInteractions } from "../post/previewInteractions";
import { cloneSvgWithUniqueIds } from "./cloneSvg";

type OpenFocusOptions = {
  target: HTMLElement;
  trigger: HTMLElement;
  fallback: HTMLElement;
  isPending: () => boolean;
};

/** Owns the modal lifecycle while leaving the article's SVG in place. */
export function createMermaidFocus() {
  const controller = new AbortController();
  const { signal } = controller;
  let dialog: HTMLDialogElement | undefined;
  let graph: HTMLElement | undefined;
  let trigger: HTMLElement | undefined;
  let fallbackTrigger: HTMLElement | undefined;
  let canvas: HTMLDivElement | undefined;
  let status: HTMLElement | undefined;
  let interactions: ReturnType<typeof setupPreviewInteractions> | undefined;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let releasePageScrollLock: (() => void) | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let readPending: (() => boolean) | undefined;
  let opening = false;
  let closingTimer = 0;
  let openingFrame = 0;

  function fit(): void {
    if (!canvas || !dialog) return;
    const scale = Math.min(
      1,
      (dialog.clientWidth * 0.9) / naturalWidth,
      (dialog.clientHeight * 0.9) / naturalHeight
    );
    canvas.style.width = `${naturalWidth * scale}px`;
    canvas.style.height = `${naturalHeight * scale}px`;
    interactions?.refresh();
  }
  function updateLanguage(): void {
    dialog?.setAttribute("aria-label", getUIString("mermaid.focus"));
    if (status) status.textContent = getUIString("mermaid.loading");
  }
  function finishClose(restoreFocus: boolean): void {
    if (!dialog) return;
    if (closingTimer) window.clearTimeout(closingTimer);
    closingTimer = 0;
    const closing = dialog;
    dialog = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    interactions?.dispose();
    interactions = undefined;
    if (openingFrame) cancelAnimationFrame(openingFrame);
    openingFrame = 0;
    opening = false;
    closing.close();
    closing.remove();
    releasePageScrollLock?.();
    releasePageScrollLock = undefined;
    if (restoreFocus) {
      const returnTarget = [trigger, fallbackTrigger].find(
        candidate =>
          candidate?.isConnected &&
          !(candidate instanceof HTMLButtonElement && candidate.disabled) &&
          !candidate.closest("[inert]") &&
          candidate.checkVisibility({ visibilityProperty: true })
      );
      returnTarget?.focus({ preventScroll: true });
    }
    graph = undefined;
    readPending = undefined;
    trigger = undefined;
    fallbackTrigger = undefined;
    canvas = undefined;
    status = undefined;
  }
  function close({
    immediate = false,
    restoreFocus = true,
  }: { immediate?: boolean; restoreFocus?: boolean } = {}): void {
    if (!dialog) return;
    if (immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose(restoreFocus);
      return;
    }
    if (closingTimer) return;
    dialog.dataset.closing = "true";
    closingTimer = window.setTimeout(() => finishClose(restoreFocus), 200);
  }
  function refresh(target: HTMLElement): void {
    if (graph !== target || !canvas) return;
    const sourceSvg = target.querySelector<SVGSVGElement>(":scope > svg");
    if (!sourceSvg) return;
    const svg = cloneSvgWithUniqueIds(sourceSvg);
    naturalWidth = svg.viewBox.baseVal.width || 800;
    naturalHeight = svg.viewBox.baseVal.height || 600;
    canvas.dataset.palette = target.dataset.palette;
    canvas.replaceChildren(svg);
    refreshState(target);
    fit();
  }
  function refreshState(target: HTMLElement): void {
    if (graph !== target) return;
    const busy = opening || !!readPending?.();
    if (status) status.hidden = !busy;
    if (canvas) {
      // Only the first opening needs a placeholder; theme updates keep the old SVG.
      canvas.hidden = opening || !canvas.querySelector("svg");
      canvas.setAttribute("aria-busy", String(busy));
    }
  }
  function open({
    target,
    trigger: opener,
    fallback,
    isPending,
  }: OpenFocusOptions): void {
    if (dialog || document.querySelector("[data-image-lightbox]")) return;
    if (!target.querySelector("svg")) return;
    graph = target;
    // Read only the current diagram's phase; no pending state survives a session.
    readPending = isPending;
    trigger = opener;
    fallbackTrigger = fallback;
    opening = true;
    dialog = document.createElement("dialog");
    dialog.className = "media-preview mermaid-focus not-prose";
    dialog.dataset.readingFocusIgnore = "";
    dialog.dataset.mermaidFocus = "";
    const closeButton = createIconControl("mermaid.close", Close);
    closeButton.classList.add("media-preview-close");
    closeButton.addEventListener("click", () => close());
    status = document.createElement("p");
    status.className = "media-preview-notice";
    status.setAttribute("role", "status");
    canvas = document.createElement("div");
    canvas.className = "media-preview-surface mermaid-focus-canvas";
    dialog.append(closeButton, status, canvas);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const targets = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [tabindex="0"]'
        );
        const first = targets?.[0];
        const last = targets?.[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });
    document.body.append(dialog);
    releasePageScrollLock = acquirePageScrollLock();
    dialog.showModal();
    // Show feedback before cloning and fitting a potentially large SVG.
    refreshState(target);
    updateLanguage();
    closeButton.focus({ preventScroll: true });
    openingFrame = requestAnimationFrame(() => {
      openingFrame = 0;
      if (!dialog || graph !== target || !canvas) return;
      refresh(target);
      opening = false;
      // Keep the same zoom range and gestures as the article image lightbox.
      interactions = setupPreviewInteractions(dialog, canvas, () => close());
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(dialog);
      refreshState(target);
    });
  }
  document.addEventListener(UI_LANGUAGE_CHANGE_EVENT, updateLanguage, {
    signal,
  });
  document.addEventListener(
    "sidenote:before-close",
    event => {
      if (
        graph &&
        event.target instanceof Element &&
        event.target.contains(graph)
      )
        close({ immediate: true });
    },
    { signal }
  );
  return {
    open,
    refresh,
    refreshState,
    isOpenFor(target: HTMLElement) {
      return !!dialog && graph === target;
    },
    closeFor(target: HTMLElement, fallback: HTMLElement) {
      if (graph === target) {
        trigger = fallback;
        close({ immediate: true });
      }
    },
    dispose() {
      close({ immediate: true, restoreFocus: false });
      controller.abort();
    },
  };
}
