import assert from "node:assert/strict";
import test from "node:test";
import { applyLang, restoreLang, setLang } from "../src/i18n/client.ts";

const siteSuffix = " | Posts test 秒 标签";

// Text/attribute fixture for the real client module; browser layout and routing
// remain covered by the separate browser verification.
function createTagPage(tag) {
  const textElement = (textContent, attributes = {}) => ({
    textContent,
    getAttribute: name => attributes[name] ?? null,
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
  });
  const params = JSON.stringify({ tag });
  const title = textElement(`标签: ${tag}${siteSuffix}`, {
    "data-i18n": "pages.tagTitle",
    "data-i18n-params": params,
    "data-i18n-suffix": siteSuffix,
  });
  const heading = textElement(`标签: ${tag}`, {
    "data-i18n": "pages.tagTitle",
    "data-i18n-params": params,
  });
  const description = textElement(`带有该标签的全部文章 "${tag}".`, {
    "data-i18n": "pages.tagDesc",
    "data-i18n-params": params,
  });
  const breadcrumbLabel = textElement("标签", { "data-i18n": "nav.tags" });
  const breadcrumbTag = textElement(tag);
  const seconds = textElement("秒", { "data-i18n": "readingFocus.seconds" });
  const elements = [
    title,
    heading,
    description,
    breadcrumbLabel,
    breadcrumbTag,
    seconds,
  ];
  const document = new EventTarget();
  document.documentElement = { lang: "zh-CN" };
  document.querySelectorAll = selector => {
    const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    return attribute
      ? elements.filter(element => element.getAttribute(attribute) !== null)
      : [];
  };
  document.querySelector = selector =>
    selector === "title"
      ? title
      : (document.querySelectorAll(selector)[0] ?? null);
  Object.defineProperty(document, "title", {
    get: () => title.textContent,
    set: text => {
      title.textContent = text;
    },
  });
  return {
    document,
    heading,
    description,
    breadcrumbLabel,
    breadcrumbTag,
    seconds,
  };
}

function installPage(t, tag, storedLanguage = "zh-CN") {
  const originalGlobals = new Map(
    ["document", "localStorage"].map(name => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ])
  );
  t.after(() => {
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const storage = new Map([["blog-ui-lang", storedLanguage]]);
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const page = createTagPage(tag);
  globalThis.document = page.document;
  return { page, storage };
}

function assertTagPage(page, tag, language) {
  const english = language === "en";
  const heading = `${english ? "Tag" : "标签"}: ${tag}`;
  assert.equal(page.heading.textContent, heading);
  assert.equal(
    page.description.textContent,
    english
      ? `All the articles with the tag "${tag}".`
      : `带有该标签的全部文章 "${tag}".`
  );
  assert.equal(page.document.title, heading + siteSuffix);
  assert.equal(page.breadcrumbTag.textContent, tag);
  assert.equal(page.breadcrumbLabel.textContent, english ? "Tags" : "标签");
  assert.equal(page.seconds.textContent, english ? "s" : "秒");
  assert.equal(page.document.documentElement.lang, language);
}

test("restoring saved Chinese preserves test on the initial Chinese page", t => {
  const { page } = installPage(t, "test");
  restoreLang();
  assertTagPage(page, "test", "zh-CN");
  restoreLang();
  assertTagPage(page, "test", "zh-CN");
});

test("actual language application preserves tag content on round trips", async t => {
  for (const tag of [
    "test",
    "s",
    "Posts",
    "Tags",
    "标签",
    "文章",
    '{{tag}} <b> & "',
  ]) {
    await t.test(tag, t => {
      const { page } = installPage(t, tag);
      for (const language of ["en", "zh-CN", "zh-CN", "en", "zh-CN"]) {
        applyLang(language);
        assertTagPage(page, tag, language);
      }
    });
  }
});

test("saved language is reapplied when a fresh page replaces the current DOM", t => {
  const { page, storage } = installPage(t, "test");
  restoreLang();
  setLang("en");
  assert.equal(storage.get("blog-ui-lang"), "en");
  assertTagPage(page, "test", "en");

  const freshPage = createTagPage("test");
  globalThis.document = freshPage.document;
  restoreLang();
  assertTagPage(freshPage, "test", "en");

  setLang("zh-CN");
  assert.equal(storage.get("blog-ui-lang"), "zh-CN");
  const nextPage = createTagPage("test");
  globalThis.document = nextPage.document;
  restoreLang();
  assertTagPage(nextPage, "test", "zh-CN");
});
