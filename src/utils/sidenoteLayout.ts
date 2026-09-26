type Viewport = { viewportStart: number; viewportEnd: number };
type FocusOptions = Viewport & {
  selectedIndex: number;
  keepManualSelection?: boolean;
};
type LayoutOptions = Viewport & {
  focusIndex: number;
  gap: number;
  anchorOffset: number;
};
export type SidenotePlacement = {
  top: number;
  height: number;
  /** Keep focus out of this classification so selecting a card cannot make it persistent. */
  baseStatic: boolean;
  /** Whether the persistent preview has room after focus reserves space. */
  visibleStatic: boolean;
};
type LayoutResult = { items: SidenotePlacement[]; focusTop: number | null };

/** Retain a visible selection so scrolling toward another node does not interrupt reading. */
export function selectSidenoteFocus(
  groups: readonly { anchor: number; start: number; end: number }[],
  {
    selectedIndex: selected,
    viewportStart: start,
    viewportEnd: end,
    keepManualSelection = false,
  }: FocusOptions
): number {
  const intersects = (group: { start: number; end: number }) =>
    group.end > start && group.start < end;
  if (
    selected >= 0 &&
    groups[selected] &&
    (keepManualSelection || intersects(groups[selected]))
  )
    return selected;
  const center = (start + end) / 2;
  return groups.reduce((best, group, index) => {
    if (!intersects(group)) return best;
    return best < 0 ||
      Math.abs(group.anchor - center) < Math.abs(groups[best].anchor - center)
      ? index
      : best;
  }, -1);
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

/** Reserve room for focus without changing which cards qualify for merge/split animations. */
export function calculateSidenoteLayout(
  groups: readonly { anchor: number; height: number }[],
  {
    focusIndex: focus,
    viewportStart: start,
    viewportEnd: end,
    gap,
    anchorOffset,
  }: LayoutOptions
): LayoutResult {
  const clamp = (top: number, height: number) =>
    Math.max(start, Math.min(top, end - height));
  const items = groups.map(group => {
    const inRange = group.anchor >= start && group.anchor <= end;
    const naturalTop =
      group.anchor - Math.min(anchorOffset, group.height * 0.16);
    return {
      top: inRange ? clamp(naturalTop, group.height) : naturalTop,
      height: group.height,
      baseStatic: inRange && end > start && group.height <= end - start,
      visibleStatic: false,
    };
  });
  // Include offscreen neighbors. A tall preview can overlap more than one
  // short neighbor, so retain the furthest occupied edge while scanning.
  let furthest = -1;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (furthest >= 0) {
      const previous = items[furthest];
      if (item.top < previous.top + previous.height + gap) {
        previous.baseStatic = false;
        item.baseStatic = false;
      }
    }
    if (
      furthest < 0 ||
      item.top + item.height > items[furthest].top + items[furthest].height
    )
      furthest = index;
  }
  const primary = items[focus];
  const focusTop = primary
    ? primary.baseStatic
      ? primary.top
      : clamp(groups[focus].anchor - primary.height / 2, primary.height)
    : null;
  items.forEach((item, index) => {
    const collidesWithFocus =
      primary &&
      focusTop !== null &&
      index !== focus &&
      item.top < focusTop + primary.height + gap &&
      item.top + item.height + gap > focusTop;
    item.visibleStatic = item.baseStatic && !collidesWithFocus;
  });
  return { items, focusTop };
}
