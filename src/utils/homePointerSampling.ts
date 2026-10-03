import type { PointerPoint } from "./homePointerGeometry";

export type PointerParticleBudget = {
  min: number;
  max: number;
  glyphsPerParticle: number;
};

export const HOME_POINTER_PARTICLE_BUDGET: PointerParticleBudget = {
  min: 3,
  max: 8,
  glyphsPerParticle: 2,
};

export type SampledPointerParticle<T> = T & {
  anchorIndex: number;
};

/** Keep a small, tunable particle budget while allowing anchors to overlap. */
export function samplePointerParticles<T extends { glyphIndex: number }>(
  destinations: readonly T[],
  budget: PointerParticleBudget = HOME_POINTER_PARTICLE_BUDGET
): SampledPointerParticle<T>[] {
  if (destinations.length === 0) return [];

  const min = Math.max(1, Math.floor(budget.min));
  const max = Math.max(min, Math.floor(budget.max));
  const glyphsPerParticle = Math.max(1, budget.glyphsPerParticle);
  const count = Math.min(
    max,
    Math.max(min, Math.ceil(destinations.length / glyphsPerParticle))
  );

  return Array.from({ length: count }, (_, anchorIndex) => {
    const destinationIndex = Math.min(
      destinations.length - 1,
      Math.floor(((anchorIndex + 0.5) * destinations.length) / count)
    );

    return {
      ...destinations[destinationIndex],
      anchorIndex,
    };
  });
}
const PARTICLE_SPEED_VARIATION = [1, 1.08, 1.16, 1.04, 1.12, 1.02] as const;

/** Let farther routes take longer, with small deterministic speed variation. */
export function particleTravelDuration({
  from,
  to,
  particleIndex,
  minimumDurationMs,
  minimumSpeedPxPerMs,
}: {
  from: PointerPoint;
  to: PointerPoint;
  particleIndex: number;
  minimumDurationMs: number;
  minimumSpeedPxPerMs: number;
}): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const speedVariation =
    PARTICLE_SPEED_VARIATION[
      Math.abs(Math.trunc(particleIndex)) % PARTICLE_SPEED_VARIATION.length
    ];
  const minimumSpeed = Math.max(0.01, minimumSpeedPxPerMs);

  return Math.max(
    Math.max(1, minimumDurationMs),
    distance / (minimumSpeed * speedVariation)
  );
}
