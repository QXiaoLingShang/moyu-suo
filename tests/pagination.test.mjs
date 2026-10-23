import assert from "node:assert/strict";
import test from "node:test";
import {
  getPaginationHref,
  withLegacyPaginationUrls,
} from "../src/utils/pagination.ts";

test("jump URLs preserve base paths, tags and locale and omit page 1", () => {
  for (const firstPageUrl of [
    "/posts",
    "/moyu-suo/posts/",
    "/moyu-suo/tags/oi%E6%97%A5%E8%AE%B0/",
    "/en/tags/test",
  ]) {
    const root = firstPageUrl.replace(/\/+$/, "");
    assert.equal(getPaginationHref({ firstPageUrl, page: 1 }), `${root}/`);
    assert.equal(getPaginationHref({ firstPageUrl, page: 12 }), `${root}/12/`);
  }
});

const route = (page, tag = "oi") => ({
  params: { tag, page: page === 1 ? undefined : String(page) },
  props: { tagName: "OI", page: { url: { current: `/tags/${tag}/${page}` } } },
});

test("retired listing URLs redirect to the new last page and preserve tag props", () => {
  const routes = withLegacyPaginationUrls({
    pages: [route(1), route(2)],
    legacyPages: [route(1), route(2), route(3), route(4)],
  });
  assert.equal(routes.length, 4);
  assert.equal(routes[0].props.redirectTo, undefined);
  assert.equal(routes[1].props.redirectTo, undefined);
  assert.equal(routes[2].props.redirectTo, "/tags/oi/2/");
  assert.equal(routes[3].params.page, "4");
  assert.equal(routes[3].props.tagName, "OI");
});

test("real pages take precedence when page counts grow or the size decreases", () => {
  const pages = [route(1), route(2), route(3)];
  for (const legacyPages of [pages, pages.slice(0, 2)]) {
    const routes = withLegacyPaginationUrls({ pages, legacyPages });
    assert.equal(routes.length, 3);
    assert.ok(routes.every(route => route.props.redirectTo === undefined));
  }
});

test("legacy redirects encode Chinese tags once for valid Location headers", () => {
  for (const tag of ["oi日记", "oi%E6%97%A5%E8%AE%B0"]) {
    const routes = withLegacyPaginationUrls({
      pages: [route(1, tag)],
      legacyPages: [route(1, tag), route(2, tag)],
    });
    assert.equal(routes[1].props.redirectTo, "/tags/oi%E6%97%A5%E8%AE%B0/1/");
  }
});

test("empty route sets do not create redirects without a destination", () => {
  assert.deepEqual(
    withLegacyPaginationUrls({ pages: [], legacyPages: [route(1)] }),
    []
  );
});
