import { getInitialLang, getUIString } from "@/i18n/client";
import { pagefindTranslations } from "@/i18n/pagefind";

const initializingSearchElements = new WeakSet<HTMLElement>();
const initializedSearchElements = new WeakSet<HTMLElement>();

function isCurrentSearchElement(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    document.querySelector("#pagefind-search") === element
  );
}

function initSearch() {
  const pageFindSearch: HTMLElement | null =
    document.querySelector("#pagefind-search");

  if (!pageFindSearch || !isCurrentSearchElement(pageFindSearch)) return;
  if (
    initializedSearchElements.has(pageFindSearch) ||
    initializingSearchElements.has(pageFindSearch)
  )
    return;
  if (pageFindSearch.querySelector("form")) {
    initializedSearchElements.add(pageFindSearch);
    return;
  }

  const bundlePath = pageFindSearch?.dataset?.bundlePath;
  if (!bundlePath) return;

  const params = new URLSearchParams(window.location.search);

  const onIdle = window.requestIdleCallback || (cb => setTimeout(cb, 1));

  onIdle(async () => {
    if (initializingSearchElements.has(pageFindSearch)) return;
    initializingSearchElements.add(pageFindSearch);

    try {
      if (!isCurrentSearchElement(pageFindSearch)) return;
      if (import.meta.env.DEV) {
        const bundleBase = new URL(bundlePath, document.baseURI);
        let hasIndex = false;
        try {
          const response = await fetch(new URL("pagefind.js", bundleBase), {
            method: "HEAD",
            cache: "no-store",
          });
          hasIndex = response.ok;
        } catch {
          // A missing local index is expected until the site has been built.
        }

        if (!isCurrentSearchElement(pageFindSearch)) return;
        if (!hasIndex) {
          const warning = document.createElement("div");
          warning.className = "bg-muted/75 mb-4 space-y-4 rounded p-4";
          warning.setAttribute("role", "status");
          const message = document.createElement("p");
          message.dataset.i18n = "pages.searchIndexUnavailable";
          message.textContent = getUIString("pages.searchIndexUnavailable");
          const command = document.createElement("code");
          command.className = "block rounded bg-black px-2 py-1 text-white";
          command.textContent = "pnpm build";
          warning.append(message, command);
          pageFindSearch.replaceChildren(warning);
          return;
        }
      }

      if (!isCurrentSearchElement(pageFindSearch)) return;
      // @ts-expect-error — Missing types for @pagefind/default-ui package.
      const { PagefindUI } = await import("@pagefind/default-ui");
      // The route may have changed while the UI bundle was loading.
      if (!isCurrentSearchElement(pageFindSearch)) return;
      if (pageFindSearch.querySelector("form")) {
        initializedSearchElements.add(pageFindSearch);
        return;
      }

      const search = new PagefindUI({
        element: "#pagefind-search",
        bundlePath,
        showImages: false,
        showSubResults: true,
        // Pagefind needs our dictionary for Simplified Chinese UI labels.
        translations: pagefindTranslations(getInitialLang()),
        processTerm: function (term: string) {
          params.set("q", term);
          history.replaceState(history.state, "", "?" + params.toString());

          return term;
        },
      });
      initializedSearchElements.add(pageFindSearch);

      const query = params.get("q");
      if (query) {
        search.triggerSearch(query);
      }

      const searchInput = document.querySelector(".pagefind-ui__search-input");
      const clearButton = document.querySelector(".pagefind-ui__search-clear");
      searchInput?.addEventListener("input", resetSearchParam);
      clearButton?.addEventListener("click", resetSearchParam);

      function resetSearchParam(e: Event) {
        if ((e.target as HTMLInputElement)?.value.trim() === "") {
          history.replaceState(history.state, "", window.location.pathname);
        }
      }
    } finally {
      initializingSearchElements.delete(pageFindSearch);
    }
  });
}

document.addEventListener("astro:after-swap", () => {
  const pagefindSearch = document.querySelector("#pagefind-search");

  if (pagefindSearch && pagefindSearch.querySelector("form")) return;

  initSearch();
});
initSearch();
