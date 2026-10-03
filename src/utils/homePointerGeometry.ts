export type PointerPoint = { x: number; y: number };
export type PointerBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type RectLike = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

export function boundsFromRects(
  rects: readonly RectLike[]
): PointerBounds | null {
  const visibleRects = rects.filter(
    rect => rect.right > rect.left && rect.bottom > rect.top
  );
  if (visibleRects.length === 0) return null;

  return visibleRects.reduce<PointerBounds>(
    (bounds, rect) => ({
      left: Math.min(bounds.left, rect.left),
      top: Math.min(bounds.top, rect.top),
      right: Math.max(bounds.right, rect.right),
      bottom: Math.max(bounds.bottom, rect.bottom),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    }
  );
}

export function expandBounds(
  bounds: PointerBounds,
  padding: number
): PointerBounds {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.right + padding,
    bottom: bounds.bottom + padding,
  };
}

export function containsPoint(
  point: PointerPoint,
  bounds: PointerBounds
): boolean {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
}

export function closestBoundaryPoint(
  origin: PointerPoint,
  bounds: PointerBounds
): PointerPoint {
  const nearestPoint = {
    x: Math.min(Math.max(origin.x, bounds.left), bounds.right),
    y: Math.min(Math.max(origin.y, bounds.top), bounds.bottom),
  };
  if (!containsPoint(origin, bounds)) return nearestPoint;

  const candidates = [
    { x: origin.x, y: bounds.top },
    { x: bounds.right, y: origin.y },
    { x: origin.x, y: bounds.bottom },
    { x: bounds.left, y: origin.y },
  ];
  return candidates.reduce((best, candidate) =>
    Math.hypot(candidate.x - origin.x, candidate.y - origin.y) <
    Math.hypot(best.x - origin.x, best.y - origin.y)
      ? candidate
      : best
  );
}

export function boundsCenter(bounds: PointerBounds): PointerPoint {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}
