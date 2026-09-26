import { bindReadingFocusControls } from "./controls";
import { createPointerFocus } from "./pointer-focus";
import { readPreferences, savePreferences } from "./preferences";
import { createTargetHighlight } from "./target-highlight";

function enhanceReadingFocus(article: HTMLElement): () => void {
  const toolbar = document.querySelector<HTMLElement>(".reading-focus-toolbar");
  const menu = toolbar?.querySelector<HTMLDetailsElement>(
    "#reading-focus-menu"
  );
  if (!toolbar || !menu) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  let preferences = readPreferences(article);
  let dirty = false;
  let appliedHeadingOffset = preferences.headingOffsetPercent;
  const pointerFocus = createPointerFocus({
    article,
    signal,
    getPreferences: () => preferences,
    isSuspended: () => menu.open,
  });
  const targetHighlight = createTargetHighlight({
    article,
    signal,
    isEnabled: () => preferences.highlightTocTarget,
    getDuration: () => preferences.highlightDuration,
  });

  function commitPreferences(): void {
    if (!dirty) return;
    if (appliedHeadingOffset !== preferences.headingOffsetPercent) {
      article.style.setProperty(
        "--reading-focus-heading-offset",
        `${preferences.headingOffsetPercent}vh`
      );
      appliedHeadingOffset = preferences.headingOffsetPercent;
    }
    savePreferences(preferences);
    dirty = false;
  }

  bindReadingFocusControls({
    toolbar,
    menu,
    signal,
    initialPreferences: preferences,
    onInput: patch => {
      preferences = { ...preferences, ...patch };
      dirty = true;
      if (patch.highlightTocTarget === false) targetHighlight.clear();
      if ("enabled" in patch || "style" in patch) pointerFocus.refresh();
    },
    onCommit: commitPreferences,
    onToggle: () => pointerFocus.refresh(),
  });
  article.style.setProperty(
    "--reading-focus-heading-offset",
    `${preferences.headingOffsetPercent}vh`
  );
  pointerFocus.refresh();

  return () => {
    commitPreferences();
    controller.abort();
    article.style.removeProperty("--reading-focus-heading-offset");
  };
}

let currentArticle: HTMLElement | null = null;
let cleanup: (() => void) | undefined;

function setupReadingFocus(): void {
  const article = document.querySelector<HTMLElement>(
    '#article[data-reading-focus="true"]'
  );
  if (article === currentArticle) return;
  cleanup?.();
  currentArticle = article;
  cleanup = article ? enhanceReadingFocus(article) : undefined;
}

setupReadingFocus();
document.addEventListener("astro:page-load", setupReadingFocus);
document.addEventListener("astro:before-swap", () => {
  cleanup?.();
  cleanup = undefined;
  currentArticle = null;
});
