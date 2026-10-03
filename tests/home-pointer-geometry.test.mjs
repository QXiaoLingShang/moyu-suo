import assert from "node:assert/strict";
import test from "node:test";
import {
  boundsFromRects,
  closestBoundaryPoint,
  containsPoint,
  expandBounds,
} from "../src/utils/homePointerGeometry.ts";
import {
  particleTravelDuration,
  samplePointerParticles,
} from "../src/utils/homePointerSampling.ts";

test("expanded hover bounds include a forgiving margin without moving the label", () => {
  const textBounds = { left: 100, top: 80, right: 160, bottom: 104 };
  const hoverBounds = expandBounds(textBounds, 16);

  assert.deepEqual(hoverBounds, {
    left: 84,
    top: 64,
    right: 176,
    bottom: 120,
  });
  assert.ok(containsPoint({ x: 84, y: 120 }, hoverBounds));
  assert.ok(!containsPoint({ x: 83.9, y: 120 }, hoverBounds));
  assert.deepEqual(textBounds, { left: 100, top: 80, right: 160, bottom: 104 });
});

test("ring lands on the nearest edge of the padded label boundary", () => {
  const bounds = { left: 80, top: 64, right: 176, bottom: 120 };

  assert.deepEqual(closestBoundaryPoint({ x: 120, y: 90 }, bounds), {
    x: 120,
    y: 64,
  });
  assert.deepEqual(closestBoundaryPoint({ x: 40, y: 90 }, bounds), {
    x: 80,
    y: 90,
  });
});

test("text bounds combine visible glyphs and ignore empty boxes", () => {
  assert.deepEqual(
    boundsFromRects([
      { left: 10, top: 20, right: 18, bottom: 40 },
      { left: 18, top: 20, right: 0, bottom: 40 },
      { left: 24, top: 22, right: 33, bottom: 39 },
    ]),
    { left: 10, top: 20, right: 33, bottom: 40 }
  );
  assert.equal(
    boundsFromRects([{ left: 10, top: 20, right: 10, bottom: 40 }]),
    null
  );
});

test("particle sampling stays within its configurable budget and spans the label", () => {
  const destinations = Array.from({ length: 20 }, (_, glyphIndex) => ({
    glyphIndex,
    point: { x: glyphIndex, y: 0 },
  }));
  const anchors = samplePointerParticles(destinations, {
    min: 3,
    max: 5,
    glyphsPerParticle: 2,
  });

  assert.equal(anchors.length, 5);
  assert.deepEqual(
    anchors.map(anchor => anchor.glyphIndex),
    [2, 6, 10, 14, 18]
  );
  assert.deepEqual(
    anchors.map(anchor => anchor.anchorIndex),
    [0, 1, 2, 3, 4]
  );
});

test("particle sampling allows several particles to share short-label anchors", () => {
  const anchors = samplePointerParticles(
    [{ glyphIndex: 0 }, { glyphIndex: 1 }],
    { min: 5, max: 5, glyphsPerParticle: 2 }
  );

  assert.equal(anchors.length, 5);
  assert.ok(
    new Set(anchors.map(anchor => anchor.glyphIndex)).size < anchors.length
  );
  assert.deepEqual(
    anchors.map(anchor => anchor.anchorIndex),
    [0, 1, 2, 3, 4]
  );
});

test("particle travel durations grow with distance and vary between equal routes", () => {
  const options = {
    from: { x: 0, y: 0 },
    minimumDurationMs: 60,
    minimumSpeedPxPerMs: 0.5,
  };
  const shortRoute = particleTravelDuration({
    ...options,
    to: { x: 10, y: 0 },
    particleIndex: 0,
  });
  const longRoute = particleTravelDuration({
    ...options,
    to: { x: 100, y: 0 },
    particleIndex: 0,
  });
  const sameDistanceWithDifferentSpeed = particleTravelDuration({
    ...options,
    to: { x: 100, y: 0 },
    particleIndex: 1,
  });

  assert.equal(shortRoute, 60);
  assert.ok(longRoute > shortRoute);
  assert.notEqual(sameDistanceWithDifferentSpeed, longRoute);
});
