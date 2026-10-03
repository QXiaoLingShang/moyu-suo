import { HomePointerParticles } from "./homePointerParticles";
import { HomePointerHighlight } from "./homePointerHighlight";
import { HomePointerTargets } from "./homePointerTargets";
import type { ParticleCompletion } from "./homePointerParticles";
import {
  particleTravelDuration,
  samplePointerParticles,
} from "@/utils/homePointerSampling";
import { containsPoint, type PointerPoint } from "@/utils/homePointerGeometry";

const INTERACTIVE_TARGETS =
  "a[href], button:not(:disabled), input, textarea, select, summary, [role='button'], .home-entrance[data-key]";
const FOLLOW_TIME_MS = 70;
const APPROACH_DURATION_MS = 120;
const PARTICLE_SPLIT_PROGRESS = 0.42;
const ARRIVAL_MIN_DURATION_MS = 100;
const ARRIVAL_MIN_SPEED_PX_PER_MS = 0.42;
const ARRIVAL_STAGGER_MS = 22;
const ARRIVAL_MAX_DELAY_MS = 110;
const GATHER_MIN_DURATION_MS = 140;
const GATHER_MIN_SPEED_PX_PER_MS = 0.48;
const GATHER_STAGGER_MS = 18;
const GATHER_MAX_DELAY_MS = 90;
const TARGET_PADDING = 18;
const TARGET_HIT_SLOP = 16;
const DEFAULT_GLOW_SIZE = 36;
const MERGED_GLOW_SIZE = 3;

type EffectState =
  | "inactive"
  | "following"
  | "approaching"
  | "dispersing"
  | "merged"
  | "gathering"
  | "departing";
type PointerState = Exclude<EffectState, "inactive">;

function createPointerLayer(): {
  layer: HTMLDivElement;
  glow: HTMLSpanElement;
  pointer: HTMLSpanElement;
} {
  const layer = document.createElement("div");
  layer.className = "home-effects-layer home-pointer-layer";
  layer.setAttribute("aria-hidden", "true");

  const glow = document.createElement("span");
  glow.className = "home-pointer-glow";

  const pointer = document.createElement("span");
  pointer.className = "home-pointer";

  layer.append(glow, pointer);
  document.body.append(layer);
  return { layer, glow, pointer };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Split the visible control label into hit points without changing its spoken text. */
export function setupHomePointer(): () => void {
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { layer, glow, pointer } = createPointerLayer();
  const controller = new AbortController();
  const { signal } = controller;

  const targets = new HomePointerTargets();
  const highlight = new HomePointerHighlight(targets);
  const particles = new HomePointerParticles(layer);
  let pointerPosition: PointerPoint = { x: 0, y: 0 };
  let glowPosition: PointerPoint = { x: 0, y: 0 };
  let glowVelocity: PointerPoint = { x: 0, y: 0 };
  let glowTarget: PointerPoint = { x: 0, y: 0 };
  let approachOrigin: PointerPoint = { x: 0, y: 0 };
  let approachStartedAt = 0;
  let hoveredElement: HTMLElement | null = null;
  let gatheringTarget: HTMLElement | null = null;
  let glowState: EffectState = "inactive";
  let frame: number | undefined;
  let targetRefreshFrame: number | undefined;
  let lastFrameTime = 0;

  function setGlowSize(size: number): void {
    glow.style.width = `${size}px`;
    glow.style.height = `${size}px`;
  }

  // The DOM attributes drive CSS only; animation decisions use this typed state.
  function setEffectState(
    nextGlowState: EffectState,
    nextPointerState?: PointerState
  ): void {
    glowState = nextGlowState;
    if (nextGlowState === "inactive") {
      glow.removeAttribute("data-state");
    } else {
      glow.dataset.state = nextGlowState;
    }

    const pointerState =
      nextPointerState ??
      (nextGlowState === "inactive" ? undefined : nextGlowState);
    if (pointerState) {
      pointer.dataset.state = pointerState;
    } else {
      pointer.removeAttribute("data-state");
    }
  }

  function finishArrival(target: HTMLElement): void {
    if (hoveredElement !== target) return;
    highlight.setPhase(target, "merged");
    setEffectState("merged");
    setGlowSize(MERGED_GLOW_SIZE);
  }

  function disperseIntoText(target: HTMLElement, origin: PointerPoint): void {
    const anchors = samplePointerParticles(targets.destinations(target)).sort(
      (a, b) =>
        Math.hypot(a.point.x - origin.x, a.point.y - origin.y) -
        Math.hypot(b.point.x - origin.x, b.point.y - origin.y)
    );
    highlight.setAnchors(target, anchors);
    highlight.setPhase(target, "dispersing");
    setEffectState("dispersing");
    setGlowSize(MERGED_GLOW_SIZE);

    let remaining = anchors.length;
    anchors.forEach((anchor, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(anchors.length, 1);
      const start = {
        x: origin.x + Math.cos(angle) * 3.5,
        y: origin.y + Math.sin(angle) * 3.5,
      };
      particles.travel({
        start,
        end: anchor.point,
        options: {
          duration: particleTravelDuration({
            from: start,
            to: anchor.point,
            particleIndex: anchor.anchorIndex,
            minimumDurationMs: ARRIVAL_MIN_DURATION_MS,
            minimumSpeedPxPerMs: ARRIVAL_MIN_SPEED_PX_PER_MS,
          }),
          delay: Math.min(index * ARRIVAL_STAGGER_MS, ARRIVAL_MAX_DELAY_MS),
        },
        onComplete: completion => {
          if (hoveredElement !== target) return;
          if (completion === "arrived")
            highlight.markArrived(target, anchor.anchorIndex);
          remaining -= 1;
          if (remaining === 0) finishArrival(target);
        },
        owner: target,
        anchorIndex: anchor.anchorIndex,
        glyph: anchor.glyph,
        initialVelocity: glowVelocity,
      });
    });
  }

  function beginApproach(target: HTMLElement): void {
    targets.prepare(target);

    const reversingGather =
      gatheringTarget === target && glowState === "gathering";
    if (reversingGather) {
      const destinations = targets.destinations(target);
      const points = new Map(
        destinations.map(destination => [
          destination.glyphIndex,
          destination.point,
        ])
      );
      const anchors = highlight.getAnchors(target);
      const anchorsByIndex = new Map(
        anchors.map(anchor => [anchor.anchorIndex, anchor])
      );
      highlight.resetArrived(target);
      let remaining = 0;

      gatheringTarget = null;
      highlight.setPhase(target, "dispersing");
      glow.dataset.mode = "entry";
      setEffectState("dispersing");
      setGlowSize(MERGED_GLOW_SIZE);

      const onAnchorComplete = (
        anchorIndex: number,
        completion: ParticleCompletion
      ): void => {
        if (hoveredElement !== target) return;
        if (completion === "arrived")
          highlight.markArrived(target, anchorIndex);
        remaining -= 1;
        if (remaining === 0) finishArrival(target);
      };
      const retargetedAnchors = particles.retargetOwner({
        owner: target,
        getTarget: anchorIndex => {
          const anchor = anchorsByIndex.get(anchorIndex);
          return (
            (anchor && points.get(anchor.glyphIndex)) ??
            targets.boundaryPoint(target, pointerPosition, 0)
          );
        },
        duration: (anchorIndex, start, end) =>
          particleTravelDuration({
            from: start,
            to: end,
            particleIndex: anchorIndex,
            minimumDurationMs: ARRIVAL_MIN_DURATION_MS,
            minimumSpeedPxPerMs: ARRIVAL_MIN_SPEED_PX_PER_MS,
          }),
        onComplete: (anchorIndex, _glyph, completion) =>
          onAnchorComplete(anchorIndex, completion),
      });
      const missingAnchors = anchors.filter(
        anchor => !retargetedAnchors.has(anchor.anchorIndex)
      );
      remaining = retargetedAnchors.size + missingAnchors.length;

      missingAnchors.forEach((anchor, index) => {
        const destinationPoint = points.get(anchor.glyphIndex) ?? anchor.point;
        particles.track({
          start: pointerPosition,
          getTarget: () => destinationPoint,
          options: {
            duration: particleTravelDuration({
              from: pointerPosition,
              to: destinationPoint,
              particleIndex: anchor.anchorIndex,
              minimumDurationMs: ARRIVAL_MIN_DURATION_MS,
              minimumSpeedPxPerMs: ARRIVAL_MIN_SPEED_PX_PER_MS,
            }),
            delay: Math.min(index * ARRIVAL_STAGGER_MS, ARRIVAL_MAX_DELAY_MS),
          },
          onComplete: completion =>
            onAnchorComplete(anchor.anchorIndex, completion),
          owner: target,
          anchorIndex: anchor.anchorIndex,
          glyph: anchor.glyph,
        });
      });

      if (remaining === 0) finishArrival(target);
      return;
    } else if (gatheringTarget && gatheringTarget !== target) {
      highlight.clearTarget(gatheringTarget);
      gatheringTarget = null;
    }

    approachOrigin = glowPosition;
    approachStartedAt = performance.now();
    glowTarget = targets.boundaryPoint(target, pointerPosition, TARGET_PADDING);
    glow.dataset.mode = "entry";
    setEffectState("approaching");
    setGlowSize(DEFAULT_GLOW_SIZE);
    highlight.setPhase(target, "approaching");
    scheduleFrame();
  }

  function finishGather(target: HTMLElement): void {
    if (gatheringTarget !== target || hoveredElement === target) return;
    highlight.clearTarget(target);
    gatheringTarget = null;
    setEffectState("departing", "following");
    glowPosition = pointerPosition;
    glowVelocity = { x: 0, y: 0 };
    glowTarget = pointerPosition;
    setGlowSize(DEFAULT_GLOW_SIZE);
    glow.style.transform = `translate3d(${glowPosition.x}px, ${glowPosition.y}px, 0) translate(-50%, -50%)`;
    scheduleFrame();
  }

  function gatherFromText(target: HTMLElement): void {
    const anchors = highlight.getArrivedAnchors(target);
    gatheringTarget = target;
    highlight.setPhase(target, "departing");
    glow.dataset.mode = "moon";
    setEffectState("gathering");
    setGlowSize(MERGED_GLOW_SIZE);

    let remaining = 0;
    const completeReturn = (): void => {
      remaining -= 1;
      if (remaining === 0) finishGather(target);
    };

    const returningInFlight = particles.retargetOwner({
      owner: target,
      getTarget: () => pointerPosition,
      duration: (anchorIndex, start, end) =>
        particleTravelDuration({
          from: start,
          to: end,
          particleIndex: anchorIndex,
          minimumDurationMs: GATHER_MIN_DURATION_MS,
          minimumSpeedPxPerMs: GATHER_MIN_SPEED_PX_PER_MS,
        }),
      onComplete: () => completeReturn(),
    });
    const arrivedSources = anchors
      .filter(anchor => !returningInFlight.has(anchor.anchorIndex))
      .sort(
        (a, b) =>
          Math.hypot(
            a.point.x - pointerPosition.x,
            a.point.y - pointerPosition.y
          ) -
          Math.hypot(
            b.point.x - pointerPosition.x,
            b.point.y - pointerPosition.y
          )
      );
    const departureOrder = new Map(
      arrivedSources.map((anchor, index) => [anchor.anchorIndex, index])
    );
    remaining = returningInFlight.size + arrivedSources.length;
    highlight.retract(target, departureOrder, GATHER_STAGGER_MS);

    if (remaining === 0) {
      finishGather(target);
      return;
    }

    arrivedSources.forEach((anchor, index) => {
      const delay = Math.min(index * GATHER_STAGGER_MS, GATHER_MAX_DELAY_MS);
      particles.track({
        start: anchor.point,
        getTarget: () => pointerPosition,
        options: {
          duration: particleTravelDuration({
            from: anchor.point,
            to: pointerPosition,
            particleIndex: anchor.anchorIndex,
            minimumDurationMs: GATHER_MIN_DURATION_MS,
            minimumSpeedPxPerMs: GATHER_MIN_SPEED_PX_PER_MS,
          }),
          delay,
        },
        onComplete: completeReturn,
        owner: target,
        anchorIndex: anchor.anchorIndex,
        glyph: anchor.glyph,
      });
    });
  }

  function isNearCurrentTarget(
    target: HTMLElement,
    point: PointerPoint
  ): boolean {
    return containsPoint(
      point,
      targets.expandedBounds(target, TARGET_HIT_SLOP)
    );
  }

  function resolveHoveredElement(
    source: EventTarget | null
  ): HTMLElement | null {
    if (!(source instanceof Element)) return null;
    const target = source.closest<HTMLElement>(INTERACTIVE_TARGETS);
    if (!target || target.matches("[disabled]")) return null;
    return target.closest<HTMLElement>(".home-entrance[data-key]") ?? target;
  }

  function scheduleFrame(): void {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(animate);
  }

  function animate(time: number): void {
    const elapsed =
      lastFrameTime === 0 ? 16 : Math.min(time - lastFrameTime, 40);
    lastFrameTime = time;
    const previousGlowPosition = glowPosition;
    let shouldSplit = false;

    if (glowState === "approaching") {
      const progress = clamp(
        (time - approachStartedAt) / APPROACH_DURATION_MS,
        0,
        1
      );
      const easeOut = 1 - (1 - progress) ** 3;
      glowPosition = {
        x: approachOrigin.x + (glowTarget.x - approachOrigin.x) * easeOut,
        y: approachOrigin.y + (glowTarget.y - approachOrigin.y) * easeOut,
      };

      shouldSplit =
        progress >= PARTICLE_SPLIT_PROGRESS && Boolean(hoveredElement);
    } else if (glowState === "following" || glowState === "departing") {
      const follow = 1 - Math.exp(-elapsed / FOLLOW_TIME_MS);
      glowPosition = {
        x: glowPosition.x + (glowTarget.x - glowPosition.x) * follow,
        y: glowPosition.y + (glowTarget.y - glowPosition.y) * follow,
      };
    }

    if (elapsed > 0) {
      glowVelocity = {
        x: (glowPosition.x - previousGlowPosition.x) / elapsed,
        y: (glowPosition.y - previousGlowPosition.y) / elapsed,
      };
    }
    if (shouldSplit && hoveredElement) {
      disperseIntoText(hoveredElement, glowPosition);
    }

    pointer.style.transform = `translate3d(${pointerPosition.x}px, ${pointerPosition.y}px, 0) translate(-50%, -50%)`;
    glow.style.transform = `translate3d(${glowPosition.x}px, ${glowPosition.y}px, 0) translate(-50%, -50%)`;

    const remaining = Math.hypot(
      glowTarget.x - glowPosition.x,
      glowTarget.y - glowPosition.y
    );
    if (
      glowState === "approaching" ||
      ((glowState === "following" || glowState === "departing") &&
        remaining > 0.4)
    ) {
      frame = window.requestAnimationFrame(animate);
    } else {
      frame = undefined;
      lastFrameTime = 0;
    }
  }

  function setHoveredElement(next: HTMLElement | null): void {
    if (hoveredElement === next) return;

    const previous = hoveredElement;
    hoveredElement = next;

    if (previous) {
      if (glowState === "merged" || glowState === "dispersing") {
        gatherFromText(previous);
      } else {
        highlight.clearTarget(previous);
        glow.dataset.mode = "moon";
        setEffectState("following");
        glowTarget = pointerPosition;
      }
    }

    if (next) {
      pointer.dataset.mode = "entry";
      beginApproach(next);
      return;
    }

    pointer.dataset.mode = "moon";
    if (!previous) {
      glow.dataset.mode = "moon";
      if (glowState !== "gathering") {
        setEffectState("following");
        glowTarget = pointerPosition;
      }
    }
  }

  function updatePointer(event: PointerEvent): void {
    if (event.pointerType !== "mouse") {
      deactivate();
      return;
    }
    if (!finePointer.matches || reducedMotion.matches) return;

    pointerPosition = { x: event.clientX, y: event.clientY };
    if (!pointer.hasAttribute("data-active")) {
      glowPosition = pointerPosition;
      glowVelocity = { x: 0, y: 0 };
      glowTarget = pointerPosition;
    }
    pointer.dataset.active = "true";
    glow.dataset.active = "true";
    root.setAttribute("data-home-cursor-active", "true");

    const textInput =
      event.target instanceof Element &&
      event.target.closest("input, textarea, [contenteditable='true']");
    let nextTarget = resolveHoveredElement(event.target);
    if (
      !nextTarget &&
      hoveredElement &&
      isNearCurrentTarget(hoveredElement, pointerPosition)
    ) {
      nextTarget = hoveredElement;
    }
    if (!nextTarget) {
      nextTarget = targets.findExpandedEntrance(
        pointerPosition,
        TARGET_HIT_SLOP
      );
    }

    if (textInput) {
      pointer.dataset.mode = "text";
      if (hoveredElement) setHoveredElement(null);
      glow.dataset.mode = "text";
      setEffectState("following");
      glowTarget = pointerPosition;
      scheduleFrame();
      return;
    }

    pointer.dataset.mode = nextTarget ? "entry" : "moon";
    setHoveredElement(nextTarget);
    if (!nextTarget && glowState !== "gathering") {
      glow.dataset.mode = "moon";
      glowTarget = pointerPosition;
      if (glowState !== "following") {
        setEffectState("following");
      }
    }
    scheduleFrame();
  }

  function refreshTargetAtPointer(): void {
    if (!pointer.hasAttribute("data-active")) return;
    const element = document.elementFromPoint(
      pointerPosition.x,
      pointerPosition.y
    );
    let nextTarget = resolveHoveredElement(element);
    if (
      !nextTarget &&
      hoveredElement &&
      isNearCurrentTarget(hoveredElement, pointerPosition)
    ) {
      nextTarget = hoveredElement;
    }
    if (!nextTarget) {
      nextTarget = targets.findExpandedEntrance(
        pointerPosition,
        TARGET_HIT_SLOP
      );
    }
    pointer.dataset.mode = nextTarget ? "entry" : "moon";
    setHoveredElement(nextTarget);
    scheduleFrame();
  }

  function refreshTextBounds(): void {
    if (targetRefreshFrame !== undefined) return;
    targetRefreshFrame = window.requestAnimationFrame(() => {
      targetRefreshFrame = undefined;
      targets.invalidate();
      refreshTargetAtPointer();
    });
  }

  const languageObserver = new MutationObserver(refreshTextBounds);
  languageObserver.observe(root, {
    attributes: true,
    attributeFilter: ["lang"],
  });

  function deactivate(): void {
    root.removeAttribute("data-home-cursor-active");
    pointer.removeAttribute("data-active");
    pointer.removeAttribute("data-mode");
    glow.removeAttribute("data-active");
    particles.cancel();
    setGlowSize(DEFAULT_GLOW_SIZE);
    if (hoveredElement) highlight.clearTarget(hoveredElement);
    if (gatheringTarget) highlight.clearTarget(gatheringTarget);
    highlight.clearAll();
    hoveredElement = null;
    gatheringTarget = null;
    glowVelocity = { x: 0, y: 0 };
    glow.removeAttribute("data-mode");
    setEffectState("inactive");
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    lastFrameTime = 0;
  }

  function syncPreferences(): void {
    if (!finePointer.matches || reducedMotion.matches) deactivate();
  }

  window.addEventListener("pointermove", updatePointer, { signal });
  window.addEventListener("pointerleave", deactivate, { signal });
  window.addEventListener("blur", deactivate, { signal });
  window.addEventListener("scroll", refreshTextBounds, {
    signal,
    passive: true,
  });
  window.addEventListener("resize", refreshTextBounds, { signal });
  document.fonts.addEventListener("loadingdone", refreshTextBounds, { signal });
  finePointer.addEventListener("change", syncPreferences, { signal });
  reducedMotion.addEventListener("change", syncPreferences, { signal });

  return () => {
    deactivate();
    languageObserver.disconnect();
    if (targetRefreshFrame !== undefined)
      window.cancelAnimationFrame(targetRefreshFrame);
    controller.abort();
    layer.remove();
  };
}
