import assert from "node:assert/strict";
import test from "node:test";
import {
  getSidenoteChoices,
  selectSidenoteFocus,
} from "../src/utils/sidenoteSelection.ts";
import { calculateSidenoteLayout } from "../src/utils/sidenoteLayout.ts";

test("nearby repeated references share one choice and remember the exact active reference", () => {
  const first = { note: "A", ref: "a-1" };
  const second = { note: "A", ref: "a-2" };
  const other = { note: "B", ref: "b-1" };
  assert.deepEqual(getSidenoteChoices([first, other, second], second), [
    second,
    other,
  ]);
});

test("repeated references in different groups retain both positions and all intervening notes", () => {
  const groups = [
    [{ note: "A", ref: "a-1" }],
    [{ note: "B", ref: "b-1" }],
    [{ note: "A", ref: "a-2" }],
    [{ note: "C", ref: "c-1" }],
  ];
  const choices = groups.flatMap(group => getSidenoteChoices(group));
  assert.deepEqual(
    choices.map(item => item.ref),
    ["a-1", "b-1", "a-2", "c-1"]
  );
});

test("reading selection advances at the divider and follows reverse crossings", () => {
  const groups = [
    { anchor: 100, top: 80, height: 100, start: 80, end: 180 },
    { anchor: 420, top: 400, height: 60, start: 400, end: 460 },
    { anchor: 700, top: 680, height: 60, start: 680, end: 740 },
  ];
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 0,
      viewportEnd: 900,
      manualSelection: false,
      readingLine: 300,
      previousReadingLine: 200,
      direction: "down",
    }),
    { index: 0, manual: false }
  );
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 0,
      viewportEnd: 900,
      manualSelection: false,
      readingLine: 450,
      previousReadingLine: 300,
      direction: "down",
    }),
    { index: 1, manual: false }
  );
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 2,
      viewportStart: 0,
      viewportEnd: 900,
      manualSelection: false,
      readingLine: 400,
      previousReadingLine: 750,
      direction: "up",
    }),
    { index: 1, manual: false }
  );
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 1,
      viewportStart: 900,
      viewportEnd: 1200,
      manualSelection: false,
      readingLine: 1000,
      previousReadingLine: 800,
      direction: "down",
    }),
    { index: -1, manual: false }
  );
});

test("manual selection holds without scrolling and yields when it is behind the reading divider", () => {
  const groups = [
    { anchor: 50, top: 40, height: 30, start: 40, end: 70 },
    { anchor: 300, top: 280, height: 40, start: 280, end: 320 },
  ];
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 100,
      viewportEnd: 700,
      manualSelection: true,
      readingLine: 350,
      previousReadingLine: 350,
      direction: "down",
    }),
    { index: 0, manual: true }
  );
  assert.deepEqual(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 100,
      viewportEnd: 700,
      manualSelection: true,
      readingLine: 360,
      previousReadingLine: 350,
      direction: "down",
    }),
    { index: 1, manual: false }
  );
});

test("focus never changes the base static classification", () => {
  const groups = [
    { anchor: 180, height: 40 },
    { anchor: 270, height: 180 },
    { anchor: 420, height: 80 },
  ];
  const baseline = calculateSidenoteLayout(groups, {
    focusIndex: -1,
    viewportStart: 80,
    viewportEnd: 700,
    gap: 12,
    anchorOffset: 20,
  });
  for (let focus = 0; focus < groups.length; focus++) {
    const result = calculateSidenoteLayout(groups, {
      focusIndex: focus,
      viewportStart: 80,
      viewportEnd: 700,
      gap: 12,
      anchorOffset: 20,
    });
    assert.deepEqual(
      result.items.map(x => x.baseStatic),
      baseline.items.map(x => x.baseStatic)
    );
  }
});

test("heading-aligned focus leaves room for a static neighbor without reclassifying it", () => {
  const groups = [
    { anchor: 180, height: 40 },
    { anchor: 270, height: 180 },
    { anchor: 420, height: 80 },
  ];
  const result = calculateSidenoteLayout(groups, {
    focusIndex: 1,
    viewportStart: 80,
    viewportEnd: 700,
    gap: 12,
    anchorOffset: 20,
  });
  assert.equal(result.items[0].baseStatic, true);
  assert.equal(result.items[1].baseStatic, false);
  assert.equal(result.focusTop, 250);
});

test("a tall offscreen predecessor reserves room across multiple short notes", () => {
  const result = calculateSidenoteLayout(
    [
      { anchor: -10, height: 300 },
      { anchor: 85, height: 40 },
      { anchor: 160, height: 40 },
    ],
    {
      focusIndex: 1,
      viewportStart: 80,
      viewportEnd: 500,
      gap: 12,
      anchorOffset: 20,
    }
  );
  assert.deepEqual(
    result.items.map(x => x.baseStatic),
    [false, false, false]
  );
});

test("dense mixed heights keep the focus in bounds and visible cards disjoint", () => {
  const groups = Array.from({ length: 80 }, (_, i) => ({
    anchor: i * 47,
    height: 60 + (i % 5) * 21,
  }));
  for (let focus = 0; focus < groups.length; focus++) {
    const start = groups[focus].anchor - 240,
      end = start + 640;
    const result = calculateSidenoteLayout(groups, {
      focusIndex: focus,
      viewportStart: start,
      viewportEnd: end,
      gap: 12,
      anchorOffset: 20,
    });
    assert.ok(result.focusTop >= start);
    assert.ok(result.focusTop + groups[focus].height <= end);
    const visible = result.items
      .filter(
        (item, index) =>
          index !== focus && (item.baseStatic || item.visibleRepresentative)
      )
      .map(item => ({ top: item.top, height: item.height }));
    visible.push({ top: result.focusTop, height: groups[focus].height });
    visible.sort((a, b) => a.top - b.top);
    visible.forEach((item, index) => {
      assert.ok(item.top >= start && item.top + item.height <= end);
      if (index)
        assert.ok(
          item.top >= visible[index - 1].top + visible[index - 1].height + 12
        );
    });
  }
});

test("empty and too-short viewports do not produce a static card", () => {
  assert.equal(
    calculateSidenoteLayout([], {
      focusIndex: -1,
      viewportStart: 80,
      viewportEnd: 700,
      gap: 12,
      anchorOffset: 20,
    }).focusTop,
    null
  );
  const result = calculateSidenoteLayout([{ anchor: 100, height: 120 }], {
    focusIndex: 0,
    viewportStart: 80,
    viewportEnd: 100,
    gap: 12,
    anchorOffset: 20,
  });
  assert.equal(result.items[0].baseStatic, false);
  assert.equal(result.focusTop, 80.8);
});
