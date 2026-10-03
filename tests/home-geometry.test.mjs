import assert from "node:assert/strict";
import test from "node:test";
import { getHomeGeometry } from "../src/utils/homeGeometry.ts";

function getAngularGaps(points, center) {
  const angles = points
    .map(({ x, y }) => {
      const angle = Math.atan2(y - center.y, x - center.x);
      return angle < 0 ? angle + Math.PI * 2 : angle;
    })
    .sort((left, right) => left - right);
  return angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length];
    return (next - angle + Math.PI * 2) % (Math.PI * 2);
  });
}

test("entrance endpoints stay on one circle with folded straight connectors", () => {
  for (let count = 1; count <= 10; count += 1) {
    const centerY = 296 + Math.max(0, Math.ceil(count / 2) - 3) * 67;
    const layout = getHomeGeometry({
      count,
      width: 1328,
      centerY,
      maxLabelWidth: 96,
      labelWidths: Array(count).fill(96),
    });
    assert.equal(layout.length, count);
    const radii = layout.map(({ point }) =>
      Math.hypot(point.x - 664, point.y - centerY)
    );
    for (const radius of radii) {
      assert.ok(Math.abs(radius - radii[0]) < 0.001);
    }
    for (const { connector } of layout) {
      assert.equal((connector.match(/ L /g) ?? []).length, 2);
      assert.ok(!/[CQSA]/.test(connector));
    }
    for (const { connector, label, point, side } of layout) {
      const [, , , elbowX, elbowY, lineEndX, lineEndY] = connector
        .match(
          /^M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)$/
        )
        .map(Number);
      assert.equal(elbowY, label.y);
      assert.equal(lineEndY, label.y);
      assert.equal(lineEndX, label.x + (side === "left" ? -96 : 96));
      assert.ok(
        side === "left"
          ? point.x > elbowX && elbowX > label.x
          : point.x < elbowX && elbowX < label.x
      );
    }
  }
});

test("full orbit distributes anchors around all 360 degrees", () => {
  for (const count of [2, 3, 6, 8, 10]) {
    const center = { x: 664, y: 296 };
    const layout = getHomeGeometry({
      count,
      width: 1328,
      centerY: center.y,
      maxLabelWidth: 96,
      labelWidths: Array(count).fill(96),
    });
    const gaps = getAngularGaps(
      layout.map(({ point }) => point),
      center
    );
    if (count === 6) {
      const expectedGaps = [50, 80, 50, 50, 80, 50].map(
        degrees => (degrees * Math.PI) / 180
      );
      for (const [index, gap] of gaps.entries()) {
        assert.ok(Math.abs(gap - expectedGaps[index]) < 0.001);
      }
    } else {
      const expectedGap = (Math.PI * 2) / count;
      for (const gap of gaps) assert.ok(Math.abs(gap - expectedGap) < 0.001);
    }
  }
});

test("six-entry anchors and labels stay in a stable layout", () => {
  const options = {
    count: 6,
    width: 972,
    centerY: 260,
    maxLabelWidth: 48,
    labelWidths: Array(6).fill(48),
  };
  const firstLayout = getHomeGeometry(options);
  const subsequentLayout = getHomeGeometry(options);
  assert.deepEqual(subsequentLayout, firstLayout);
});

test("added rows retain distinct vertical positions", () => {
  for (const count of [6, 8, 10]) {
    const layout = getHomeGeometry({
      count,
      width: 1328,
      centerY: 430,
      maxLabelWidth: 96,
      labelWidths: Array(count).fill(96),
    });
    const sideLabels = ["left", "right"].map(side =>
      layout
        .filter(geometry => geometry.side === side)
        .map(({ label }) => label.y)
        .sort((left, right) => left - right)
    );
    for (const labels of sideLabels) {
      for (let index = 1; index < labels.length; index += 1) {
        assert.ok(labels[index] - labels[index - 1] > 30);
      }
    }
  }
});

test("leader lines cover each label without moving its inner edge", () => {
  const options = {
    count: 6,
    width: 1328,
    centerY: 296,
    maxLabelWidth: 140,
    labelWidths: [52, 80, 64, 112, 72, 128],
  };
  const initial = getHomeGeometry(options);
  const changedWidths = [...options.labelWidths];
  changedWidths[0] += 30;
  changedWidths[1] += 30;
  const longer = getHomeGeometry({ ...options, labelWidths: changedWidths });

  for (const [index, layout] of initial.entries()) {
    const side = layout.side === "left" ? -1 : 1;
    const lineEndX = Number(layout.connector.split(" L ").at(-1).split(" ")[0]);
    const longerEndX = Number(
      longer[index].connector.split(" L ").at(-1).split(" ")[0]
    );
    assert.equal(lineEndX, layout.label.x + side * options.labelWidths[index]);
    assert.deepEqual(longer[index].label, layout.label);
    assert.equal(
      longerEndX,
      lineEndX + side * (changedWidths[index] - options.labelWidths[index])
    );
  }
});
