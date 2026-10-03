import type { HomePointerParticles } from "./homePointerParticles";
import type { HomePointerHighlight } from "./homePointerHighlight";
import type { HomePointerTargets } from "./homePointerTargets";
import { resolveHomePointerTarget } from "./homePointerTargeting";
import { createHomePointerTransitions } from "./homePointerTransitions";
import type { PointerPoint } from "@/utils/homePointerGeometry";

const FOLLOW_TIME_MS = 70;
const APPROACH_DURATION_MS = 120;
const PARTICLE_SPLIT_PROGRESS = 0.42;

type HomePointerControllerOptions = {
  root: HTMLElement;
  glow: HTMLSpanElement;
  pointer: HTMLSpanElement;
  finePointer: MediaQueryList;
  reducedMotion: MediaQueryList;
  targets: HomePointerTargets;
  highlight: HomePointerHighlight;
  particles: HomePointerParticles;
};

type PendingPointerInput = {
  source: EventTarget | null;
  isTextInput: boolean;
};

export type HomePointerController = {
  updatePointer(event: PointerEvent): void;
  refreshTextBounds(): void;
  refreshTextContent(): void;
  deactivate(): void;
  syncPreferences(): void;
  destroy(): void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Coordinates pointer input and position updates; transitions own effect phases. */
export function createHomePointerController({
  root,
  glow,
  pointer,
  finePointer,
  reducedMotion,
  targets,
  highlight,
  particles,
}: HomePointerControllerOptions): HomePointerController {
  let pointerPosition: PointerPoint = { x: 0, y: 0 };
  let glowPosition: PointerPoint = { x: 0, y: 0 };
  let glowVelocity: PointerPoint = { x: 0, y: 0 };
  let glowTarget: PointerPoint = { x: 0, y: 0 };
  let approachOrigin: PointerPoint = { x: 0, y: 0 };
  let approachStartedAt = 0;
  let approachProgressAtStart = 0;
  let approachDurationMs = APPROACH_DURATION_MS;
  let frame: number | undefined;
  let lastFrameTime = 0;
  let pendingPointerInput: PendingPointerInput | undefined;
  let layoutRefreshPending = false;
  let contentRefreshPending = false;

  const transitions = createHomePointerTransitions({
    glow,
    pointer,
    targets,
    highlight,
    particles,
    motion: {
      pointerPosition: () => pointerPosition,
      glowPosition: () => glowPosition,
      glowVelocity: () => glowVelocity,
      setGlowTarget: point => {
        glowTarget = point;
      },
      beginApproach: ({ origin, target }) => {
        approachOrigin = origin;
        approachStartedAt = performance.now();
        approachProgressAtStart = 0;
        approachDurationMs = APPROACH_DURATION_MS;
        glowTarget = target;
        scheduleFrame();
      },
      retargetApproach: target => {
        const segmentProgress = clamp(
          (performance.now() - approachStartedAt) / approachDurationMs,
          0,
          1
        );
        approachProgressAtStart +=
          (1 - approachProgressAtStart) * segmentProgress;
        approachOrigin = glowPosition;
        approachStartedAt = performance.now();
        approachDurationMs = Math.max(
          1,
          APPROACH_DURATION_MS * (1 - approachProgressAtStart)
        );
        glowTarget = target;
        scheduleFrame();
      },
      snapGlowToPointer: () => {
        glowPosition = pointerPosition;
        glowVelocity = { x: 0, y: 0 };
        glowTarget = pointerPosition;
        glow.style.transform = `translate3d(${glowPosition.x}px, ${glowPosition.y}px, 0) translate(-50%, -50%)`;
      },
      scheduleFrame,
    },
  });

  function scheduleFrame(): void {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(animate);
  }

  function animate(time: number): void {
    processPendingTargetWork();

    const elapsed =
      lastFrameTime === 0 ? 16 : Math.min(time - lastFrameTime, 40);
    lastFrameTime = time;
    const previousGlowPosition = glowPosition;
    let shouldSplit = false;

    if (transitions.state === "approaching") {
      const segmentProgress = clamp(
        (time - approachStartedAt) / approachDurationMs,
        0,
        1
      );
      const progress =
        approachProgressAtStart +
        (1 - approachProgressAtStart) * segmentProgress;
      const easeOut = 1 - (1 - segmentProgress) ** 3;
      glowPosition = {
        x: approachOrigin.x + (glowTarget.x - approachOrigin.x) * easeOut,
        y: approachOrigin.y + (glowTarget.y - approachOrigin.y) * easeOut,
      };

      shouldSplit =
        progress >= PARTICLE_SPLIT_PROGRESS &&
        Boolean(transitions.currentTarget);
    } else if (
      transitions.state === "following" ||
      transitions.state === "departing"
    ) {
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
    if (shouldSplit && transitions.currentTarget) {
      transitions.disperseIntoText(glowPosition);
    }

    pointer.style.transform = `translate3d(${pointerPosition.x}px, ${pointerPosition.y}px, 0) translate(-50%, -50%)`;
    glow.style.transform = `translate3d(${glowPosition.x}px, ${glowPosition.y}px, 0) translate(-50%, -50%)`;

    const remaining = Math.hypot(
      glowTarget.x - glowPosition.x,
      glowTarget.y - glowPosition.y
    );
    if (
      transitions.state === "approaching" ||
      ((transitions.state === "following" ||
        transitions.state === "departing") &&
        remaining > 0.4)
    ) {
      frame = window.requestAnimationFrame(animate);
    } else {
      frame = undefined;
      lastFrameTime = 0;
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
    const target = event.target;
    pendingPointerInput = {
      source: target,
      isTextInput:
        target instanceof Element &&
        Boolean(target.closest("input, textarea, [contenteditable='true']")),
    };
    scheduleFrame();
  }

  function resolveTarget(
    source: EventTarget | null,
    isTextInput: boolean
  ): HTMLElement | null {
    if (isTextInput) return null;
    return resolveHomePointerTarget({
      source,
      point: pointerPosition,
      currentTarget: transitions.currentTarget,
      targets,
    });
  }

  function updateTransitionTarget(
    nextTarget: HTMLElement | null,
    isTextInput: boolean
  ): void {
    transitions.setHoveredTarget(nextTarget);
    if (isTextInput) {
      transitions.enterTextMode();
    } else if (!nextTarget) {
      transitions.followPointer();
    }
  }

  function refreshTargetAtPointer(contentChanged: boolean): void {
    if (!pointer.hasAttribute("data-active")) return;
    const element = document.elementFromPoint(
      pointerPosition.x,
      pointerPosition.y
    );
    const isTextInput =
      element instanceof Element &&
      Boolean(element.closest("input, textarea, [contenteditable='true']"));
    const nextTarget = resolveTarget(element, isTextInput);

    if (contentChanged) {
      transitions.refreshTargetContent(nextTarget);
      if (isTextInput) transitions.enterTextMode();
      else if (!nextTarget) transitions.followPointer();
      return;
    }

    transitions.refreshTargetGeometry(nextTarget);
    if (isTextInput) transitions.enterTextMode();
    else if (!nextTarget) transitions.followPointer();
  }

  function refreshTextBounds(): void {
    layoutRefreshPending = true;
    scheduleFrame();
  }

  function refreshTextContent(): void {
    layoutRefreshPending = true;
    contentRefreshPending = true;
    scheduleFrame();
  }

  function processPendingTargetWork(): void {
    if (layoutRefreshPending || contentRefreshPending) {
      const contentChanged = contentRefreshPending;
      layoutRefreshPending = false;
      contentRefreshPending = false;
      pendingPointerInput = undefined;
      targets.invalidate();
      refreshTargetAtPointer(contentChanged);
      return;
    }

    const pending = pendingPointerInput;
    pendingPointerInput = undefined;
    if (!pending) return;

    const nextTarget = resolveTarget(pending.source, pending.isTextInput);
    updateTransitionTarget(nextTarget, pending.isTextInput);
  }

  const languageObserver = new MutationObserver(refreshTextContent);
  languageObserver.observe(root, {
    attributes: true,
    attributeFilter: ["lang"],
  });

  function deactivate(): void {
    root.removeAttribute("data-home-cursor-active");
    pointer.removeAttribute("data-active");
    pointer.removeAttribute("data-mode");
    glow.removeAttribute("data-active");
    glowVelocity = { x: 0, y: 0 };
    pendingPointerInput = undefined;
    layoutRefreshPending = false;
    contentRefreshPending = false;
    transitions.deactivate();
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    lastFrameTime = 0;
  }

  function syncPreferences(): void {
    if (!finePointer.matches || reducedMotion.matches) deactivate();
  }

  function destroy(): void {
    deactivate();
    languageObserver.disconnect();
  }

  return {
    updatePointer,
    refreshTextBounds,
    refreshTextContent,
    deactivate,
    syncPreferences,
    destroy,
  };
}
