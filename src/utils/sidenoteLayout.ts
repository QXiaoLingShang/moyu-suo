import {
  intersectsSidenoteRange,
  type SidenoteCardBounds,
  type SidenoteReadingTarget,
} from "./sidenoteGeometry.ts";

type ViewportRange = { viewportStart: number; viewportEnd: number };
type MeasuredGroup = { anchor: number; height: number };
type GeometryOptions = {
  gap: number;
  anchorOffset: number;
};
export type SidenoteLayoutFrame = ViewportRange & {
  focusIndex: number;
  previewStart?: number;
  previewEnd?: number;
  readingLine?: number;
};
export type SidenotePlacement = {
  top: number;
  height: number;
  /** Keep focus out of this classification so selecting a card cannot make it persistent. */
  baseStatic: boolean;
  regionIndex: number;
  /** A dense region's fallback stays distinct from a naturally isolated card. */
  visibleRepresentative: boolean;
};
type RegionGeometry = { firstIndex: number; lastIndex: number };
type NoteRegion = RegionGeometry & { representativeIndex: number };
export type SidenoteLayoutResult = {
  items: SidenotePlacement[];
  regions: NoteRegion[];
  focusTop: number | null;
};
export type PreparedSidenoteLayout = {
  /** Shared with focus selection so a partially visible card does not lose focus early. */
  readonly readingTargets: readonly SidenoteReadingTarget[];
  arrange: (frame: SidenoteLayoutFrame) => SidenoteLayoutResult;
};

/** One-shot layout for callers without a measurement lifecycle. */
export function calculateSidenoteLayout(
  groups: readonly MeasuredGroup[],
  options: GeometryOptions & SidenoteLayoutFrame
): SidenoteLayoutResult {
  return prepareSidenoteLayout(groups, options).arrange(options);
}

/**
 * Cache article-relative geometry in anchor order; rebuild after measurements change.
 * Snapshot values so later DOM regrouping cannot partially update the cached regions.
 */
export function prepareSidenoteLayout(
  sourceGroups: readonly MeasuredGroup[],
  { gap, anchorOffset }: GeometryOptions
): PreparedSidenoteLayout {
  const groups = sourceGroups.map(group => ({
    anchor: group.anchor,
    height: group.height,
    naturalTop: group.anchor - Math.min(anchorOffset, group.height * 0.16),
    regionIndex: -1,
  }));
  // Include offscreen neighbors and their furthest edge so one tall note can
  // connect several short notes without splitting the region as we scroll.
  const regionsWithBounds: (RegionGeometry & {
    top: number;
    bottom: number;
  })[] = [];
  groups.forEach((group, index) => {
    const next = {
      firstIndex: index,
      lastIndex: index,
      top: group.naturalTop,
      bottom: group.naturalTop + group.height,
    };
    let previous = regionsWithBounds.at(-1);
    while (previous && next.top < previous.bottom + gap) {
      regionsWithBounds.pop();
      next.firstIndex = previous.firstIndex;
      next.top = Math.min(next.top, previous.top);
      next.bottom = Math.max(next.bottom, previous.bottom);
      previous = regionsWithBounds.at(-1);
    }
    regionsWithBounds.push(next);
  });
  const geometry = regionsWithBounds.map(({ firstIndex, lastIndex }) => ({
    firstIndex,
    lastIndex,
  }));
  geometry.forEach((region, regionIndex) => {
    for (let index = region.firstIndex; index <= region.lastIndex; index++)
      groups[index].regionIndex = regionIndex;
  });

  const readingTargets = groups.map(group => ({
    anchor: group.anchor,
    top: group.naturalTop,
    height: group.height,
  }));

  return {
    readingTargets,
    arrange({
      focusIndex: focus,
      viewportStart: start,
      viewportEnd: end,
      previewStart = start,
      previewEnd = end,
      readingLine = (start + end) / 2,
    }: SidenoteLayoutFrame): SidenoteLayoutResult {
      const eligible = (card: SidenoteCardBounds) =>
        intersectsSidenoteRange(card, previewStart, previewEnd) &&
        card.height <= end - start;
      const regions: NoteRegion[] = geometry.map(region => ({
        ...region,
        representativeIndex: -1,
      }));
      const items = groups.map(group => {
        const region = geometry[group.regionIndex];
        // Keep document spacing as cards enter or leave the viewport. Clamping
        // cards independently can invent a collision, hide a neighbor, then reveal
        // it again during a single scroll. Focus uses this same position as previews.
        const top = group.naturalTop;
        // An anchor can leave the buffer while a tall card still intersects the
        // screen. Classify by the full displayed footprint to avoid cutting it off.
        const inRange = eligible({ top, height: group.height });
        return {
          top,
          height: group.height,
          baseStatic: inRange && region.firstIndex === region.lastIndex,
          regionIndex: group.regionIndex,
          visibleRepresentative: false,
        };
      });
      if (end <= start || previewEnd <= previewStart)
        return { items, regions, focusTop: null };

      const focusAnchor = groups[focus]?.anchor ?? readingLine;
      for (const region of regions) {
        if (focus >= region.firstIndex && focus <= region.lastIndex) {
          region.representativeIndex = focus;
          continue;
        }
        // Nearest to focus means the facing endpoint outside a region. If there is
        // no active focus inside a long region, it also avoids jumping to its far end.
        let distance = Infinity;
        for (
          let index = region.firstIndex;
          index <= region.lastIndex;
          index++
        ) {
          if (!eligible(readingTargets[index])) continue;
          const nextDistance = Math.abs(groups[index].anchor - focusAnchor);
          if (nextDistance < distance) {
            distance = nextDistance;
            region.representativeIndex = index;
          }
        }
      }
      const primary = items[focus];
      const focusTop = primary?.top ?? null;
      items.forEach((item, index) => {
        item.visibleRepresentative =
          regions[item.regionIndex].representativeIndex === index &&
          index !== focus &&
          !item.baseStatic;
      });
      return { items, regions, focusTop };
    },
  };
}
