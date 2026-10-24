import { navigate } from "astro:transitions/client";
import { LANGS, getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";
import { tplStr } from "@/i18n/format";
import { getNavigationSegments, getReturnLabel } from "@/utils/navigation";

type ReturnLocation = {
  href: string;
  x: number;
  y: number;
  routerIndex?: number;
  tagName?: string;
};
type PendingNavigation = { href: string; source: ReturnLocation };

const RETURN_KEY = "moyu:return";
const sameDocumentClicks = new WeakMap<MouseEvent, PendingNavigation>();
let pendingNavigation: PendingNavigation | undefined;
let pendingScrollRestore: ReturnLocation | undefined;
let navigationRevision = 0;
let scrollRestoreFrame = 0;

function getRouterIndex(index: unknown): number | undefined {
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0
    ? index
    : undefined;
}

function isSameDocument(from: URL | Location, to: URL): boolean {
  return (
    from.origin === to.origin &&
    from.pathname === to.pathname &&
    from.search === to.search
  );
}

function isSiteUrl(url: URL): boolean {
  return (
    url.origin === location.origin &&
    getNavigationSegments({
      pathname: url.pathname,
      basePath: import.meta.env.BASE_URL,
    }) !== undefined
  );
}

function captureLocation(): ReturnLocation {
  return {
    href: location.href,
    x: scrollX,
    y: scrollY,
    tagName: document.querySelector<HTMLElement>("[data-navigation-tag]")
      ?.dataset.navigationTag,
    routerIndex: getRouterIndex(history.state?.index),
  };
}

function readReturnLocation(): ReturnLocation | undefined {
  const value: unknown = history.state?.[RETURN_KEY];
  if (!value || typeof value !== "object") return;
  const candidate = value as Partial<ReturnLocation>;
  if (
    typeof candidate.href !== "string" ||
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y)
  )
    return;
  try {
    const url = new URL(candidate.href);
    if (!isSiteUrl(url) || isSameDocument(location, url)) return;
    return {
      href: url.href,
      x: candidate.x,
      y: candidate.y,
      tagName:
        typeof candidate.tagName === "string" ? candidate.tagName : undefined,
      // The old `index` field could include duplicated footnote entries.
      // Such saved sources remain usable by URL, without guessing a traversal.
      routerIndex: getRouterIndex(candidate.routerIndex),
    };
  } catch {
    return;
  }
}

function updateReturnLink(): void {
  const button = document.querySelector<HTMLAnchorElement>("#back-button");
  const label = button?.querySelector<HTMLElement>("[data-return-label]");
  if (!button || !label) return;
  const previous = readReturnLocation();
  const destination = previous
    ? getReturnLabel({
        segments:
          getNavigationSegments({
            pathname: new URL(previous.href).pathname,
            basePath: import.meta.env.BASE_URL,
            locales: LANGS,
          }) ?? [],
        tagName: previous.tagName,
      })
    : { key: "navigation.postsDirectory", params: undefined };
  button.href = previous?.href ?? button.dataset.returnFallback ?? button.href;
  label.dataset.i18n = destination.key;
  if (destination.params)
    label.dataset.i18nParams = JSON.stringify(destination.params);
  else delete label.dataset.i18nParams;
  label.textContent = tplStr(
    getUIString(destination.key),
    destination.params ?? {}
  );
}

// State belongs to each browser entry, so reloads and traversals cannot pick up
// a later page's source. Search edits its current URL before this snapshot.
document.addEventListener("astro:before-preparation", event => {
  if (
    event.navigationType !== "push" ||
    pendingNavigation?.href !== event.to.href
  )
    pendingNavigation = undefined;
  navigationRevision += 1;
  if (scrollRestoreFrame) cancelAnimationFrame(scrollRestoreFrame);
  scrollRestoreFrame = 0;
  if (pendingScrollRestore?.href !== event.to.href)
    pendingScrollRestore = undefined;
});
document.addEventListener("astro:before-swap", event => {
  if (
    event.navigationType === "traverse" ||
    !event.newDocument.querySelector("[data-page-navigation]")
  ) {
    pendingNavigation = undefined;
    return;
  }
  // Removing a fragment or reopening the same URL can still swap documents.
  // Keep this page's source instead of making the page return to itself.
  if (isSameDocument(event.from, event.to)) {
    const source = readReturnLocation();
    pendingNavigation = source ? { href: event.to.href, source } : undefined;
    return;
  }
  if (event.navigationType !== "push") {
    pendingNavigation = undefined;
    return;
  }
  pendingNavigation ??= {
    href: event.to.href,
    source: captureLocation(),
  };
});
document.addEventListener("astro:after-swap", () => {
  if (pendingNavigation) {
    history.replaceState(
      { ...history.state, [RETURN_KEY]: pendingNavigation.source },
      ""
    );
    pendingNavigation = undefined;
  }
  updateReturnLink();
});

document.addEventListener(
  "click",
  event => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    )
      return;
    const link = event.target.closest("a[href]");
    if (
      !(link instanceof HTMLAnchorElement) ||
      link.hasAttribute("download") ||
      link.hasAttribute("data-astro-reload") ||
      (link.target && link.target !== "_self")
    )
      return;
    if (link.id !== "back-button") {
      const url = new URL(link.href);
      if (isSameDocument(location, url)) {
        const source = readReturnLocation();
        if (source) sameDocumentClicks.set(event, { href: url.href, source });
      } else if (isSiteUrl(url)) {
        // Preserve the clicked viewport while Astro prepares the next document.
        pendingNavigation = { href: link.href, source: captureLocation() };
      }
      return;
    }
    const previous = readReturnLocation();
    if (!previous) return; // Direct visits keep the static content-parent link.
    event.preventDefault();
    const currentIndex = getRouterIndex(history.state?.index);
    // Astro owns these optional indices and scroll restoration. If unavailable,
    // use its public navigate API and the saved position instead of guessing.
    if (
      currentIndex !== undefined &&
      previous.routerIndex !== undefined &&
      previous.routerIndex < currentIndex
    ) {
      history.go(previous.routerIndex - currentIndex);
    } else {
      pendingScrollRestore = previous;
      void navigate(previous.href, {
        history: "replace",
        info: { restoreScroll: true },
      });
    }
  },
  { capture: true }
);

// Run after article handlers and Astro's document listener have chosen how to
// navigate. Hash fast paths emit no swap events; add only our missing metadata.
window.addEventListener("click", event => {
  const pending = sameDocumentClicks.get(event);
  sameDocumentClicks.delete(event);
  if (
    pending?.href === location.href &&
    history.state &&
    !readReturnLocation()
  ) {
    history.replaceState(
      { ...history.state, [RETURN_KEY]: pending.source },
      ""
    );
  }
});

document.addEventListener("astro:page-load", async () => {
  updateReturnLink();
  if (!pendingScrollRestore || pendingScrollRestore.href !== location.href)
    return;
  const position = pendingScrollRestore;
  const revision = navigationRevision;
  pendingScrollRestore = undefined;
  await document.fonts.ready;
  if (revision !== navigationRevision || location.href !== position.href)
    return;
  scrollRestoreFrame = requestAnimationFrame(() => {
    scrollRestoreFrame = 0;
    if (revision === navigationRevision && location.href === position.href)
      window.scrollTo({
        left: position.x,
        top: position.y,
        behavior: "instant",
      });
  });
});
document.addEventListener(UI_LANGUAGE_CHANGE_EVENT, updateReturnLink);
updateReturnLink();
