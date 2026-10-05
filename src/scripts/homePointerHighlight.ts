import type { SampledPointerParticle } from "@/utils/homePointerSampling";
import type { PointerGlyphDestination } from "./homePointerTargets";
import { HomePointerTargets } from "./homePointerTargets";

export type PointerAnchor = SampledPointerParticle<PointerGlyphDestination>;
type PointerPhase = "approaching" | "dispersing" | "merged" | "departing";
const HIGHLIGHT_STAGGER_MS = 52;
const MAX_HIGHLIGHT_DELAY_MS = 416;

export class HomePointerHighlight {
  private anchors = new Map<HTMLElement, PointerAnchor[]>();
  private arrived = new Map<HTMLElement, Set<number>>();

  constructor(private targets: HomePointerTargets) {}

  setPhase(target: HTMLElement, phase: PointerPhase): void {
    target.dataset.homePointerPhase = phase;
    const entrance = target.closest<HTMLElement>(".home-entrance[data-key]");
    if (entrance) entrance.dataset.homePointerPhase = phase;
  }

  clearPhase(target: HTMLElement): void {
    target.removeAttribute("data-home-pointer-phase");
    target.removeAttribute("data-home-pointer-text");
    const entrance = target.closest<HTMLElement>(".home-entrance[data-key]");
    entrance?.removeAttribute("data-home-pointer-phase");
    this.targets.glyphs(target).forEach(glyph => {
      glyph.removeAttribute("data-home-pointer-lit");
      glyph.removeAttribute("data-home-pointer-anchor");
      glyph.removeAttribute("data-home-pointer-source");
      glyph.removeAttribute("data-home-pointer-fading");
      glyph.style.removeProperty("--home-glyph-delay");
    });
    this.arrived.delete(target);
  }

  clearTarget(target: HTMLElement): void {
    this.clearPhase(target);
    this.anchors.delete(target);
    this.arrived.delete(target);
  }

  clearAll(): void {
    this.anchors.clear();
    this.arrived.clear();
  }

  setAnchors(target: HTMLElement, anchors: readonly PointerAnchor[]): void {
    this.writeAnchorAttributes(target, anchors);
    this.anchors.set(target, [...anchors]);
    this.arrived.set(target, new Set());
  }

  updateAnchorDestinations(
    target: HTMLElement,
    destinations: readonly PointerGlyphDestination[]
  ): PointerAnchor[] | null {
    const anchors = this.anchors.get(target);
    if (!anchors) return null;

    const destinationsByGlyph = new Map(
      destinations.map(destination => [destination.glyphIndex, destination])
    );
    const updatedAnchors = anchors.map(anchor => {
      const destination = destinationsByGlyph.get(anchor.glyphIndex);
      return destination
        ? {
            ...anchor,
            glyph: destination.glyph,
            point: destination.point,
          }
        : null;
    });
    const validAnchors = updatedAnchors.filter(
      (anchor): anchor is PointerAnchor => anchor !== null
    );
    if (validAnchors.length !== anchors.length) return null;
    this.writeAnchorAttributes(target, validAnchors);
    this.anchors.set(target, validAnchors);
    return validAnchors;
  }

  private writeAnchorAttributes(
    target: HTMLElement,
    anchors: readonly PointerAnchor[]
  ): void {
    this.targets.glyphs(target).forEach(glyph => {
      glyph.removeAttribute("data-home-pointer-anchor");
    });
    const assignments = new Map<HTMLElement, number[]>();
    anchors.forEach(anchor => {
      if (!anchor.glyph) return;
      const indexes = assignments.get(anchor.glyph) ?? [];
      indexes.push(anchor.anchorIndex);
      assignments.set(anchor.glyph, indexes);
    });
    assignments.forEach((indexes, glyph) => {
      glyph.dataset.homePointerAnchor = indexes.join(",");
    });
  }

  getAnchors(target: HTMLElement): PointerAnchor[] {
    return this.anchors.get(target) ?? [];
  }

  getArrivedAnchors(target: HTMLElement): PointerAnchor[] {
    const arrived = this.arrived.get(target);
    if (!arrived?.size) return [];
    return this.getAnchors(target).filter(anchor =>
      arrived.has(anchor.anchorIndex)
    );
  }

  markArrived(target: HTMLElement, anchorIndex: number): void {
    const anchors = this.getAnchors(target);
    const arrived = this.arrived.get(target) ?? new Set<number>();
    arrived.add(anchorIndex);
    this.arrived.set(target, arrived);

    const activeSeeds = anchors.filter(anchor =>
      arrived.has(anchor.anchorIndex)
    );
    this.diffuse(target, activeSeeds);
  }

  retract(
    target: HTMLElement,
    departureOrder: ReadonlyMap<number, number>,
    staggerMs: number
  ): void {
    const anchors = this.getAnchors(target);
    const illuminated = this.arrived.get(target) ?? new Set<number>();
    this.targets.glyphs(target).forEach((glyph, glyphIndex) => {
      if (!glyph.hasAttribute("data-home-pointer-lit")) return;

      const sourceIndex = Number(glyph.dataset.homePointerSource);
      const sourceAnchors = anchors.filter(
        anchor =>
          anchor.glyphIndex === sourceIndex &&
          illuminated.has(anchor.anchorIndex)
      );
      const sourceAnchor = sourceAnchors[0];
      const departureDelay = sourceAnchors.length
        ? Math.min(
            ...sourceAnchors.map(
              anchor => departureOrder.get(anchor.anchorIndex) ?? 0
            )
          ) * staggerMs
        : 0;
      const distance = sourceAnchor
        ? Math.abs(sourceAnchor.glyphIndex - glyphIndex)
        : 0;
      glyph.style.setProperty(
        "--home-glyph-delay",
        `${Math.min(departureDelay + 20 + distance * 18, 180)}ms`
      );
      glyph.dataset.homePointerFading = "true";
      glyph.removeAttribute("data-home-pointer-lit");
    });
  }

  private diffuse(target: HTMLElement, seeds: readonly PointerAnchor[]): void {
    if (seeds.length === 0) return;
    this.targets.glyphs(target).forEach((glyph, glyphIndex) => {
      const nearestSeedIndex = seeds.reduce(
        (nearestIndex, anchor) =>
          Math.abs(anchor.glyphIndex - glyphIndex) <
          Math.abs(nearestIndex - glyphIndex)
            ? anchor.glyphIndex
            : nearestIndex,
        seeds[0].glyphIndex
      );
      const distance = Math.abs(nearestSeedIndex - glyphIndex);
      glyph.dataset.homePointerSource = String(nearestSeedIndex);
      glyph.removeAttribute("data-home-pointer-fading");
      if (glyph.hasAttribute("data-home-pointer-lit")) return;

      glyph.style.setProperty(
        "--home-glyph-delay",
        `${Math.min(distance * HIGHLIGHT_STAGGER_MS, MAX_HIGHLIGHT_DELAY_MS)}ms`
      );
      glyph.dataset.homePointerLit = "true";
    });
  }
}
