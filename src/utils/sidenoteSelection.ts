export type SidenoteReadingFrame = {
  selectedIndex: number;
  viewportStart: number;
  viewportEnd: number;
  readingLine: number;
};

type FocusOptions = SidenoteReadingFrame & {
  manualSelection: boolean;
  previousReadingLine: number | null;
  direction: "down" | "up";
};

/** Anchors must be in ascending order and share the reading line's coordinate space. */
export function selectSidenoteFocus(
  groups: readonly SidenoteReadingTarget[],
  {
    selectedIndex,
    viewportStart,
    viewportEnd,
    manualSelection,
    readingLine,
    previousReadingLine,
    direction,
  }: FocusOptions
): { index: number; manual: boolean } {
  const current = groups[selectedIndex];
  const moved =
    previousReadingLine !== null && readingLine !== previousReadingLine;
  if (current && manualSelection) {
    // Manual exploration lasts until reading catches up, even outside the viewport.
    const ahead =
      direction === "down"
        ? current.anchor > readingLine
        : current.anchor < readingLine;
    if (!moved || ahead) return { index: selectedIndex, manual: true };
  }
  // Keep the current reading choice between crossings, including small reversals.
  if (current && !manualSelection && previousReadingLine !== null) {
    let crossed = -1;
    groups.forEach((group, index) => {
      if (!intersectsSidenoteRange(group, viewportStart, viewportEnd)) return;
      if (
        direction === "down" &&
        group.anchor > previousReadingLine &&
        group.anchor <= readingLine
      )
        crossed = index;
      if (
        direction === "up" &&
        crossed < 0 &&
        group.anchor < previousReadingLine &&
        group.anchor >= readingLine
      )
        crossed = index;
    });
    if (crossed >= 0) return { index: crossed, manual: false };
    if (intersectsSidenoteRange(current, viewportStart, viewportEnd))
      return { index: selectedIndex, manual: false };
    return { index: -1, manual: false };
  }
  let candidate = -1;
  groups.forEach((group, index) => {
    if (!intersectsSidenoteRange(group, viewportStart, viewportEnd)) return;
    if (candidate < 0) candidate = index;
    if (direction === "down" && group.anchor <= readingLine) candidate = index;
    if (direction === "up" && groups[candidate].anchor < readingLine)
      candidate = index;
  });
  return { index: candidate, manual: false };
}

/** Deduplicate within a spatial group so distant repeats keep their own navigation positions. */
export function getSidenoteChoices<T extends { note: unknown }>(
  references: readonly T[],
  current?: T
): T[] {
  const choices = new Map<unknown, T>();
  for (const reference of references) {
    if (!choices.has(reference.note)) choices.set(reference.note, reference);
  }
  if (current && choices.has(current.note)) choices.set(current.note, current);
  return [...choices.values()];
}
import {
  intersectsSidenoteRange,
  type SidenoteReadingTarget,
} from "./sidenoteGeometry";
