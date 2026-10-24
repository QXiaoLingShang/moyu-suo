import assert from "node:assert/strict";
import test from "node:test";
import {
  getNavigationSegments,
  getPageAncestors,
  getReturnLabel,
} from "../src/utils/navigation.ts";

test("navigation paths respect deployment boundaries and supported locale prefixes", () => {
  const options = { basePath: "/moyu-suo/", locales: ["en", "zh-CN"] };
  for (const pathname of ["/moyu-suo", "/moyu-suo/", "/moyu-suo/en/"]) {
    assert.deepEqual(getNavigationSegments({ ...options, pathname }), []);
  }
  assert.deepEqual(
    getNavigationSegments({ ...options, pathname: "/moyu-suo/en/posts/2/" }),
    ["posts", "2"]
  );
  assert.deepEqual(
    getNavigationSegments({
      ...options,
      pathname: "/moyu-suo/zh-CN/tags/CodeFoces/",
    }),
    ["tags", "CodeFoces"]
  );
  for (const pathname of ["/moyu-suo-extra/posts/", "/posts/", "/other/"]) {
    assert.equal(getNavigationSegments({ ...options, pathname }), undefined);
  }
  assert.deepEqual(
    getNavigationSegments({
      pathname: "/en/posts/2/",
      basePath: "/",
      locales: ["en"],
    }),
    ["posts", "2"]
  );
});

test("content segments remain intact rather than being decoded or treated as locales", () => {
  for (const tag of [
    "en",
    "CodeFoces",
    "oi%E6%97%A5%E8%AE%B0",
    "%E0%A4%A",
    "中文",
  ]) {
    assert.deepEqual(
      getNavigationSegments({
        pathname: `/moyu-suo/tags/${tag}/2/`,
        basePath: "/moyu-suo/",
        locales: ["en"],
      }),
      ["tags", tag, "2"]
    );
  }
});

test("ancestor links omit the current title and pagination levels", () => {
  const cases = [
    [[], ["home"]],
    [["about"], ["home"]],
    [["posts"], ["home"]],
    [["posts", "2"], ["home"]],
    [["tags"], ["home", "blog"]],
    [["archives"], ["home", "blog"]],
    [["search"], ["home", "blog"]],
    [
      ["tags", "CodeFoces"],
      ["home", "blog", "tags"],
    ],
    [
      ["tags", "2", "3"],
      ["home", "blog", "tags"],
    ],
    [
      ["posts", "oi", "round-1124"],
      ["home", "blog"],
    ],
    [
      ["posts", "2026", "notes"],
      ["home", "blog"],
    ],
  ];
  for (const [segments, expected] of cases) {
    assert.deepEqual(
      getPageAncestors(segments).map(item => item.id),
      expected
    );
  }
});

test("return labels distinguish source lists, articles and parent sections", () => {
  const cases = [
    [[], "backToHome"],
    [["posts"], "backToPosts"],
    [["posts", "2"], "backToPosts"],
    [["posts", "oi", "round-1124"], "backToArticle"],
    [["posts", "2026", "notes"], "backToArticle"],
    [["tags"], "backToTags"],
    [["tags", "CodeFoces"], "backToTaggedPosts"],
    [["archives"], "backToArchives"],
    [["search"], "backToSearch"],
    [["about"], "backToAbout"],
    [["unknown"], "backToPage"],
  ];
  for (const [segments, expected] of cases) {
    assert.deepEqual(getReturnLabel({ segments }), {
      key: `navigation.${expected}`,
    });
  }
});

test("source tag names remain content parameters including case and template-like text", () => {
  for (const tagName of ["CodeFoces", "Posts", "标签", '{{tag}} <b> & "']) {
    assert.deepEqual(
      getReturnLabel({ segments: ["tags", "slug", "2"], tagName }),
      { key: "navigation.backToTag", params: { tag: tagName } }
    );
  }
  assert.deepEqual(
    getReturnLabel({ segments: ["posts"], tagName: "old tag" }),
    {
      key: "navigation.backToPosts",
    }
  );
});
