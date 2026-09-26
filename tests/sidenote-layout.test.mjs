import assert from "node:assert/strict";
import test from "node:test";
import {
  getSidenoteChoices,
  selectSidenoteFocus,
  calculateSidenoteLayout,
} from "../src/utils/sidenoteLayout.ts";

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

test("reading selection survives a closer middle node until its whole block exits", () => {
  const groups = [
    { anchor: 100, start: 80, end: 180 },
    { anchor: 420, start: 400, end: 460 },
    { anchor: 700, start: 680, end: 740 },
  ];
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 150,
      viewportEnd: 850,
    }),
    0
  );
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 180,
      viewportEnd: 880,
    }),
    1
  );
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: -1,
      viewportStart: 0,
      viewportEnd: 900,
    }),
    1
  );
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: 1,
      viewportStart: 900,
      viewportEnd: 1200,
    }),
    -1
  );
});

test("an explicitly selected offscreen neighbor remains readable until scrolling", () => {
  const groups = [
    { anchor: 50, start: 40, end: 70 },
    { anchor: 300, start: 280, end: 320 },
  ];
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 100,
      viewportEnd: 700,
      keepManualSelection: true,
    }),
    0
  );
  assert.equal(
    selectSidenoteFocus(groups, {
      selectedIndex: 0,
      viewportStart: 100,
      viewportEnd: 700,
    }),
    1
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

test("a focused hidden card reserves space without reclassifying a static neighbor", () => {
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
  assert.equal(result.items[0].visibleStatic, false);
  assert.equal(result.items[1].baseStatic, false);
  assert.equal(result.focusTop, 180);
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
      .filter((item, index) => item.visibleStatic && index !== focus)
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
  assert.equal(result.focusTop, 80);
});
