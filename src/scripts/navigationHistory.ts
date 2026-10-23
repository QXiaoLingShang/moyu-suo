import { navigate } from "astro:transitions/client";

type ReturnLocation = {
  href: string;
  x: number;
  y: number;
  index?: number;
};

const RETURN_KEY = "moyu:return";
let source: ReturnLocation | undefined;
let articleReturn: ReturnLocation | undefined;
let restore: ReturnLocation | undefined;
let revision = 0;
let restoreFrame = 0;

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
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
    if (url.origin !== location.origin || !url.pathname.startsWith(base))
      return;
    return {
      href: url.href,
      x: candidate.x,
      y: candidate.y,
      index:
        typeof candidate.index === "number" &&
        Number.isInteger(candidate.index) &&
        candidate.index >= 0
          ? candidate.index
          : undefined,
    };
  } catch {
    return;
  }
}

function updateReturnLink(): void {
  const button = document.querySelector<HTMLAnchorElement>("#back-button");
  const previous = readReturnLocation() ?? articleReturn;
  if (button && previous) button.href = previous.href;
}

function isArticlePath(href: string): boolean {
  const path = new URL(href).pathname;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  if (!path.startsWith(base)) return false;
  const relative = path.slice(base.length).replace(/\/+$/, "");
  return /^posts\/(?!\d+$)[^/]+(?:\/|$)/.test(relative);
}

// State belongs to each browser entry, so reloads and traversals cannot pick up
// a later page's source. Search edits its current URL before this snapshot.
document.addEventListener("astro:before-preparation", event => {
  if (!isArticlePath(event.to.href)) source = undefined;
  revision += 1;
  if (restoreFrame) cancelAnimationFrame(restoreFrame);
  restoreFrame = 0;
  if (restore?.href !== event.to.href) restore = undefined;
});
document.addEventListener("astro:before-swap", event => {
  if (
    event.navigationType !== "push" ||
    !event.newDocument.querySelector("#article")
  )
    return;
  source ??= {
    href: location.href,
    x: scrollX,
    y: scrollY,
    index: Number.isInteger(history.state?.index)
      ? history.state.index
      : undefined,
  };
});
document.addEventListener("astro:after-swap", () => {
  if (source) {
    history.replaceState({ ...history.state, [RETURN_KEY]: source }, "");
    source = undefined;
  }
  articleReturn = readReturnLocation();
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
    const previous = readReturnLocation() ?? articleReturn;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    if (isArticlePath(link.href) && !document.querySelector("#article")) {
      // Capture before Astro starts fetching the destination. The page may scroll
      // or settle while preparation is in flight, but this is the user's source.
      source = {
        href: location.href,
        x: scrollX,
        y: scrollY,
        index:
          typeof history.state?.index === "number" &&
          Number.isInteger(history.state.index)
            ? history.state.index
            : undefined,
      };
    }
    if (link.id !== "back-button") {
      // Astro's same-document fast path emits no swap events. Carry metadata
      // through its public state option instead of writing incomplete hash state.
      if (
        previous &&
        document.querySelector("#article") &&
        link.hash &&
        link.origin === location.origin &&
        link.pathname === location.pathname &&
        link.search === location.search
      ) {
        event.preventDefault();
        void navigate(link.href, {
          state: { ...history.state, [RETURN_KEY]: previous },
        });
      }
      return;
    }
    if (!previous) return; // Keep the static Blog link for direct visits/new tabs.
    event.preventDefault();
    const currentIndex: unknown = history.state?.index;
    // Astro owns these optional indices and scroll restoration. If unavailable,
    // use its public navigate API and the saved position instead of guessing.
    if (
      typeof currentIndex === "number" &&
      Number.isInteger(currentIndex) &&
      previous.index !== undefined &&
      previous.index < currentIndex
    ) {
      history.go(previous.index - currentIndex);
    } else {
      restore = previous;
      void navigate(previous.href, {
        history: "replace",
        info: { restoreScroll: true },
      });
    }
  },
  { capture: true }
);

document.addEventListener("astro:page-load", async () => {
  articleReturn = readReturnLocation();
  updateReturnLink();
  if (!restore || restore.href !== location.href) return;
  const position = restore;
  const version = revision;
  restore = undefined;
  await document.fonts.ready;
  if (version !== revision) return;
  restoreFrame = requestAnimationFrame(() => {
    restoreFrame = 0;
    if (version === revision)
      window.scrollTo({
        left: position.x,
        top: position.y,
        behavior: "instant",
      });
  });
});
updateReturnLink();
