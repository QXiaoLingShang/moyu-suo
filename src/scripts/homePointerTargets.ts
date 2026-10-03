import {
  boundsCenter,
  boundsFromRects,
  containsPoint,
  closestBoundaryPoint,
  expandBounds,
  type PointerBounds,
  type PointerPoint,
} from "@/utils/homePointerGeometry";

export type PointerGlyphDestination = {
  glyph: HTMLElement | null;
  glyphIndex: number;
  point: PointerPoint;
};

const graphemeSegmenter =
  typeof Intl.Segmenter === "undefined"
    ? null
    : new Intl.Segmenter(undefined, { granularity: "grapheme" });

function splitGraphemes(value: string): string[] {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value), part => part.segment)
    : Array.from(value);
}

export class HomePointerTargets {
  private entranceBounds = new Map<HTMLElement, PointerBounds>();
  private entranceBoundsLoaded = false;

  invalidate(): void {
    this.entranceBounds.clear();
    this.entranceBoundsLoaded = false;
  }

  glyphs(target: HTMLElement): HTMLElement[] {
    const entrance = target.closest<HTMLElement>(".home-entrance[data-key]");
    const scope = entrance ?? target;
    return Array.from(
      scope.querySelectorAll<HTMLElement>(
        ".home-entrance__glyph, .home-pointer__glyph"
      )
    ).filter(glyph => Boolean(glyph.textContent?.trim()));
  }

  prepare(target: HTMLElement): HTMLElement[] {
    if (target.closest(".home-entrance[data-key]")) return this.glyphs(target);

    const existing = this.glyphs(target);
    if (existing.length > 0) {
      target.dataset.homePointerText = "glyphs";
      return existing;
    }

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const parent = textNode.parentElement;
      if (
        parent &&
        !parent.closest("svg, [aria-hidden='true'], .sr-only, script, style")
      ) {
        textNodes.push(textNode);
      }
    }

    let glyphIndex = 0;
    textNodes.forEach(textNode => {
      const fragment = document.createDocumentFragment();
      splitGraphemes(textNode.data).forEach(segment => {
        const glyph = document.createElement("span");
        glyph.className = "home-pointer__glyph";
        glyph.dataset.glyphIndex = String(glyphIndex++);
        glyph.textContent = segment;
        fragment.append(glyph);
      });
      textNode.replaceWith(fragment);
    });

    const glyphs = this.glyphs(target);
    if (glyphs.length > 0) target.dataset.homePointerText = "glyphs";
    return glyphs;
  }

  bounds(target: HTMLElement): PointerBounds {
    const entrance = target.closest<HTMLElement>(".home-entrance[data-key]");
    const cachedBounds = entrance
      ? this.entranceBounds.get(entrance)
      : undefined;
    if (cachedBounds) return cachedBounds;

    const glyphBounds = boundsFromRects(
      this.glyphs(target).map(glyph => glyph.getBoundingClientRect())
    );
    if (glyphBounds) {
      if (entrance) this.entranceBounds.set(entrance, glyphBounds);
      return glyphBounds;
    }

    const title = entrance?.querySelector<HTMLElement>(".home-entrance__title");
    const rect = (title ?? target).getBoundingClientRect();
    const bounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
    if (entrance) this.entranceBounds.set(entrance, bounds);
    return bounds;
  }

  expandedBounds(target: HTMLElement, padding: number): PointerBounds {
    return expandBounds(this.bounds(target), padding);
  }

  boundaryPoint(
    target: HTMLElement,
    origin: PointerPoint,
    padding: number
  ): PointerPoint {
    return closestBoundaryPoint(origin, this.expandedBounds(target, padding));
  }

  findExpandedEntrance(
    point: PointerPoint,
    padding: number
  ): HTMLElement | null {
    // Cache the stable entrance labels until scrolling, resizing, or font changes.
    if (!this.entranceBoundsLoaded) {
      this.entranceBoundsLoaded = true;
      document
        .querySelectorAll<HTMLElement>(".home-entrance[data-key]")
        .forEach(entrance => {
          if (entrance.getClientRects().length > 0) this.bounds(entrance);
        });
    }

    let closest: HTMLElement | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    this.entranceBounds.forEach((bounds, entrance) => {
      const expanded = expandBounds(bounds, padding);
      if (!containsPoint(point, expanded)) return;

      const distance = Math.hypot(
        point.x - boundsCenter(expanded).x,
        point.y - boundsCenter(expanded).y
      );
      if (distance < closestDistance) {
        closest = entrance;
        closestDistance = distance;
      }
    });

    return closest;
  }

  destinations(target: HTMLElement): PointerGlyphDestination[] {
    const glyphs = this.prepare(target);
    if (glyphs.length === 0) {
      const rect = target.getBoundingClientRect();
      return [
        {
          glyph: null,
          glyphIndex: 0,
          point: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        },
      ];
    }

    return glyphs.map((glyph, glyphIndex) => {
      const rect = glyph.getBoundingClientRect();
      return {
        glyph,
        glyphIndex,
        point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      };
    });
  }
}
