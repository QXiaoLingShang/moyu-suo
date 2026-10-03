export type RippleWaveField = {
  width: number;
  height: number;
  current: Float32Array;
  previous: Float32Array;
  next: Float32Array;
};

export type RippleWavePoint = {
  x: number;
  y: number;
};

export type RippleWaveBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type RippleWaveStepOptions = {
  /** Negative values mark cells outside every click's local ripple area. */
  regionEdgeDistance?: Float32Array;
  /** Bound iteration to the union of regions ever activated in this field. */
  bounds?: RippleWaveBounds;
};

export function viewportCoordinateToGridIndex(
  coordinate: number,
  viewportSize: number,
  gridSize: number
): number {
  const safeViewportSize = Math.max(1, viewportSize);
  const safeGridSize = Math.max(1, Math.floor(gridSize));
  const safeCoordinate = Math.min(
    Math.max(0, coordinate),
    safeViewportSize - 1
  );
  return Math.min(
    safeGridSize - 1,
    Math.floor((safeCoordinate * safeGridSize) / safeViewportSize)
  );
}

const WAVE_SPEED_SQUARED = 0.42;
// Let a click ripple travel visibly, then dissipate before it lingers.
const WAVE_DAMPING = 0.945;
const EDGE_SINK_CELLS = 10;
const ACTIVE_THRESHOLD = 0.0015;
const IMPULSE_RADIUS_CELLS = 2;

export function createRippleWaveField(
  width: number,
  height: number
): RippleWaveField {
  const fieldWidth = Math.max(1, Math.floor(width));
  const fieldHeight = Math.max(1, Math.floor(height));
  const size = fieldWidth * fieldHeight;
  return {
    width: fieldWidth,
    height: fieldHeight,
    current: new Float32Array(size),
    previous: new Float32Array(size),
    next: new Float32Array(size),
  };
}

export function addRippleImpulse(
  field: RippleWaveField,
  x: number,
  y: number
): void {
  const centerX = Math.round(x);
  const centerY = Math.round(y);
  const radiusSquared = IMPULSE_RADIUS_CELLS ** 2;
  const startX = Math.max(0, centerX - IMPULSE_RADIUS_CELLS);
  const endX = Math.min(field.width - 1, centerX + IMPULSE_RADIUS_CELLS);
  const startY = Math.max(0, centerY - IMPULSE_RADIUS_CELLS);
  const endY = Math.min(field.height - 1, centerY + IMPULSE_RADIUS_CELLS);

  for (let row = startY; row <= endY; row++) {
    for (let column = startX; column <= endX; column++) {
      const distanceSquared = (column - centerX) ** 2 + (row - centerY) ** 2;
      if (distanceSquared > radiusSquared) continue;

      const weight = Math.exp(-distanceSquared / 2.8);
      const index = row * field.width + column;
      // Linear superposition keeps overlaps uncapped without per-click wave objects.
      field.current[index] += weight;
    }
  }
}

export function createRippleRegionEdgeDistance(
  width: number,
  height: number,
  origins: readonly RippleWavePoint[],
  radiusCells: number
): Float32Array {
  const region = new Float32Array(width * height).fill(-1);
  const safeRadius = Math.max(0, radiusCells);
  const radiusSquared = safeRadius ** 2;

  for (const origin of origins) {
    const startX = Math.max(0, Math.floor(origin.x - safeRadius));
    const endX = Math.min(width - 1, Math.ceil(origin.x + safeRadius));
    const startY = Math.max(0, Math.floor(origin.y - safeRadius));
    const endY = Math.min(height - 1, Math.ceil(origin.y + safeRadius));

    for (let row = startY; row <= endY; row++) {
      for (let column = startX; column <= endX; column++) {
        const distanceSquared =
          (column - origin.x) ** 2 + (row - origin.y) ** 2;
        if (distanceSquared > radiusSquared) continue;

        const index = row * width + column;
        const edgeDistance = safeRadius - Math.sqrt(distanceSquared);
        region[index] = Math.max(region[index], edgeDistance);
      }
    }
  }

  return region;
}

export function expandRippleWaveBounds(
  bounds: RippleWaveBounds | null,
  width: number,
  height: number,
  origin: RippleWavePoint,
  radius: number
): RippleWaveBounds {
  const safeRadius = Math.max(0, radius);
  const next = {
    left: Math.max(0, Math.floor(origin.x - safeRadius)),
    top: Math.max(0, Math.floor(origin.y - safeRadius)),
    right: Math.min(width - 1, Math.ceil(origin.x + safeRadius)),
    bottom: Math.min(height - 1, Math.ceil(origin.y + safeRadius)),
  };
  if (!bounds) return next;

  return {
    left: Math.min(bounds.left, next.left),
    top: Math.min(bounds.top, next.top),
    right: Math.max(bounds.right, next.right),
    bottom: Math.max(bounds.bottom, next.bottom),
  };
}

export function stepRippleWaveField(
  field: RippleWaveField,
  options: RippleWaveStepOptions = {}
): boolean {
  const { width, height, current, previous, next } = field;
  const regionEdgeDistance = options.regionEdgeDistance;
  const bounds = options.bounds ?? {
    left: 0,
    top: 0,
    right: width - 1,
    bottom: height - 1,
  };
  if (regionEdgeDistance && regionEdgeDistance.length !== current.length) {
    throw new RangeError("Ripple region must match the wave field size");
  }
  let maxActivity = 0;

  for (let row = bounds.top; row <= bounds.bottom; row++) {
    for (let column = bounds.left; column <= bounds.right; column++) {
      const index = row * width + column;
      const localEdgeDistance = regionEdgeDistance?.[index] ?? Infinity;
      if (localEdgeDistance < 0) {
        current[index] = 0;
        previous[index] = 0;
        next[index] = 0;
        continue;
      }

      const center = current[index];
      const left = column > 0 ? current[index - 1] : 0;
      const right = column + 1 < width ? current[index + 1] : 0;
      const above = row > 0 ? current[index - width] : 0;
      const below = row + 1 < height ? current[index + width] : 0;
      const laplacian = left + right + above + below - center * 4;
      let value =
        (2 * center - previous[index] + WAVE_SPEED_SQUARED * laplacian) *
        WAVE_DAMPING;
      const viewportEdgeDistance = Math.min(
        column,
        row,
        width - 1 - column,
        height - 1 - row
      );
      const edgeDistance = Math.min(viewportEdgeDistance, localEdgeDistance);

      if (edgeDistance < EDGE_SINK_CELLS) {
        const edgeRatio = edgeDistance / EDGE_SINK_CELLS;
        value *= edgeRatio * edgeRatio * (3 - 2 * edgeRatio);
      }

      next[index] = value;
      maxActivity = Math.max(
        maxActivity,
        Math.abs(value),
        Math.abs(value - center)
      );
    }
  }

  field.previous = current;
  field.current = next;
  field.next = previous;
  return maxActivity >= ACTIVE_THRESHOLD;
}
