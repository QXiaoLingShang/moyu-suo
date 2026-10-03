import assert from "node:assert/strict";
import test from "node:test";
import {
  addRippleImpulse,
  createRippleRegionEdgeDistance,
  createRippleWaveField,
  expandRippleWaveBounds,
  stepRippleWaveField,
  viewportCoordinateToGridIndex,
} from "../src/utils/homeRippleWave.ts";

test("viewport coordinates map to the matching bounded ripple cells", () => {
  assert.equal(viewportCoordinateToGridIndex(0, 120, 20), 0);
  assert.equal(viewportCoordinateToGridIndex(5, 120, 20), 0);
  assert.equal(viewportCoordinateToGridIndex(6, 120, 20), 1);
  assert.equal(viewportCoordinateToGridIndex(119, 120, 20), 19);
  assert.equal(viewportCoordinateToGridIndex(120, 120, 20), 19);
});

test("a click impulse propagates out from its origin", () => {
  const field = createRippleWaveField(61, 61);
  const origin = 30 * field.width + 30;

  addRippleImpulse(field, 30, 30);
  for (let frame = 0; frame < 12; frame++) stepRippleWaveField(field);

  assert.notEqual(field.current[origin], 0);
  assert.ok(
    field.current[origin + 12] !== 0 || field.previous[origin + 12] !== 0
  );
});

test("overlapping clicks add energy to the shared field without a count cap", () => {
  const field = createRippleWaveField(41, 41);
  const storageSize = field.current.length;

  for (let click = 0; click < 128; click++) {
    addRippleImpulse(field, 20, 20);
  }

  assert.equal(field.current.length, storageSize);
  assert.ok(field.current[20 * field.width + 20] > 100);
  assert.ok(field.current.every(Number.isFinite));
});

test("wave energy eventually dissipates at the viewport boundary", () => {
  const field = createRippleWaveField(41, 41);
  addRippleImpulse(field, 20, 20);

  let frame = 0;
  let active = true;
  while (active && frame < 1400) {
    active = stepRippleWaveField(field);
    frame++;
  }

  assert.ok(frame < 1400);
  assert.equal(active, false);
});

test("click ripples remain inside their local grid radius", () => {
  const field = createRippleWaveField(101, 101);
  const regionEdgeDistance = createRippleRegionEdgeDistance(
    field.width,
    field.height,
    [{ x: 50, y: 50 }],
    18
  );

  addRippleImpulse(field, 50, 50);
  let active = true;
  let frame = 0;
  while (active && frame < 360) {
    active = stepRippleWaveField(field, { regionEdgeDistance });
    frame++;

    for (let index = 0; index < field.current.length; index++) {
      if (
        field.current[index] !== 0 ||
        field.previous[index] !== 0 ||
        field.next[index] !== 0
      ) {
        assert.ok(regionEdgeDistance[index] >= 0);
      }
    }
  }

  assert.equal(active, false);
});

test("bounded stepping matches full-grid stepping for a local ripple", () => {
  const full = createRippleWaveField(101, 81);
  const bounded = createRippleWaveField(101, 81);
  const origin = { x: 50, y: 40 };
  const radius = 18;
  const regionEdgeDistance = createRippleRegionEdgeDistance(
    full.width,
    full.height,
    [origin],
    radius
  );
  const bounds = expandRippleWaveBounds(
    null,
    full.width,
    full.height,
    origin,
    radius
  );

  addRippleImpulse(full, origin.x, origin.y);
  addRippleImpulse(bounded, origin.x, origin.y);
  for (let frame = 0; frame < 48; frame++) {
    stepRippleWaveField(full, { regionEdgeDistance });
    stepRippleWaveField(bounded, { regionEdgeDistance, bounds });
    assert.deepEqual(bounded.current, full.current);
    assert.deepEqual(bounded.previous, full.previous);
  }
});
