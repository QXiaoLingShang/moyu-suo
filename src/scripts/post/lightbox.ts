type ImageAttributes = {
  role: string | null;
  tabIndex: string | null;
  hasPopup: string | null;
  label: string | null;
};

type PendingRemoval = () => void;

const LIGHTBOX_LABELS = {
  zoom: "Zoom image",
  preview: "Image preview",
  close: "Close image preview",
};

export function setupImageLightbox(article: HTMLElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const originalAttributes = new Map<HTMLImageElement, ImageAttributes>();
  const pendingRemovals = new Set<PendingRemoval>();
  let overlay: HTMLDivElement | null = null;
  let lastFocused: HTMLElement | null = null;
  let scrollLockCount = 0;
  let previousRootOverflowY = "";
  let previousBodyOverflow = "";
  let attributesFrame = 0;
  let openingFrame = 0;

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lockPageScroll(): void {
    if (scrollLockCount === 0) {
      previousRootOverflowY = document.documentElement.style.overflowY;
      previousBodyOverflow = document.body.style.overflow;
    }
    scrollLockCount += 1;
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount > 0) return;
    document.documentElement.style.overflowY = previousRootOverflowY;
    document.body.style.overflow = previousBodyOverflow;
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
        image.alt
          ? `${LIGHTBOX_LABELS.zoom}: ${image.alt}`
          : LIGHTBOX_LABELS.zoom
      );
    }
  });

  function open(src: string, alt: string, trigger: HTMLElement): void {
    if (overlay) return;
    lastFocused = trigger;

    const currentOverlay = document.createElement("div");
    overlay = currentOverlay;
    currentOverlay.setAttribute("role", "dialog");
    currentOverlay.setAttribute("aria-modal", "true");
    currentOverlay.setAttribute("data-image-lightbox", "");
    currentOverlay.setAttribute(
      "aria-label",
      alt ? `${LIGHTBOX_LABELS.preview}: ${alt}` : LIGHTBOX_LABELS.preview
    );
    currentOverlay.className =
      "fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-200 motion-reduce:transition-none";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", LIGHTBOX_LABELS.close);
    closeButton.className =
      "absolute end-4 top-4 rounded p-2 text-3xl leading-none text-white";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => close());

    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.className =
      "max-h-[90dvh] max-w-[90dvw] cursor-default object-contain";
    currentOverlay.append(closeButton, image);

    let currentScale = 1;
    let translateX = 0;
    let translateY = 0;
    let initialDist = 0;
    let initialScale = 1;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTranslateX = 0;
    let panStartTranslateY = 0;
    let lastTapTime = 0;

    function applyTransform(): void {
      image.style.transform = `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`;
    }

    function resetTransform(): void {
      currentScale = 1;
      translateX = 0;
      translateY = 0;
      image.style.transform = "";
    }

    currentOverlay.addEventListener("click", event => {
      if (event.target === currentOverlay && currentScale <= 1) close();
    });
    currentOverlay.addEventListener(
      "touchstart",
      event => {
        const touches = event.touches;
        if (touches.length === 2) {
          initialDist = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
          );
          initialScale = currentScale;
        } else if (touches.length === 1) {
          const now = Date.now();
          if (now - lastTapTime < 300) {
            event.preventDefault();
            if (currentScale > 1) resetTransform();
            else {
              currentScale = 2;
              translateX = 0;
              translateY = 0;
              applyTransform();
            }
            lastTapTime = 0;
            panStartX = touches[0].clientX;
            panStartY = touches[0].clientY;
            panStartTranslateX = translateX;
            panStartTranslateY = translateY;
          } else {
            lastTapTime = now;
            if (currentScale > 1) {
              panStartX = touches[0].clientX;
              panStartY = touches[0].clientY;
              panStartTranslateX = translateX;
              panStartTranslateY = translateY;
            }
          }
        }
      },
      { passive: false }
    );
    currentOverlay.addEventListener(
      "touchmove",
      event => {
        const touches = event.touches;
        if (touches.length === 2) {
          event.preventDefault();
          if (initialDist <= 0) return;
          const distance = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
          );
          currentScale = Math.min(
            4,
            Math.max(1, initialScale * (distance / initialDist))
          );
          applyTransform();
        } else if (touches.length === 1) {
          if (currentScale > 1) {
            event.preventDefault();
            translateX =
              panStartTranslateX +
              (touches[0].clientX - panStartX) / currentScale;
            translateY =
              panStartTranslateY +
              (touches[0].clientY - panStartY) / currentScale;
            const maxX = Math.max(
              0,
              (image.clientWidth - currentOverlay.clientWidth / currentScale) /
                2
            );
            const maxY = Math.max(
              0,
              (image.clientHeight -
                currentOverlay.clientHeight / currentScale) /
                2
            );
            translateX = Math.min(maxX, Math.max(-maxX, translateX));
            translateY = Math.min(maxY, Math.max(-maxY, translateY));
            applyTransform();
          } else event.preventDefault();
        }
      },
      { passive: false }
    );
    currentOverlay.addEventListener("touchend", event => {
      if (event.touches.length === 0 && currentScale <= 1.05) resetTransform();
    });
    currentOverlay.addEventListener("touchcancel", event => {
      if (event.touches.length === 0 && currentScale <= 1.05) resetTransform();
    });

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
    closeButton.focus();
  }

  function close(immediate = false, restoreFocus = true): void {
    if (!overlay) return;
    const closingOverlay = overlay;
    overlay = null;
    document.removeEventListener("keydown", onKeyDown);
    if (openingFrame) window.cancelAnimationFrame(openingFrame);
    openingFrame = 0;

    if (restoreFocus) lastFocused?.focus();
    lastFocused = null;

    if (
      immediate ||
      closingOverlay.closest("dialog") ||
      prefersReducedMotion()
    ) {
      closingOverlay.remove();
      unlockPageScroll();
      return;
    }

    let removed = false;
    let timer = 0;
    const remove = () => {
      if (removed) return;
      removed = true;
      if (timer) window.clearTimeout(timer);
      closingOverlay.removeEventListener("transitionend", remove);
      closingOverlay.remove();
      unlockPageScroll();
      pendingRemovals.delete(remove);
    };
    pendingRemovals.add(remove);
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
      'a[href], button, [tabindex]:not([tabindex="-1"])'
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
        close(true);
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
    if (overlay) close(true, false);
    for (const remove of [...pendingRemovals]) remove();
    restoreImageAttributes();
  };
}
