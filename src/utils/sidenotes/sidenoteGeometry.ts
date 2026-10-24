export type SidenoteReadingTarget = Readonly<{
  anchor: number;
  top: number;
  height: number;
}>;
export type SidenoteCardBounds = Pick<SidenoteReadingTarget, "top" | "height">;

/** Keep focus retention and preview visibility based on the same full card bounds. */
export function intersectsSidenoteRange(
  { top, height }: SidenoteCardBounds,
  rangeStart: number,
  rangeEnd: number
): boolean {
  return rangeEnd > rangeStart && top + height >= rangeStart && top <= rangeEnd;
}
