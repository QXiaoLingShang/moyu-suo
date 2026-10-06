export function setupSiteHeader(): void {
  function toggleNav() {
    const menuBtn = document.querySelector<HTMLButtonElement>("#menu-btn");
    const menuItems = document.querySelector<HTMLUListElement>("#menu-items");
    const menuIcon = document.querySelector("#menu-icon");
    const closeIcon = document.querySelector("#close-icon");

    if (!menuBtn || !menuItems || !menuIcon || !closeIcon) return;
    const activeMenuButton = menuBtn;

    const navMenu = menuBtn.closest("nav");
    const moduleMenu = navMenu?.querySelector<HTMLElement>(
      ".site-nav__module-menu"
    );
    const moduleToggle = moduleMenu?.querySelector<HTMLButtonElement>(
      ".site-nav__module-trigger"
    );
    const modulePanel = moduleMenu?.querySelector<HTMLUListElement>(
      ".site-nav__module-panel"
    );
    const desktopQuery = window.matchMedia("(min-width: 40rem)");
    let isOpen = false;
    let isScrollLocked = false;
    let previousRootOverflowY = "";
    let previousBodyOverflow = "";
    let closeTimer: number | undefined;
    let transitionId = 0;

    function menuLabel(open: boolean): string {
      const language = document.documentElement.lang
        .toLowerCase()
        .startsWith("en")
        ? "en"
        : "zh";
      const languageSuffix = language === "en" ? "En" : "Zh";
      const key = open
        ? `labelClose${languageSuffix}`
        : `labelOpen${languageSuffix}`;
      return (
        activeMenuButton.dataset[key] ??
        (open
          ? activeMenuButton.dataset.labelClose
          : activeMenuButton.dataset.labelOpen) ??
        "Menu"
      );
    }

    function syncMenuLabel(): void {
      activeMenuButton.setAttribute(
        "aria-label",
        menuLabel(activeMenuButton.getAttribute("aria-expanded") === "true")
      );
    }

    function setModuleMenuOpen(open: boolean, restoreFocus = false): void {
      if (!moduleMenu || !moduleToggle || !modulePanel) return;
      moduleToggle.setAttribute("aria-expanded", String(open));
      moduleMenu.dataset.open = String(open);
      modulePanel.hidden = !open;
      if (!open && restoreFocus) moduleToggle.focus({ preventScroll: true });
    }

    const languageObserver = new MutationObserver(syncMenuLabel);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    function lockPageScroll() {
      if (!isScrollLocked) {
        previousRootOverflowY = document.documentElement.style.overflowY;
        previousBodyOverflow = document.body.style.overflow;
        isScrollLocked = true;
      }
      document.documentElement.style.overflowY = "hidden";
      document.body.style.overflow = "hidden";
    }

    function unlockPageScroll() {
      if (!isScrollLocked) return;
      document.documentElement.style.overflowY = previousRootOverflowY;
      document.body.style.overflow = previousBodyOverflow;
      isScrollLocked = false;
    }

    function finishClosing(expectedTransitionId: number) {
      if (isOpen || expectedTransitionId !== transitionId) return;
      unlockPageScroll();
      closeTimer = undefined;
    }

    const setMenuOpen = (
      open: boolean,
      restoreFocus = true,
      immediate = false
    ) => {
      if (open && desktopQuery.matches) return;
      if (open === isOpen && !(immediate && isScrollLocked)) return;

      isOpen = open;
      menuBtn.setAttribute("aria-expanded", String(open));
      syncMenuLabel();
      menuIcon.classList.toggle("hidden", open);
      closeIcon.classList.toggle("hidden", !open);

      if (open) {
        if (closeTimer !== undefined) {
          window.clearTimeout(closeTimer);
          closeTimer = undefined;
        }
        transitionId += 1;
        if (!desktopQuery.matches) lockPageScroll();
        menuItems.inert = false;
        menuItems.setAttribute("aria-hidden", "false");
        menuItems.classList.remove(
          "opacity-0",
          "translate-y-2",
          "pointer-events-none"
        );
        menuItems.classList.add(
          "opacity-100",
          "translate-y-0",
          "pointer-events-auto"
        );
        menuItems
          .querySelector<HTMLElement>("a[href], button:not(:disabled)")
          ?.focus();
        return;
      }

      menuItems.inert = true;
      menuItems.setAttribute("aria-hidden", "true");
      menuItems.classList.remove(
        "opacity-100",
        "translate-y-0",
        "pointer-events-auto"
      );
      menuItems.classList.add(
        "opacity-0",
        "translate-y-2",
        "pointer-events-none"
      );
      if (restoreFocus && menuBtn.isConnected) menuBtn.focus();

      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      const closingTransitionId = ++transitionId;
      if (
        immediate ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        finishClosing(closingTransitionId);
      } else {
        closeTimer = window.setTimeout(
          () => finishClosing(closingTransitionId),
          350
        );
      }
    };

    const syncBreakpoint = () => {
      if (desktopQuery.matches) {
        if (isOpen || isScrollLocked) setMenuOpen(false, false, true);
        menuItems.inert = false;
        menuItems.setAttribute("aria-hidden", "false");
      } else {
        setModuleMenuOpen(false);
        menuItems.inert = !isOpen;
        menuItems.setAttribute("aria-hidden", String(!isOpen));
      }
    };

    function handleKeyDown(event: KeyboardEvent) {
      // A nested popup may already have consumed Escape on document.
      if (event.key === "Escape" && event.defaultPrevented) return;

      const moduleIsOpen =
        moduleToggle?.getAttribute("aria-expanded") === "true";
      if (event.key === "Escape" && moduleIsOpen) {
        event.preventDefault();
        setModuleMenuOpen(false, true);
        return;
      }
      if (!isOpen) return;
      if (event.key === "Escape") {
        if (menuItems?.querySelector('[data-lang-switcher][data-open="true"]'))
          return;
        event.preventDefault();
        setMenuOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        moduleToggle?.getAttribute("aria-expanded") === "true" &&
        moduleMenu &&
        event.target instanceof Node &&
        !moduleMenu.contains(event.target)
      ) {
        setModuleMenuOpen(false);
      }

      if (
        !isOpen ||
        !desktopQuery.matches ||
        !(event.target instanceof Node) ||
        navMenu?.contains(event.target)
      )
        return;
      setMenuOpen(false, false);
    }

    menuBtn.addEventListener("click", () => setMenuOpen(!isOpen));
    moduleToggle?.addEventListener("click", () => {
      setModuleMenuOpen(moduleToggle.getAttribute("aria-expanded") !== "true");
    });
    menuItems.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        setMenuOpen(false, false);
      }
    });

    function cleanupBeforeSwap() {
      if (isOpen || isScrollLocked) setMenuOpen(false, false, true);
      setModuleMenuOpen(false);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      desktopQuery.removeEventListener("change", syncBreakpoint);
      languageObserver.disconnect();
    }

    syncBreakpoint();
    syncMenuLabel();
    navMenu?.setAttribute("data-enhanced", "true");
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("astro:before-swap", cleanupBeforeSwap, {
      once: true,
    });
    desktopQuery.addEventListener("change", syncBreakpoint);
  }

  function handleSkipToContent() {
    const skipLink = document.getElementById("skip-to-content");
    if (!skipLink) return;
    skipLink.addEventListener("click", e => {
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.button !== 0
      )
        return;
      e.preventDefault();
      const target = document.getElementById("main-content");
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          {
            once: true,
          }
        );
        target.focus();
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth";
        target.scrollIntoView({ behavior });
      }
    });
  }

  toggleNav();
  document.addEventListener("astro:after-swap", toggleNav);

  handleSkipToContent();
  document.addEventListener("astro:after-swap", handleSkipToContent);
}
