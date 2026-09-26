export type PointerPosition = { x: number; y: number };

const BLOCKS =
  "h1, h2, h3, h4, h5, h6, p, li, dt, dd, pre, blockquote, table, figure, summary, details, hr, img, video, audio, iframe, .callout, .katex-display, svg";
const WIDGETS = "pre, table, figure, .katex-display, video, audio, iframe";
export const EXCLUDED_CONTENT =
  "dialog, [inert], [data-reading-focus-ignore], .sidenote-sidebar, .sidenote-rail, .sidenote-dock-card, .sidenote-transition-shadow";

const GAP_TOLERANCE = 24;
type Region = {
  element: Element;
  top: number;
  bottom: number;
  height: number;
  precedingBottom: number;
};

export function createContentRegions(article: HTMLElement) {
  let regions: Region[] | undefined;
  const title = article.parentElement?.querySelector(
    "[data-reading-focus-title]"
  );

  function readingBlock(target: Element): Element | null {
    const widget = target.closest(WIDGETS);
    if (widget && article.contains(widget)) return widget;
    const block = target.closest(BLOCKS);
    if (!block || !article.contains(block)) return null;
    // Tiny callout icons belong to the callout, while large SVG diagrams stand alone.
    return block.matches("svg") ? (block.closest(".callout") ?? block) : block;
  }

  function measure(articleTop: number): Region[] {
    const elements = new Set<Element>();
    for (const element of article.querySelectorAll(BLOCKS)) {
      if (element.closest(EXCLUDED_CONTENT)) continue;
      const block = readingBlock(element);
      if (block) elements.add(block);
    }
    // Custom Markdown/MDX wrappers can contain plain text without a semantic paragraph.
    for (const child of article.children) {
      if (
        !child.matches("script, style, aside, dialog") &&
        !child.querySelector(BLOCKS) &&
        child.textContent?.trim()
      )
        elements.add(child);
    }
    const measured: Region[] = [];
    for (const element of elements) {
      if (element.closest(EXCLUDED_CONTENT)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height)
        measured.push({
          element,
          top: rect.top - articleTop,
          bottom: rect.bottom - articleTop,
          height: rect.height,
          precedingBottom: 0,
        });
    }
    measured.sort((a, b) => a.top - b.top);
    let bottom = -Infinity;
    for (const region of measured) {
      bottom = Math.max(bottom, region.bottom);
      region.precedingBottom = bottom;
    }
    return measured;
  }

  function resolve(
    target: Element | null,
    pointer: PointerPosition | null
  ): Element | null {
    if (!target || target.closest(EXCLUDED_CONTENT)) return null;
    if (title?.contains(target)) return title;
    const inside = article.contains(target);
    if (!inside && !target.contains(article)) return null;
    if (inside) {
      const block = readingBlock(target);
      if (block) return block;
    }
    if (!pointer) return null;
    const articleRect = article.getBoundingClientRect();
    if (
      pointer.x < articleRect.left - 12 ||
      pointer.x > articleRect.right + 12 ||
      pointer.y < articleRect.top ||
      pointer.y > articleRect.bottom
    )
      return null;
    // Article-relative coordinates survive layout shifts above the post.
    regions ??= measure(articleRect.top);
    const y = pointer.y - articleRect.top;
    let best: Region | undefined;
    let distance = GAP_TOLERANCE;
    let start = 0;
    let end = regions.length;
    while (start < end) {
      const middle = (start + end) >>> 1;
      if (regions[middle].top <= y + GAP_TOLERANCE) start = middle + 1;
      else end = middle;
    }
    // Bridge small paragraph margins without lighting up an unrelated distant block.
    // The prefix bound preserves nested blocks without scanning the entire long post.
    for (
      let i = start - 1;
      i >= 0 && regions[i].precedingBottom >= y - GAP_TOLERANCE;
      i--
    ) {
      const region = regions[i];
      const gap = Math.max(region.top - y, y - region.bottom, 0);
      if (
        gap < distance ||
        (gap === distance && region.height < (best?.height ?? Infinity))
      ) {
        best = region;
        distance = gap;
      }
    }
    return best?.element ?? null;
  }

  return {
    resolve,
    invalidate: () => {
      regions = undefined;
    },
  };
}
