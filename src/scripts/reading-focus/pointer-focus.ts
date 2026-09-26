import type { ReadingFocusPreferences } from "./preferences";
import {
  createContentRegions,
  EXCLUDED_CONTENT,
  type PointerPosition,
} from "./regions";

type PointerFocusOptions = {
  article: HTMLElement;
  signal: AbortSignal;
  getPreferences: () => Readonly<ReadingFocusPreferences>;
  isSuspended: () => boolean;
};

export function createPointerFocus({
  article,
  signal,
  getPreferences,
  isSuspended,
}: PointerFocusOptions) {
  const hoverPointer = window.matchMedia("(any-hover: hover)");
  const main = article.parentElement;
  const regions = createContentRegions(article);
  const overlay = document.createElement("div");
  overlay.className = "reading-focus-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);

  let pointer: PointerPosition | null = null;
  let keyboardTarget: Element | null = null;
  let frame = 0;
  let visible = false;
  let focusedContent: Element | null = null;
  let geometryChanged = false;

  function hideOverlay(): void {
    visible = false;
    overlay.dataset.visible = "false";
  }

  function paintOverlay(): void {
    frame = 0;
    const snapToContent = geometryChanged;
    geometryChanged = false;
    const preferences = getPreferences();
    if (!preferences.enabled || isSuspended() || document.hidden) {
      hideOverlay();
      return;
    }
    // Hit testing belongs in the frame too: scroll can move content beneath a stationary pointer.
    const hit =
      pointer && hoverPointer.matches
        ? document.elementFromPoint(pointer.x, pointer.y)
        : keyboardTarget?.matches(":focus-visible")
          ? keyboardTarget
          : null;
    const content = regions.resolve(hit, pointer);
    if (!content?.isConnected) {
      hideOverlay();
      return;
    }
    // Pointer events within the same block should not remeasure or restart its animation.
    if (visible && focusedContent === content && !snapToContent) return;
    const rect = content.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    // Keep the reading rail aligned across indented lists, quotes and centered formulas.
    const left = Math.max(12, articleRect.left);
    const right = Math.min(viewportWidth - 12, articleRect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(innerHeight, rect.bottom);
    if (right <= left || bottom <= top) {
      hideOverlay();
      return;
    }
    // Animate reading-block changes, but stay attached to the page while scrolling.
    if (!visible || snapToContent) overlay.dataset.motion = "instant";
    else if (focusedContent !== content) overlay.dataset.motion = "smooth";
    focusedContent = content;
    overlay.style.setProperty("--reading-focus-left", `${left}px`);
    overlay.style.setProperty("--reading-focus-top", `${top}px`);
    overlay.style.setProperty("--reading-focus-width", `${right - left}px`);
    overlay.style.setProperty("--reading-focus-height", `${bottom - top}px`);
    overlay.dataset.style = preferences.style;
    visible = true;
    overlay.dataset.visible = "true";
  }

  function schedulePaint(): void {
    if (
      !frame &&
      !signal.aborted &&
      getPreferences().enabled &&
      !isSuspended() &&
      !document.hidden &&
      (pointer || keyboardTarget || visible)
    )
      frame = requestAnimationFrame(paintOverlay);
  }

  function forgetPointer(): void {
    pointer = null;
    keyboardTarget = null;
    hideOverlay();
  }

  document.addEventListener(
    "pointermove",
    event => {
      if (
        !getPreferences().enabled ||
        isSuspended() ||
        event.pointerType !== "mouse" ||
        !hoverPointer.matches
      )
        return;
      pointer = { x: event.clientX, y: event.clientY };
      keyboardTarget = null;
      if (visible || main?.contains(event.target as Node)) schedulePaint();
    },
    { passive: true, signal }
  );
  document.addEventListener(
    "pointerout",
    event => {
      if (!event.relatedTarget) forgetPointer();
    },
    { signal }
  );
  document.addEventListener(
    "pointerdown",
    event => {
      if (event.pointerType === "touch") forgetPointer();
    },
    { signal }
  );
  document.addEventListener(
    "focusin",
    event => {
      pointer = null;
      keyboardTarget = event.target instanceof Element ? event.target : null;
      schedulePaint();
    },
    { signal }
  );
  document.addEventListener(
    "focusout",
    () => {
      keyboardTarget = null;
      schedulePaint();
    },
    { signal }
  );
  window.addEventListener("blur", forgetPointer, { signal });
  document.addEventListener("visibilitychange", forgetPointer, { signal });
  hoverPointer.addEventListener("change", forgetPointer, { signal });
  document.addEventListener(
    "scroll",
    event => {
      // Nested scroll containers move their children relative to the article.
      if (event.target instanceof Element && article.contains(event.target))
        regions.invalidate();
      geometryChanged = true;
      schedulePaint();
    },
    { capture: true, passive: true, signal }
  );
  function invalidateRegions(): void {
    geometryChanged = true;
    regions.invalidate();
    schedulePaint();
  }
  window.addEventListener("resize", invalidateRegions, {
    passive: true,
    signal,
  });
  article.addEventListener("load", invalidateRegions, {
    capture: true,
    signal,
  });
  article.addEventListener("toggle", invalidateRegions, {
    capture: true,
    signal,
  });

  // Images, formulas and Mermaid can resize after the pointer has stopped moving.
  const resizeObserver = new ResizeObserver(invalidateRegions);
  resizeObserver.observe(article);
  resizeObserver.observe(main ?? document.body);
  const mutationObserver = new MutationObserver(records => {
    if (
      records.some(
        record =>
          !(record.target instanceof Element) ||
          !record.target.closest(EXCLUDED_CONTENT)
      )
    )
      invalidateRegions();
  });
  mutationObserver.observe(article, { childList: true, subtree: true });

  signal.addEventListener(
    "abort",
    () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      overlay.remove();
    },
    { once: true }
  );

  return {
    refresh() {
      if (!getPreferences().enabled || isSuspended()) forgetPointer();
      else {
        geometryChanged = true;
        schedulePaint();
      }
    },
  };
}
