import type { HomePointerParticles } from "./homePointerParticles";
import type { ParticleCompletion } from "./homePointerParticles";
import type { HomePointerHighlight } from "./homePointerHighlight";
import type { HomePointerTargets } from "./homePointerTargets";
import {
  particleTravelDuration,
  samplePointerParticles,
} from "@/utils/homePointerSampling";
import type { PointerPoint } from "@/utils/homePointerGeometry";

const ARRIVAL_MIN_DURATION_MS = 100;
const ARRIVAL_MIN_SPEED_PX_PER_MS = 0.42;
const ARRIVAL_STAGGER_MS = 22;
const ARRIVAL_MAX_DELAY_MS = 110;
const GATHER_MIN_DURATION_MS = 140;
const GATHER_MIN_SPEED_PX_PER_MS = 0.48;
const GATHER_STAGGER_MS = 18;
const GATHER_MAX_DELAY_MS = 90;
const TARGET_PADDING = 18;
const DEFAULT_GLOW_SIZE = 36;
const MERGED_GLOW_SIZE = 3;

export type HomePointerEffectState =
  | "inactive"
  | "following"
  | "approaching"
  | "dispersing"
  | "merged"
  | "gathering"
  | "departing";
type TransitionMotionPort = {
  pointerPosition(): PointerPoint;
  glowPosition(): PointerPoint;
  glowVelocity(): PointerPoint;
  setGlowTarget(point: PointerPoint): void;
  beginApproach(points: { origin: PointerPoint; target: PointerPoint }): void;
  retargetApproach(target: PointerPoint): void;
  snapGlowToPointer(): void;
  scheduleFrame(): void;
};

type TransitionSession = {
  target: HTMLElement;
  particleOwner: object;
};

type GatheringRound = {
  session: TransitionSession;
};

type HomePointerTransitionsOptions = {
  glow: HTMLSpanElement;
  pointer: HTMLSpanElement;
  targets: HomePointerTargets;
  highlight: HomePointerHighlight;
  particles: HomePointerParticles;
  motion: TransitionMotionPort;
};

export type HomePointerTransitionController = {
  readonly state: HomePointerEffectState;
  readonly currentTarget: HTMLElement | null;
  setHoveredTarget(target: HTMLElement | null): void;
  refreshTargetGeometry(target: HTMLElement | null): void;
  refreshTargetContent(target: HTMLElement | null): void;
  disperseIntoText(origin: PointerPoint): void;
  enterTextMode(): void;
  followPointer(): void;
  deactivate(): void;
};

/** Owns effect phases and particle handoff while delegating pointer geometry to the controller. */
export function createHomePointerTransitions({
  glow,
  pointer,
  targets,
  highlight,
  particles,
  motion,
}: HomePointerTransitionsOptions): HomePointerTransitionController {
  let state: HomePointerEffectState = "inactive";
  let hoveredTarget: HTMLElement | null = null;
  let activeSession: TransitionSession | null = null;
  let gatheringRound: GatheringRound | null = null;

  function createSession(
    target: HTMLElement,
    particleOwner: object = {}
  ): TransitionSession {
    return { target, particleOwner };
  }

  function setGlowSize(size: number): void {
    glow.style.width = `${size}px`;
    glow.style.height = `${size}px`;
  }

  // Following drives interpolation in JS but has no matching CSS state rule.
  function setState(nextState: HomePointerEffectState): void {
    state = nextState;
    if (nextState === "inactive" || nextState === "following") {
      glow.removeAttribute("data-state");
    } else {
      glow.dataset.state = nextState;
    }
  }

  function finishArrival(session: TransitionSession): void {
    if (activeSession !== session || hoveredTarget !== session.target) return;
    const { target } = session;
    highlight.setPhase(target, "merged");
    setState("merged");
    setGlowSize(MERGED_GLOW_SIZE);
  }

  function disperseIntoText(target: HTMLElement, origin: PointerPoint): void {
    const session = activeSession;
    if (!session || session.target !== target) return;
    const anchors = samplePointerParticles(targets.destinations(target)).sort(
      (a, b) =>
        Math.hypot(a.point.x - origin.x, a.point.y - origin.y) -
        Math.hypot(b.point.x - origin.x, b.point.y - origin.y)
    );
    highlight.setAnchors(target, anchors);
    highlight.setPhase(target, "dispersing");
    setState("dispersing");
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
          if (activeSession !== session || hoveredTarget !== target) return;
          if (completion === "arrived")
            highlight.markArrived(target, anchor.anchorIndex);
          remaining -= 1;
          if (remaining === 0) finishArrival(session);
        },
        owner: session.particleOwner,
        anchorIndex: anchor.anchorIndex,
        glyph: anchor.glyph,
        initialVelocity: motion.glowVelocity(),
      });
    });
  }

  function abandonGatheringRound(): void {
    if (!gatheringRound) return;
    particles.cancelOwner(gatheringRound.session.particleOwner);
    highlight.clearTarget(gatheringRound.session.target);
    gatheringRound = null;
  }

  function beginApproach(target: HTMLElement): void {
    targets.prepare(target);

    const round = gatheringRound;
    const reversingGather = round && state === "gathering";
    if (reversingGather && round) {
      const destinations = targets.destinations(target);
      const previousTarget = round.session.target;
      const previousAnchors = highlight.getAnchors(previousTarget);
      // Keep anchor indices stable so each returning particle can change direction in place.
      const anchors = samplePointerParticles(
        destinations,
        previousAnchors.length > 0
          ? {
              min: previousAnchors.length,
              max: previousAnchors.length,
              glyphsPerParticle: 1,
            }
          : undefined
      );
      if (previousTarget !== target) highlight.clearTarget(previousTarget);
      const session = createSession(target, round.session.particleOwner);
      activeSession = session;
      gatheringRound = null;
      highlight.setAnchors(target, anchors);
      highlight.setPhase(target, "dispersing");
      glow.dataset.mode = "entry";
      setState("dispersing");
      setGlowSize(MERGED_GLOW_SIZE);

      const anchorsByIndex = new Map(
        anchors.map(anchor => [anchor.anchorIndex, anchor])
      );
      let remaining = 0;

      const onAnchorComplete = (
        anchorIndex: number,
        completion: ParticleCompletion
      ): void => {
        if (activeSession !== session || hoveredTarget !== target) return;
        if (completion === "arrived")
          highlight.markArrived(target, anchorIndex);
        remaining -= 1;
        if (remaining === 0) finishArrival(session);
      };
      const retargetedAnchors = particles.retargetOwner({
        owner: session.particleOwner,
        getTarget: anchorIndex => {
          const anchor = anchorsByIndex.get(anchorIndex);
          return (
            anchor?.point ??
            targets.boundaryPoint(target, motion.pointerPosition(), 0)
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
      // Missing return motions have already converged or been evicted; resume from the gather point.
      const missingAnchorOrigin = motion.pointerPosition();

      missingAnchors.forEach((anchor, index) => {
        const destinationPoint = anchor.point;
        particles.track({
          start: missingAnchorOrigin,
          getTarget: () => destinationPoint,
          options: {
            duration: particleTravelDuration({
              from: missingAnchorOrigin,
              to: destinationPoint,
              particleIndex: anchor.anchorIndex,
              minimumDurationMs: ARRIVAL_MIN_DURATION_MS,
              minimumSpeedPxPerMs: ARRIVAL_MIN_SPEED_PX_PER_MS,
            }),
            delay: Math.min(index * ARRIVAL_STAGGER_MS, ARRIVAL_MAX_DELAY_MS),
          },
          onComplete: completion =>
            onAnchorComplete(anchor.anchorIndex, completion),
          owner: session.particleOwner,
          anchorIndex: anchor.anchorIndex,
          glyph: anchor.glyph,
        });
      });

      if (remaining === 0) finishArrival(session);
      return;
    }

    if (gatheringRound) abandonGatheringRound();
    const session = createSession(target);
    activeSession = session;

    const origin = motion.glowPosition();
    const destination = targets.boundaryPoint(
      target,
      motion.pointerPosition(),
      TARGET_PADDING
    );
    glow.dataset.mode = "entry";
    setState("approaching");
    setGlowSize(DEFAULT_GLOW_SIZE);
    highlight.setPhase(target, "approaching");
    motion.beginApproach({ origin, target: destination });
  }

  function finishGather(round: GatheringRound): void {
    if (gatheringRound !== round || hoveredTarget === round.session.target)
      return;
    highlight.clearTarget(round.session.target);
    gatheringRound = null;
    // Re-form the hidden halo where the gathered particles have returned.
    motion.snapGlowToPointer();
    setState("departing");
    setGlowSize(DEFAULT_GLOW_SIZE);
    motion.scheduleFrame();
  }

  function gatherFromText(target: HTMLElement): void {
    const session = activeSession;
    if (!session || session.target !== target) return;

    activeSession = null;
    const round: GatheringRound = { session };
    const anchors = highlight.getArrivedAnchors(target);
    gatheringRound = round;
    motion.setGlowTarget(motion.pointerPosition());
    // Drop whole-control merged styling while individual glyphs retract.
    highlight.setPhase(target, "departing");
    glow.removeAttribute("data-mode");
    setState("gathering");
    setGlowSize(MERGED_GLOW_SIZE);

    let remaining = 0;
    const completeReturn = (): void => {
      if (gatheringRound !== round) return;
      remaining -= 1;
      if (remaining === 0) finishGather(round);
    };

    const returningInFlight = particles.retargetOwner({
      owner: session.particleOwner,
      getTarget: motion.pointerPosition,
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
    const pointerPosition = motion.pointerPosition();
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
      finishGather(round);
      return;
    }

    arrivedSources.forEach((anchor, index) => {
      const delay = Math.min(index * GATHER_STAGGER_MS, GATHER_MAX_DELAY_MS);
      particles.track({
        start: anchor.point,
        getTarget: motion.pointerPosition,
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
        owner: session.particleOwner,
        anchorIndex: anchor.anchorIndex,
        glyph: anchor.glyph,
      });
    });
  }

  function refreshActiveGeometry(
    target: HTMLElement,
    session: TransitionSession
  ): boolean {
    if (state === "approaching") {
      motion.retargetApproach(
        targets.boundaryPoint(target, motion.pointerPosition(), TARGET_PADDING)
      );
      return true;
    }

    if (state !== "dispersing" && state !== "merged") return true;

    const anchors = highlight.updateAnchorDestinations(
      target,
      targets.destinations(
        target,
        new Set(highlight.getAnchors(target).map(anchor => anchor.glyphIndex))
      )
    );
    if (!anchors) return false;
    if (state !== "dispersing") return true;

    const anchorsByIndex = new Map(
      anchors.map(anchor => [anchor.anchorIndex, anchor])
    );
    particles.retargetOwner({
      owner: session.particleOwner,
      getTarget: anchorIndex =>
        anchorsByIndex.get(anchorIndex)?.point ??
        targets.boundaryPoint(target, motion.pointerPosition(), 0),
      duration: (anchorIndex, start, end) =>
        particleTravelDuration({
          from: start,
          to: end,
          particleIndex: anchorIndex,
          minimumDurationMs: ARRIVAL_MIN_DURATION_MS,
          minimumSpeedPxPerMs: ARRIVAL_MIN_SPEED_PX_PER_MS,
        }),
    });
    return true;
  }

  function refreshTargetGeometry(nextTarget: HTMLElement | null): void {
    if (
      hoveredTarget &&
      activeSession &&
      !refreshActiveGeometry(hoveredTarget, activeSession)
    ) {
      refreshTargetContent(nextTarget);
      return;
    }

    if (hoveredTarget !== nextTarget) setHoveredTarget(nextTarget);
  }

  function refreshTargetContent(nextTarget: HTMLElement | null): void {
    const owners = new Set<object>();
    const staleTargets = new Set<HTMLElement>();
    if (activeSession) {
      owners.add(activeSession.particleOwner);
      staleTargets.add(activeSession.target);
    }
    if (gatheringRound) {
      owners.add(gatheringRound.session.particleOwner);
      staleTargets.add(gatheringRound.session.target);
    }
    if (hoveredTarget) staleTargets.add(hoveredTarget);

    owners.forEach(owner => particles.cancelOwner(owner));
    staleTargets.forEach(target => highlight.clearTarget(target));
    activeSession = null;
    gatheringRound = null;
    hoveredTarget = null;
    pointer.removeAttribute("data-mode");
    glow.removeAttribute("data-mode");
    setGlowSize(DEFAULT_GLOW_SIZE);
    setState("following");
    motion.setGlowTarget(motion.pointerPosition());

    if (nextTarget) setHoveredTarget(nextTarget);
  }

  function setHoveredTarget(next: HTMLElement | null): void {
    if (hoveredTarget === next) {
      if (next) {
        pointer.dataset.mode = "entry";
      } else {
        pointer.removeAttribute("data-mode");
      }
      return;
    }

    const previous = hoveredTarget;
    hoveredTarget = next;

    if (previous) {
      if (state === "merged" || state === "dispersing") {
        gatherFromText(previous);
      } else {
        if (activeSession?.target === previous) activeSession = null;
        highlight.clearTarget(previous);
        glow.removeAttribute("data-mode");
        setState("following");
        motion.setGlowTarget(motion.pointerPosition());
      }
    }

    if (next) {
      pointer.dataset.mode = "entry";
      beginApproach(next);
      return;
    }

    pointer.removeAttribute("data-mode");
    if (!previous) {
      glow.removeAttribute("data-mode");
      if (state !== "gathering") {
        setState("following");
        motion.setGlowTarget(motion.pointerPosition());
      }
    }
  }

  function enterTextMode(): void {
    pointer.dataset.mode = "text";
    glow.dataset.mode = "text";
    // Text-cursor styling should not cancel an in-progress particle return.
    if (state !== "gathering") setState("following");
    motion.setGlowTarget(motion.pointerPosition());
  }

  function followPointer(): void {
    motion.setGlowTarget(motion.pointerPosition());
    if (state === "gathering") return;
    glow.removeAttribute("data-mode");
    if (state !== "following") setState("following");
  }

  function disperseAtPointer(origin: PointerPoint): void {
    if (hoveredTarget) disperseIntoText(hoveredTarget, origin);
  }

  function deactivate(): void {
    particles.cancel();
    setGlowSize(DEFAULT_GLOW_SIZE);
    if (hoveredTarget) highlight.clearTarget(hoveredTarget);
    if (activeSession) highlight.clearTarget(activeSession.target);
    if (gatheringRound) highlight.clearTarget(gatheringRound.session.target);
    highlight.clearAll();
    hoveredTarget = null;
    activeSession = null;
    gatheringRound = null;
    glow.removeAttribute("data-mode");
    setState("inactive");
  }

  return {
    get state() {
      return state;
    },
    get currentTarget() {
      return hoveredTarget;
    },
    setHoveredTarget,
    refreshTargetGeometry,
    refreshTargetContent,
    disperseIntoText: disperseAtPointer,
    enterTextMode,
    followPointer,
    deactivate,
  };
}
