import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate as nextTask } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as navigation from "../src/utils/navigation.ts";
import { tplStr } from "../src/i18n/format.ts";

const origin = "https://blog.example";
const article = `${origin}/moyu-suo/posts/agent/code-mode/`;
const listing = `${origin}/moyu-suo/tags/codefoces/`;
const key = "moyu:return";
const source = {
  href: listing,
  x: 0,
  y: 450,
  routerIndex: 2,
  tagName: "CodeFoces",
};
const script = ts.transpileModule(
  readFileSync(
    new URL("../src/scripts/navigationHistory.ts", import.meta.url),
    "utf8"
  ).replaceAll("import.meta.env.BASE_URL", JSON.stringify("/moyu-suo/")),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText;

// Run the real coordinator with DOM/router boundaries supplied as fixtures.
// These tests check event ordering and state ownership; real Astro navigation
// and layout remain covered by browser regression.
function createPage({
  href = article,
  state = { index: 3, [key]: source },
  tagName,
  fonts = Promise.resolve(),
} = {}) {
  const location = new URL(href);
  const navigations = [];
  const traversals = [];
  const scrolls = [];
  const frames = new Map();
  const writes = [];
  const document = new EventTarget();
  const window = new EventTarget();
  let nextFrame = 0;

  class Element {
    closest() {
      return this;
    }
  }
  class Anchor extends Element {
    constructor(href, { id = "", attributes = [], target = "" } = {}) {
      super();
      this.url = new URL(href, location);
      this.id = id;
      this.attributes = new Set(attributes);
      this.target = target;
      this.dataset = { returnFallback: "/moyu-suo/posts/" };
      this.label = { dataset: {}, textContent: "" };
    }
    get href() {
      return this.url.href;
    }
    set href(value) {
      this.url = new URL(value, location);
    }
    hasAttribute(name) {
      return this.attributes.has(name);
    }
    querySelector() {
      return this.label;
    }
  }
  const button = new Anchor("/moyu-suo/posts/", { id: "back-button" });
  document.fonts = { ready: fonts };
  document.querySelector = selector => {
    if (selector === "#back-button") return button;
    if (selector === "[data-page-navigation]") return {};
    if (selector === "[data-navigation-tag]" && tagName !== undefined)
      return { dataset: { navigationTag: tagName } };
    return null;
  };
  const history = {
    state: structuredClone(state),
    replaceState(state, _title, href) {
      this.state = structuredClone(state);
      writes.push(this.state);
      if (href) location.href = new URL(href, location).href;
    },
    go(delta) {
      traversals.push(delta);
    },
  };
  window.scrollTo = position => scrolls.push(structuredClone(position));
  const context = {
    document,
    window,
    history,
    location,
    URL,
    Element,
    HTMLAnchorElement: Anchor,
    scrollX: 0,
    scrollY: 450,
    exports: {},
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    require(specifier) {
      if (specifier === "astro:transitions/client")
        return {
          navigate: async (href, options) =>
            navigations.push({ href, options: structuredClone(options) }),
        };
      if (specifier === "@/i18n/client")
        return {
          LANGS: ["zh-CN", "en"],
          getUIString: key => key,
          UI_LANGUAGE_CHANGE_EVENT: "ui:language-change",
        };
      if (specifier === "@/i18n/format") return { tplStr };
      if (specifier === "@/utils/navigation") return navigation;
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  runInNewContext(script, context, { filename: "navigationHistory.js" });
  function emit(type, properties = {}) {
    const event = Object.assign(new Event(type), properties);
    document.dispatchEvent(event);
  }
  function click(link = button, options = {}) {
    const event = Object.assign(
      new Event("click", { cancelable: true, bubbles: true }),
      {
        button: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...options,
      }
    );
    Object.defineProperty(event, "target", { value: link });
    // Model the document and window phases separately so each test can insert
    // the router's history write before the final metadata repair.
    document.dispatchEvent(event);
    return event;
  }
  function swap(href, navigationType, nextState) {
    const properties = {
      from: new URL(location),
      to: new URL(href),
      navigationType,
      newDocument: document,
    };
    emit("astro:before-preparation", properties);
    emit("astro:before-swap", properties);
    location.href = href;
    history.state = structuredClone(nextState);
    emit("astro:after-swap");
  }
  return {
    location,
    history,
    document,
    window,
    button,
    Anchor,
    Element,
    context,
    navigations,
    traversals,
    scrolls,
    writes,
    click,
    emit,
    swap,
    runFrames() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(0));
    },
  };
}

test("hash navigation belongs to the router; source metadata is added after bubbling", () => {
  const page = createPage();
  const event = page.click(new page.Anchor("#section"));
  assert.equal(event.defaultPrevented, false);
  assert.equal(page.navigations.length, 0);
  page.location.hash = "section";
  page.history.state = { index: 4, scrollY: 0, widget: "retained" };
  page.window.dispatchEvent(event);
  assert.deepEqual(page.history.state, {
    index: 4,
    scrollY: 0,
    widget: "retained",
    [key]: source,
  });
});

test("a custom hash handler keeps its existing metadata and creates no duplicate write", () => {
  const page = createPage();
  const event = page.click(new page.Anchor("#note"));
  event.preventDefault();
  page.location.hash = "note";
  page.history.state = { index: 4, sidenoteReference: "ref-2", [key]: source };
  page.window.dispatchEvent(event);
  assert.equal(page.writes.length, 0);
  assert.equal(page.history.state.sidenoteReference, "ref-2");
  assert.equal(page.navigations.length, 0);
});

test("reload, download, new-tab, modified and non-HTML links retain their own behavior", () => {
  const page = createPage();
  for (const attributes of [["data-astro-reload"], ["download"]])
    assert.equal(
      page.click(new page.Anchor("#note", { attributes })).defaultPrevented,
      false
    );
  assert.equal(
    page.click(new page.Anchor("#note", { target: "_blank" })).defaultPrevented,
    false
  );
  assert.equal(
    page.click(page.button, { ctrlKey: true }).defaultPrevented,
    false
  );
  assert.doesNotThrow(() => page.click(new page.Element()));
  assert.equal(page.navigations.length, 0);
  assert.equal(page.traversals.length, 0);
});

test("removing a hash or reopening the current URL retains the original source", () => {
  for (const href of [`${article}#section`, article]) {
    const page = createPage({ href });
    page.swap(article, "push", { index: 4 });
    assert.deepEqual(page.history.state[key], source);
    assert.equal(page.button.href, listing);
  }
});

test("departure captures the clicked viewport and raw tag name before preparation", () => {
  const page = createPage({
    href: listing,
    state: { index: 2 },
    tagName: "CodeFoces",
  });
  page.click(new page.Anchor(article));
  page.context.scrollY = 999;
  page.swap(article, "push", { index: 3 });
  assert.deepEqual(page.history.state[key], source);
});

test("native history traversal does not replace the destination entry's source", () => {
  const page = createPage();
  const restored = {
    index: 2,
    [key]: { href: `${origin}/moyu-suo/posts/2/`, x: 0, y: 900 },
  };
  page.swap(listing, "traverse", restored);
  assert.deepEqual(page.history.state, restored);
  assert.equal(page.writes.length, 0);
});

test("known router indices traverse directly; old copied indices use the URL fallback", () => {
  const page = createPage({ state: { index: 6, [key]: source } });
  assert.equal(page.click().defaultPrevented, true);
  assert.deepEqual(page.traversals, [-4]);
  assert.equal(page.navigations.length, 0);
  const legacy = createPage({
    state: { index: 6, [key]: { href: listing, x: 0, y: 450, index: 2 } },
  });
  legacy.click();
  assert.equal(legacy.traversals.length, 0);
  assert.deepEqual(legacy.navigations, [
    {
      href: listing,
      options: { history: "replace", info: { restoreScroll: true } },
    },
  ]);
});

test("invalid sources leave the static All posts link usable", () => {
  for (const invalid of [
    { ...source, href: "https://external.example/" },
    { ...source, href: `${origin}/moyu-suo-extra/posts/` },
    { ...source, href: "not a URL" },
    { ...source, href: `${article}#old-section` },
    { ...source, y: Infinity },
  ]) {
    const page = createPage({ state: { index: 3, [key]: invalid } });
    assert.equal(page.button.href, `${origin}/moyu-suo/posts/`);
    assert.equal(page.click().defaultPrevented, false);
  }
});

test("fallback restores the saved viewport after fonts and the scheduled frame", async () => {
  let fontsReady;
  const fonts = new Promise(resolve => {
    fontsReady = resolve;
  });
  const page = createPage({
    state: { index: 3, [key]: { href: listing, x: 0, y: 450 } },
    fonts,
  });
  page.click();
  page.swap(listing, "replace", { index: 3 });
  page.emit("astro:page-load");
  page.runFrames();
  assert.deepEqual(page.scrolls, []);
  fontsReady();
  // Await the next task: the VM's promise continuation crosses realms and may
  // not have completed after a single host Promise.resolve().
  await nextTask();
  assert.deepEqual(page.scrolls, []);
  page.runFrames();
  assert.deepEqual(page.scrolls, [{ left: 0, top: 450, behavior: "instant" }]);
});

test("late scroll restoration yields to same-document navigation", async () => {
  for (const changeBeforeFontLoad of [true, false]) {
    let fontsReady;
    const fonts = new Promise(resolve => {
      fontsReady = resolve;
    });
    const page = createPage({
      state: { index: 3, [key]: { href: listing, x: 0, y: 450 } },
      fonts,
    });
    page.click();
    page.swap(listing, "replace", { index: 3 });
    page.emit("astro:page-load");
    if (changeBeforeFontLoad) page.location.hash = "another-section";
    fontsReady();
    await nextTask();
    if (!changeBeforeFontLoad) page.location.hash = "another-section";
    page.runFrames();
    assert.deepEqual(page.scrolls, []);
  }
});
