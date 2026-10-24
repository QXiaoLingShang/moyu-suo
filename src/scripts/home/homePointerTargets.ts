import {
  boundsCenter,
  boundsFromRects,
  containsPoint,
  closestBoundaryPoint,
  expandBounds,
  type PointerBounds,
  type PointerPoint,
} from "@/utils/home/homePointerGeometry";

export type PointerGlyphDestination = {
  glyph: HTMLElement | null;
  glyphIndex: number;
  point: PointerPoint;
};

type SVGPathSample = { path: SVGPathElement; x: number; y: number };
type SVGPathSamples = {
  paths: SVGPathElement[];
  signature: string;
  samples: SVGPathSample[];
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
  private targetBounds = new Map<HTMLElement, PointerBounds>();
  private destinationPresence = new WeakMap<HTMLElement, boolean>();
  private svgSamples = new WeakMap<SVGSVGElement, SVGPathSamples>();
  private entranceBoundsLoaded = false;

  invalidate(): void {
    this.entranceBounds.clear();
    this.targetBounds.clear();
    this.destinationPresence = new WeakMap();
    this.entranceBoundsLoaded = false;
  }

  hasDestinations(target: HTMLElement): boolean {
    const cached = this.destinationPresence.get(target);
    if (cached !== undefined) return cached;

    const hasText = this.prepare(target).length > 0;
    const hasSvgPath =
      !hasText &&
      Array.from(target.querySelectorAll<SVGSVGElement>("svg")).some(
        svg =>
          svg.checkVisibility({ visibilityProperty: true }) &&
          Array.from(svg.querySelectorAll<SVGPathElement>("path")).some(
            path =>
              this.isVisibleDrawablePath(path) && path.getTotalLength() > 0
          )
      );
    const hasDestinations = hasText || hasSvgPath;
    this.destinationPresence.set(target, hasDestinations);
    return hasDestinations;
  }

  glyphs(target: HTMLElement): HTMLElement[] {
    const entrance = target.closest<HTMLElement>(".home-entrance[data-key]");
    const scope = entrance ?? target;
    return Array.from(
      scope.querySelectorAll<HTMLElement>(
        ".home-entrance__glyph, .home-pointer__glyph"
      )
    ).filter(
      glyph =>
        Boolean(glyph.textContent?.trim()) &&
        glyph.checkVisibility({ visibilityProperty: true })
    );
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
      // aria-hidden can label visible copy (e.g. 中 / EN); CSS visibility and
      // sr-only determine whether there is an actual glyph to illuminate.
      if (
        parent &&
        !parent.closest("svg, .sr-only, script, style, .home-pointer__glyph") &&
        parent.checkVisibility({ visibilityProperty: true }) &&
        textNode.data.trim()
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
    const boundsOwner = entrance ?? target;
    const boundsCache = entrance ? this.entranceBounds : this.targetBounds;
    const cachedBounds = boundsCache.get(boundsOwner);
    if (cachedBounds) return cachedBounds;

    const glyphBounds = boundsFromRects(
      this.glyphs(target).map(glyph => glyph.getBoundingClientRect())
    );
    if (glyphBounds) {
      boundsCache.set(boundsOwner, glyphBounds);
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
    boundsCache.set(boundsOwner, bounds);
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

  destinations(
    target: HTMLElement,
    glyphIndexes?: ReadonlySet<number>
  ): PointerGlyphDestination[] {
    const glyphs = this.prepare(target);
    const destinations: PointerGlyphDestination[] = glyphs.flatMap(
      (glyph, glyphIndex) => {
        if (glyphIndexes && !glyphIndexes.has(glyphIndex)) return [];
        const rect = glyph.getBoundingClientRect();
        return [
          {
            glyph,
            glyphIndex,
            point: {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            },
          },
        ];
      }
    );

    let glyphIndex = glyphs.length;
    target.querySelectorAll<SVGSVGElement>("svg").forEach(svg => {
      const result = this.svgDestinations(svg, glyphIndex);
      result.destinations.forEach(destination => {
        if (!glyphIndexes || glyphIndexes.has(destination.glyphIndex)) {
          destinations.push(destination);
        }
      });
      glyphIndex += result.sampleCount;
    });
    return destinations;
  }

  private isVisibleDrawablePath(path: SVGPathElement): boolean {
    if (!path.checkVisibility({ visibilityProperty: true })) return false;
    const style = getComputedStyle(path);
    return style.stroke !== "none" || style.fill !== "none";
  }

  private svgDestinations(
    svg: SVGSVGElement,
    firstGlyphIndex: number
  ): { destinations: PointerGlyphDestination[]; sampleCount: number } {
    if (!svg.checkVisibility({ visibilityProperty: true })) {
      return { destinations: [], sampleCount: 0 };
    }

    const paths = Array.from(
      svg.querySelectorAll<SVGPathElement>("path")
    ).filter(path => this.isVisibleDrawablePath(path));
    if (paths.length === 0) return { destinations: [], sampleCount: 0 };

    // Sample local path geometry once; compare node identity as well as data
    // because a DOM replacement can reuse identical `d` attributes.
    const signature = paths
      .map(
        path => `${path.getAttribute("d")}\u0000${path.getAttribute("stroke")}`
      )
      .join("\u0001");
    let cached = this.svgSamples.get(svg);
    const pathsMatch =
      cached?.paths.length === paths.length &&
      cached.paths.every((path, index) => path === paths[index]);
    if (!cached || !pathsMatch || cached.signature !== signature) {
      const drawablePaths = paths
        .map(path => ({ path, length: path.getTotalLength() }))
        .filter(({ length }) => length > 0);
      const totalLength = drawablePaths.reduce(
        (length, item) => length + item.length,
        0
      );
      const samples: SVGPathSample[] = [];

      if (totalLength > 0) {
        const sampleCount = Math.min(
          8,
          Math.max(4, Math.ceil(totalLength / 8))
        );
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          let remainingLength =
            ((sampleIndex + 0.5) / sampleCount) * totalLength;
          let selected = drawablePaths[drawablePaths.length - 1];
          for (const candidate of drawablePaths) {
            selected = candidate;
            if (remainingLength <= candidate.length) break;
            remainingLength -= candidate.length;
          }
          const point = selected.path.getPointAtLength(remainingLength);
          samples.push({ path: selected.path, x: point.x, y: point.y });
        }
      }

      cached = { paths, signature, samples };
      this.svgSamples.set(svg, cached);
    }

    // Screen matrices change with layout, so transform cached local points now.
    const destinations: PointerGlyphDestination[] = [];
    const screenPoint = svg.createSVGPoint();
    const matrices = new Map<SVGPathElement, DOMMatrix | null>();
    cached.samples.forEach((sample, sampleIndex) => {
      const glyphIndex = firstGlyphIndex + sampleIndex;
      let matrix = matrices.get(sample.path);
      if (matrix === undefined) {
        matrix = sample.path.getScreenCTM();
        matrices.set(sample.path, matrix);
      }
      if (!matrix) return;

      screenPoint.x = sample.x;
      screenPoint.y = sample.y;
      const point = screenPoint.matrixTransform(matrix);
      destinations.push({
        glyph: null,
        glyphIndex,
        point: { x: point.x, y: point.y },
      });
    });
    return { destinations, sampleCount: cached.samples.length };
  }
}
