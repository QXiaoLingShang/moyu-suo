import { EXCLUDED_CONTENT } from "./regions";

const SCROLL_QUIET_PERIOD = 180;

type TargetHighlightOptions = {
  article: HTMLElement;
  signal: AbortSignal;
  isEnabled: () => boolean;
  getDuration: () => number;
};

export function createTargetHighlight({
  article,
  signal,
  isEnabled,
  getDuration,
}: TargetHighlightOptions) {
  let cue: {
    heading: HTMLElement;
    duration: number;
    arriving: boolean;
  } | null = null;
  let settleTimer = 0;
  let clearTimer = 0;

  function clear(): void {
    window.clearTimeout(settleTimer);
    window.clearTimeout(clearTimer);
    cue?.heading.classList.remove("reading-focus-target");
    cue?.heading.removeAttribute("data-reading-focus-arriving");
    cue?.heading.style.removeProperty("--reading-focus-duration");
    cue = null;
  }

  function startHold(): void {
    if (!cue?.arriving) return;
    const { heading, duration } = cue;
    window.clearTimeout(settleTimer);
    if (!heading.isConnected || !isEnabled()) {
      clear();
      return;
    }
    cue.arriving = false;
    heading.removeAttribute("data-reading-focus-arriving");
    clearTimer = window.setTimeout(clear, duration);
  }

  function waitForScroll(): void {
    if (!cue?.arriving) return;
    window.clearTimeout(settleTimer);
    // A quiet-scroll fallback also handles unchanged hashes and browsers without scrollend.
    settleTimer = window.setTimeout(startHold, SCROLL_QUIET_PERIOD);
  }

  function onAnchorClick(event: MouseEvent): void {
    if (
      !isEnabled() ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target.toLowerCase() !== "_self") ||
      link.closest(EXCLUDED_CONTENT) ||
      (!link.closest("#article-toc") && !article.contains(link))
    )
      return;
    if (
      link.origin !== location.origin ||
      link.pathname !== location.pathname ||
      link.search !== location.search ||
      !link.hash
    )
      return;
    let id: string;
    try {
      id = decodeURIComponent(link.hash.slice(1));
    } catch {
      return;
    }
    const heading = document.getElementById(id);
    if (
      !heading?.matches("h2, h3, h4, h5, h6") ||
      !article.contains(heading) ||
      heading.closest(EXCLUDED_CONTENT) ||
      heading.closest("[data-footnotes]")
    )
      return;
    clear();
    cue = { heading, duration: getDuration(), arriving: true };
    // Snapshot both clocks together; changing a setting applies to the next navigation.
    heading.style.setProperty("--reading-focus-duration", `${cue.duration}ms`);
    // Show the cue during navigation; scrolling must not consume its reading time.
    heading.setAttribute("data-reading-focus-arriving", "");
    heading.classList.add("reading-focus-target");
    // Repeated clicks can remove and restore the class within the same rendered frame.
    for (const animation of heading.getAnimations()) {
      if (
        animation instanceof CSSAnimation &&
        animation.animationName === "reading-focus-target"
      )
        animation.currentTime = 0;
    }
    waitForScroll();
  }
  // Run before Astro's document-level navigation handler consumes same-page links.
  article.addEventListener("click", onAnchorClick, { signal });
  document
    .getElementById("article-toc")
    ?.addEventListener("click", onAnchorClick, { signal });
  window.addEventListener("scroll", waitForScroll, { passive: true, signal });
  // A cancelled smooth scroll may emit scrollend before a newer navigation begins.
  document.addEventListener("scrollend", waitForScroll, { signal });
  signal.addEventListener("abort", clear, { once: true });

  return { clear };
}
