import assert from "node:assert/strict";
import test from "node:test";
import { formatShortDate } from "../src/utils/formatDate.ts";

const postDate = new Date("2026-09-26T12:00:00.000Z");

test("short homepage dates stay compact and localized", () => {
  assert.equal(formatShortDate(postDate, "Asia/Shanghai", "zh-CN"), "9月26日");
  assert.equal(formatShortDate(postDate, "Asia/Shanghai", "en"), "Sep 26");
});
