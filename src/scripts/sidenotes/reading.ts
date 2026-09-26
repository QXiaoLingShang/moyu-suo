import {
  intersectsSidenoteRange,
  type SidenoteReadingTarget,
} from "@/utils/sidenoteGeometry";
import {
  selectSidenoteFocus,
  type SidenoteReadingFrame,
} from "@/utils/sidenoteSelection";

/** Resolve input in event order so a later scroll can supersede a manual choice in the same frame. */
export function createReadingFocus() {
  let manualSelection = false;
  let pendingInput: "manual" | "scroll" | null = null;
  let previousLine: number | null = null;
  let direction: "down" | "up" = "down";
  let geometryChanged = true;

  function resolve(
    groups: readonly SidenoteReadingTarget[],
    frame: SidenoteReadingFrame
  ): number {
    // A repaint or a later manual choice must not replay a scroll crossing.
    // Remeasurement has no comparable baseline, so it cannot count as reading.
    let baseline = previousLine;
    if (geometryChanged) baseline = null;
    else if (baseline !== null && pendingInput !== "scroll")
      baseline = frame.readingLine;
    if (baseline !== null && baseline !== frame.readingLine) {
      direction = frame.readingLine > baseline ? "down" : "up";
    }
    const current = groups[frame.selectedIndex];
    // Font/image loading changes geometry, not reading intent. Keep the same
    // reference when it still belongs to the visible region after remeasurement.
    const preserveSelection =
      geometryChanged &&
      current &&
      intersectsSidenoteRange(current, frame.viewportStart, frame.viewportEnd);
    const result = preserveSelection
      ? { index: frame.selectedIndex, manual: manualSelection }
      : selectSidenoteFocus(groups, {
          ...frame,
          manualSelection: manualSelection && !geometryChanged,
          previousReadingLine: baseline,
          direction,
        });
    manualSelection = result.manual;
    previousLine = frame.readingLine;
    pendingInput = null;
    geometryChanged = false;
    return result.index;
  }

  return {
    resolve,
    selectManually({ hasSelection }: { hasSelection: boolean }) {
      manualSelection = hasSelection;
      pendingInput = "manual";
    },
    scrolled() {
      pendingInput = "scroll";
    },
    invalidateGeometry() {
      geometryChanged = true;
    },
  };
}
