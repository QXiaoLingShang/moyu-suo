import type { PointerPoint } from "@/utils/homePointerGeometry";
import { HOME_POINTER_PARTICLE_BUDGET } from "@/utils/homePointerSampling";

type TravelOptions = {
  duration: number;
  delay: number;
};
type ParticleOwner = object;
type DurationForMotion = (
  anchorIndex: number,
  start: PointerPoint,
  end: PointerPoint
) => number;

export type ParticleCompletion = "arrived" | "budget-evicted";

type ParticleMotionRequest = {
  start: PointerPoint;
  getTarget: () => PointerPoint;
  options: TravelOptions;
  onComplete: (completion: ParticleCompletion) => void;
  owner: ParticleOwner;
  anchorIndex: number;
  glyph: HTMLElement | null;
  initialVelocity?: PointerPoint;
};

type ParticleTravelRequest = Omit<ParticleMotionRequest, "getTarget"> & {
  end: PointerPoint;
};

type RetargetOwnerRequest = {
  owner: ParticleOwner;
  getTarget: (anchorIndex: number, glyph: HTMLElement | null) => PointerPoint;
  duration: DurationForMotion;
  onComplete?: (
    anchorIndex: number,
    glyph: HTMLElement | null,
    completion: ParticleCompletion
  ) => void;
};

type ParticleMotion = {
  satellite: HTMLSpanElement;
  owner: ParticleOwner;
  anchorIndex: number;
  glyph: HTMLElement | null;
  position: PointerPoint;
  velocity: PointerPoint;
  start: PointerPoint;
  startTangent: PointerPoint;
  getTarget: () => PointerPoint;
  duration: number;
  startedAt: number;
  lastFrameAt: number;
  side: number;
  opacity: number;
  startOpacity: number;
  scale: number;
  startScale: number;
  onComplete: (completion: ParticleCompletion) => void;
  timer?: number;
  frame?: number;
};

function curveControlPoint(
  start: PointerPoint,
  end: PointerPoint,
  side: number
): PointerPoint {
  const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const bow = Math.min(7, distance * 0.07) * side;

  return {
    x: (start.x + end.x) / 2 - ((end.y - start.y) / distance) * bow,
    y: (start.y + end.y) / 2 + ((end.x - start.x) / distance) * bow,
  };
}

export class HomePointerParticles {
  private animationIndex = 0;
  private frames = new Set<number>();
  private timers = new Set<number>();
  private satellites = new Set<HTMLElement>();
  private motions = new Set<ParticleMotion>();

  constructor(
    private layer: HTMLElement,
    private maxParticles = HOME_POINTER_PARTICLE_BUDGET.max
  ) {}

  /** Cancel stale routes before the page or pointer context is discarded. */
  cancel(): void {
    this.frames.forEach(frame => window.cancelAnimationFrame(frame));
    this.timers.forEach(timer => window.clearTimeout(timer));
    this.satellites.forEach(satellite => satellite.remove());
    this.frames.clear();
    this.timers.clear();
    this.satellites.clear();
    this.motions.clear();
    this.animationIndex = 0;
  }

  travel({ end, ...request }: ParticleTravelRequest): void {
    this.createMotion({ ...request, getTarget: () => end });
  }

  track(request: ParticleMotionRequest): void {
    this.createMotion(request);
  }

  /** Retarget in-flight particles from their live positions when hover reverses. */
  retargetOwner({
    owner,
    getTarget,
    duration,
    onComplete,
  }: RetargetOwnerRequest): Set<number> {
    const motions = [...this.motions].filter(motion => motion.owner === owner);

    motions.forEach(motion => {
      if (motion.timer !== undefined) {
        window.clearTimeout(motion.timer);
        this.timers.delete(motion.timer);
        motion.timer = undefined;
      }

      motion.start = { ...motion.position };
      motion.getTarget = () => getTarget(motion.anchorIndex, motion.glyph);
      const target = motion.getTarget();
      motion.duration = Math.max(
        duration(motion.anchorIndex, motion.start, target),
        1
      );
      motion.startedAt = performance.now();
      motion.lastFrameAt = motion.startedAt;
      motion.startTangent = this.tangentFromVelocity(
        motion.velocity,
        motion.start,
        target,
        motion.duration
      );
      motion.startOpacity = motion.opacity;
      motion.startScale = motion.scale;
      if (onComplete) {
        motion.onComplete = completion =>
          onComplete(motion.anchorIndex, motion.glyph, completion);
      }
      this.requestMotionFrame(motion);
    });

    return new Set(motions.map(motion => motion.anchorIndex));
  }

  /** Remove a superseded target session without running its stale callbacks. */
  cancelOwner(owner: ParticleOwner): void {
    [...this.motions]
      .filter(motion => motion.owner === owner)
      .forEach(motion => this.removeMotion(motion));
  }

  private createMotion({
    start,
    getTarget,
    options,
    onComplete,
    owner,
    anchorIndex,
    glyph,
    initialVelocity,
  }: ParticleMotionRequest): void {
    // A new hover may overlap the previous return animation; reuse the same visual budget.
    while (this.motions.size >= this.maxParticles) {
      const oldest = this.motions.values().next().value;
      if (!oldest) break;
      this.completeMotion(oldest, "budget-evicted");
    }

    const satellite = this.createSatellite();
    const position = { ...start };
    const duration = Math.max(options.duration, 1);
    const target = getTarget();
    const velocity =
      initialVelocity ?? this.launchVelocity(start, target, duration);
    const motion: ParticleMotion = {
      satellite,
      owner,
      anchorIndex,
      glyph,
      position,
      velocity,
      start: { ...start },
      startTangent: this.tangentFromVelocity(velocity, start, target, duration),
      getTarget,
      duration,
      startedAt: 0,
      lastFrameAt: 0,
      side: this.nextSide(),
      opacity: 0,
      startOpacity: 0,
      scale: 0.65,
      startScale: 0.65,
      onComplete,
    };

    satellite.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) scale(0.65)`;
    satellite.style.opacity = "0";
    this.motions.add(motion);

    const begin = (): void => {
      if (!this.motions.has(motion)) return;
      motion.timer = undefined;
      motion.startedAt = performance.now();
      motion.lastFrameAt = motion.startedAt;
      this.requestMotionFrame(motion);
    };

    if (options.delay > 0) {
      motion.timer = window.setTimeout(() => {
        if (motion.timer !== undefined) this.timers.delete(motion.timer);
        begin();
      }, options.delay);
      this.timers.add(motion.timer);
    } else {
      begin();
    }
  }

  private animateMotion(motion: ParticleMotion, time: number): void {
    if (!this.motions.has(motion)) return;

    const progress = Math.min((time - motion.startedAt) / motion.duration, 1);
    const end = motion.getTarget();
    const control = curveControlPoint(motion.start, end, motion.side);
    const progressSquared = progress * progress;
    const progressCubed = progressSquared * progress;
    const startWeight = 2 * progressCubed - 3 * progressSquared + 1;
    const tangentWeight = progressCubed - 2 * progressSquared + progress;
    const endWeight = -2 * progressCubed + 3 * progressSquared;
    const bowWeight = 2 * progress * (1 - progress);
    const midpoint = {
      x: (motion.start.x + end.x) / 2,
      y: (motion.start.y + end.y) / 2,
    };
    const x =
      startWeight * motion.start.x +
      tangentWeight * motion.startTangent.x +
      endWeight * end.x +
      bowWeight * (control.x - midpoint.x);
    const y =
      startWeight * motion.start.y +
      tangentWeight * motion.startTangent.y +
      endWeight * end.y +
      bowWeight * (control.y - midpoint.y);
    const fadeIn = Math.min(progress / 0.16, 1);
    const fadeOut = Math.min((1 - progress) / 0.14, 1);
    const opacity =
      (motion.startOpacity + (1 - motion.startOpacity) * fadeIn) * fadeOut;
    const scale =
      motion.startScale +
      (1 - motion.startScale) * Math.sin(progress * Math.PI);

    const elapsed = time - motion.lastFrameAt;
    if (elapsed > 0) {
      motion.velocity = {
        x: (x - motion.position.x) / elapsed,
        y: (y - motion.position.y) / elapsed,
      };
    }
    motion.lastFrameAt = time;
    motion.position = { x, y };
    motion.opacity = opacity;
    motion.scale = scale;
    motion.satellite.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    motion.satellite.style.opacity = String(Math.max(opacity, 0));

    if (progress >= 1) {
      this.completeMotion(motion, "arrived");
      return;
    }

    this.requestMotionFrame(motion);
  }

  private createSatellite(): HTMLSpanElement {
    const satellite = document.createElement("span");
    satellite.className = "home-pointer-satellite";
    this.layer.append(satellite);
    this.satellites.add(satellite);
    return satellite;
  }

  private removeMotion(motion: ParticleMotion): boolean {
    if (!this.motions.has(motion)) return false;
    if (motion.frame !== undefined) {
      window.cancelAnimationFrame(motion.frame);
      this.frames.delete(motion.frame);
    }
    if (motion.timer !== undefined) {
      window.clearTimeout(motion.timer);
      this.timers.delete(motion.timer);
    }
    this.motions.delete(motion);
    this.satellites.delete(motion.satellite);
    motion.satellite.remove();
    return true;
  }

  private completeMotion(
    motion: ParticleMotion,
    completion: ParticleCompletion
  ): void {
    if (this.removeMotion(motion)) motion.onComplete(completion);
  }

  private nextSide(): number {
    return this.animationIndex++ % 2 === 0 ? -1 : 1;
  }

  private launchVelocity(
    start: PointerPoint,
    end: PointerPoint,
    duration: number
  ): PointerPoint {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance === 0) return { x: 0, y: 0 };
    const speed = (distance * 0.78) / duration;
    return {
      x: ((end.x - start.x) / distance) * speed,
      y: ((end.y - start.y) / distance) * speed,
    };
  }

  private tangentFromVelocity(
    velocity: PointerPoint,
    start: PointerPoint,
    end: PointerPoint,
    duration: number
  ): PointerPoint {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance === 0) return { x: 0, y: 0 };

    let initialVelocity = velocity;
    let speed = Math.hypot(initialVelocity.x, initialVelocity.y);
    const minimumSpeed = (distance / duration) * 0.32;
    if (speed < minimumSpeed) {
      // A near-zero sampled speed should not make a reversed route visibly stall.
      initialVelocity = {
        x: ((end.x - start.x) / distance) * minimumSpeed,
        y: ((end.y - start.y) / distance) * minimumSpeed,
      };
      speed = minimumSpeed;
    }

    const tangentDuration = Math.min(duration, (distance * 0.85) / speed);
    return {
      x: initialVelocity.x * tangentDuration,
      y: initialVelocity.y * tangentDuration,
    };
  }

  private requestMotionFrame(motion: ParticleMotion): void {
    if (motion.frame !== undefined) return;
    motion.frame = window.requestAnimationFrame(time => {
      if (motion.frame !== undefined) this.frames.delete(motion.frame);
      motion.frame = undefined;
      this.animateMotion(motion, time);
    });
    this.frames.add(motion.frame);
  }
}
