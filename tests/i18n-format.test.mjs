import assert from "node:assert/strict";
import test from "node:test";
import { tplStr } from "../src/i18n/format.ts";
import en from "../src/i18n/lang/en.ts";
import zhCN from "../src/i18n/lang/zh-CN.ts";

test("tag UI templates preserve content that overlaps with dictionary phrases", () => {
  for (const tag of [
    "test",
    "s",
    "Posts",
    "Tags",
    "标签",
    "文章",
    '{{tag}} <b> & "',
  ]) {
    assert.equal(tplStr(en.pages.tagTitle, { tag }), `Tag: ${tag}`);
    assert.equal(tplStr(zhCN.pages.tagTitle, { tag }), `标签: ${tag}`);
    assert.equal(
      tplStr(en.pages.tagDesc, { tag }),
      `All the articles with the tag "${tag}".`
    );
    assert.equal(
      tplStr(zhCN.pages.tagDesc, { tag }),
      `带有该标签的全部文章 "${tag}".`
    );
  }
});
