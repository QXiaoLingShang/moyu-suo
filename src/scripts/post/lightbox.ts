import Close from "@/assets/icons/IconX.svg?raw";
import { acquirePageScrollLock } from "../pageScrollLock";
import { setupPreviewInteractions } from "./previewInteractions";
import { createIconControl } from "./previewControls";
import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";
import { tplStr } from "@/i18n/format";

type ImageAttributes = {
  role: string | null;
  tabIndex: string | null;
  hasPopup: string | null;
  label: string | null;
};

type PendingOverlayRemoval = () => void;

export function setupImageLightbox(article: HTMLElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const originalAttributes = new Map<HTMLImageElement, ImageAttributes>();
  const pendingOverlayRemovals = new Set<PendingOverlayRemoval>();
  const overlayResizeHandlers = new Map<HTMLDivElement, () => void>();
  let overlay: HTMLDivElement | null = null;
  let lastFocused: HTMLElement | null = null;
  let scrollLockCount = 0;
  let releasePageScrollLock: (() => void) | undefined;
  let attributesFrame = 0;
  let openingFrame = 0;
  let activeImageAlt: string | null = null;
  let interactions: ReturnType<typeof setupPreviewInteractions> | undefined;

  function releaseOverlayResizeHandler(target: HTMLDivElement): void {
    const handler = overlayResizeHandlers.get(target);
    if (!handler) return;
    window.removeEventListener("resize", handler);
    overlayResizeHandlers.delete(target);
  }

  function imageActionLabel(
    phrase: "zoomImage" | "imagePreview",
    alt: string
  ): string {
    if (!alt) return getUIString(`post.${phrase}`);
    return tplStr(getUIString(`post.${phrase}WithAlt`), { alt });
  }

  function updateAccessibleNames(): void {
    for (const image of originalAttributes.keys()) {
      image.setAttribute(
        "aria-label",
        imageActionLabel("zoomImage", image.alt)
      );
    }

    if (overlay && activeImageAlt !== null) {
      overlay.setAttribute(
        "aria-label",
        imageActionLabel("imagePreview", activeImageAlt)
      );
    }
  }

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lockPageScroll(): void {
    if (scrollLockCount === 0) releasePageScrollLock = acquirePageScrollLock();
    scrollLockCount += 1;
  }

  function unlockPageScroll(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount > 0) return;
    releasePageScrollLock?.();
    releasePageScrollLock = undefined;
  }

  function restoreImageAttributes(): void {
    for (const [image, attributes] of originalAttributes) {
      if (attributes.role === null) image.removeAttribute("role");
      else image.setAttribute("role", attributes.role);
      if (attributes.tabIndex === null) image.removeAttribute("tabindex");
      else image.setAttribute("tabindex", attributes.tabIndex);
      if (attributes.hasPopup === null) image.removeAttribute("aria-haspopup");
      else image.setAttribute("aria-haspopup", attributes.hasPopup);
      if (attributes.label === null) image.removeAttribute("aria-label");
      else image.setAttribute("aria-label", attributes.label);
    }
    originalAttributes.clear();
  }

  // Defer mutations so adding keyboard affordances does not delay LCP.
  attributesFrame = window.requestAnimationFrame(() => {
    attributesFrame = 0;
    for (const image of article.querySelectorAll("img")) {
      if (image.closest("a")) continue;
      originalAttributes.set(image, {
        role: image.getAttribute("role"),
        tabIndex: image.getAttribute("tabindex"),
        hasPopup: image.getAttribute("aria-haspopup"),
        label: image.getAttribute("aria-label"),
      });
      image.setAttribute("role", "button");
      image.setAttribute("tabindex", "0");
      image.setAttribute("aria-haspopup", "dialog");
      image.setAttribute(
        "aria-label",
        imageActionLabel("zoomImage", image.alt)
      );
    }
  });

  document.addEventListener(UI_LANGUAGE_CHANGE_EVENT, updateAccessibleNames, {
    signal,
  });

  function open(src: string, alt: string, trigger: HTMLElement): void {
    if (overlay) return;
    lastFocused = trigger;
    activeImageAlt = alt;

    const currentOverlay = document.createElement("div");
    overlay = currentOverlay;
    currentOverlay.setAttribute("role", "dialog");
    currentOverlay.setAttribute("aria-modal", "true");
    currentOverlay.setAttribute("data-image-lightbox", "");
    currentOverlay.setAttribute(
      "aria-label",
      imageActionLabel("imagePreview", alt)
    );
    currentOverlay.className =
      "media-preview media-preview-lightbox fixed inset-0 z-[var(--z-modal)] flex cursor-zoom-out items-center justify-center bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-200 motion-reduce:transition-none";
    const resizeHandler = () => {
      currentOverlay.style.width = `${window.innerWidth}px`;
      if (overlay === currentOverlay) interactions?.refresh();
    };
    resizeHandler();
    overlayResizeHandlers.set(currentOverlay, resizeHandler);
    window.addEventListener("resize", resizeHandler);

    const closeButton = createIconControl("post.closeImagePreview", Close);
    closeButton.classList.add("media-preview-close");
    closeButton.addEventListener("click", () => close());

    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.className =
      "max-h-[90dvh] max-w-[90dvw] cursor-default object-contain";
    currentOverlay.append(closeButton, image);

    interactions = setupPreviewInteractions(currentOverlay, image, () =>
      close()
    );

    // A body-level overlay cannot cover a modal dialog's top layer, regardless of z-index.
    const containingDialog = trigger.closest("dialog[open]");
    (containingDialog ?? document.body).append(currentOverlay);
    lockPageScroll();
    document.addEventListener("keydown", onKeyDown);
    openingFrame = window.requestAnimationFrame(() => {
      openingFrame = 0;
      if (overlay === currentOverlay)
        currentOverlay.classList.add("opacity-100");
    });
    closeButton.focus({ preventScroll: true });
  }

  function close({
    immediate = false,
    restoreFocus = true,
  }: { immediate?: boolean; restoreFocus?: boolean } = {}): void {
    if (!overlay) return;
    const closingOverlay = overlay;
    overlay = null;
    activeImageAlt = null;
    interactions?.dispose();
    interactions = undefined;
    document.removeEventListener("keydown", onKeyDown);
    if (openingFrame) window.cancelAnimationFrame(openingFrame);
    openingFrame = 0;

    if (restoreFocus) lastFocused?.focus({ preventScroll: true });
    lastFocused = null;

    if (
      immediate ||
      closingOverlay.closest("dialog") ||
      prefersReducedMotion()
    ) {
      closingOverlay.remove();
      releaseOverlayResizeHandler(closingOverlay);
      unlockPageScroll();
      return;
    }

    // Focus has returned to the trigger; keep the fading overlay out of the
    // accessibility tree and tab order until its transition finishes.
    closingOverlay.setAttribute("aria-hidden", "true");
    closingOverlay.inert = true;
    let removed = false;
    let timer = 0;
    const remove = () => {
      if (removed) return;
      removed = true;
      if (timer) window.clearTimeout(timer);
      closingOverlay.removeEventListener("transitionend", remove);
      closingOverlay.remove();
      releaseOverlayResizeHandler(closingOverlay);
      unlockPageScroll();
      pendingOverlayRemovals.delete(remove);
    };
    pendingOverlayRemovals.add(remove);
    closingOverlay.addEventListener("transitionend", remove, { once: true });
    timer = window.setTimeout(remove, 250);
    closingOverlay.classList.remove("opacity-100");
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!overlay) return;
    if (event.key === "Escape") {
      // Consume Escape here so a parent note dialog does not close as well.
      event.preventDefault();
      close();
    } else if (event.key === "Tab") trapFocus(event);
  }

  function trapFocus(event: KeyboardEvent): void {
    if (!overlay) return;
    const focusables = overlay.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function triggerFromEvent(event: Event): HTMLImageElement | null {
    if (!(event.target instanceof Element)) return null;
    const image = event.target.closest("img");
    if (!image || !article.contains(image) || image.closest("a")) return null;
    return image;
  }

  function activate(image: HTMLImageElement): void {
    open(image.currentSrc || image.src, image.alt, image);
  }

  article.addEventListener(
    "sidenote:before-close",
    event => {
      if (
        overlay &&
        event.target instanceof Element &&
        event.target.contains(overlay)
      )
        close({ immediate: true });
    },
    { signal }
  );
  article.addEventListener(
    "click",
    event => {
      const image = triggerFromEvent(event);
      if (!image) return;
      event.preventDefault();
      activate(image);
    },
    { signal }
  );
  article.addEventListener(
    "keydown",
    event => {
      const keyboardEvent = event as KeyboardEvent;
      if (
        keyboardEvent.key !== "Enter" &&
        keyboardEvent.key !== " " &&
        keyboardEvent.key !== "Spacebar"
      )
        return;
      const image = triggerFromEvent(event);
      if (!image) return;
      event.preventDefault();
      activate(image);
    },
    { signal }
  );

  return () => {
    controller.abort();
    if (attributesFrame) window.cancelAnimationFrame(attributesFrame);
    if (openingFrame) window.cancelAnimationFrame(openingFrame);
    attributesFrame = 0;
    openingFrame = 0;
    if (overlay) close({ immediate: true, restoreFocus: false });
    for (const remove of [...pendingOverlayRemovals]) remove();
    restoreImageAttributes();
  };
}
