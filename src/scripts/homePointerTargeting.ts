import { containsPoint, type PointerPoint } from "@/utils/homePointerGeometry";
import type { HomePointerTargets } from "./homePointerTargets";

const INTERACTIVE_TARGETS =
  "a[href], button:not(:disabled), input, textarea, select, summary, [role='button'], .home-entrance[data-key]";
const TARGET_HIT_SLOP = 16;

type ResolveHomePointerTargetOptions = {
  source: EventTarget | null;
  point: PointerPoint;
  currentTarget: HTMLElement | null;
  targets: HomePointerTargets;
};

/** Resolve direct hits first, then retain a near target, then use entrance geometry. */
export function resolveHomePointerTarget({
  source,
  point,
  currentTarget,
  targets,
}: ResolveHomePointerTargetOptions): HTMLElement | null {
  const directTarget = resolveInteractiveTarget(source);
  if (directTarget) return directTarget;

  if (
    currentTarget &&
    containsPoint(point, targets.expandedBounds(currentTarget, TARGET_HIT_SLOP))
  ) {
    return currentTarget;
  }

  return targets.findExpandedEntrance(point, TARGET_HIT_SLOP);
}

function resolveInteractiveTarget(
  source: EventTarget | null
): HTMLElement | null {
  if (!(source instanceof Element)) return null;
  const target = source.closest<HTMLElement>(INTERACTIVE_TARGETS);
  if (!target || target.matches("[disabled]")) return null;
  return target.closest<HTMLElement>(".home-entrance[data-key]") ?? target;
}
