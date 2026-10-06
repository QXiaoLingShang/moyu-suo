const THEME_KEY = "theme";
const MANUAL_THEME_KEY = "theme-manual";
type Theme = "light" | "dark";
const LIGHT: Theme = "light";
const DARK: Theme = "dark";

function getManualTheme(): Theme | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(MANUAL_THEME_KEY);
    const legacyTheme = localStorage.getItem(THEME_KEY);
    if (legacyTheme !== null) localStorage.removeItem(THEME_KEY);
  } catch {
    // Storage may be unavailable; use the system preference for this session.
  }
  return stored === LIGHT || stored === DARK ? stored : null;
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK
    : LIGHT;
}

// Reuse the value already set by the inline FOUC-prevention script if available.
const storedTheme = getManualTheme();
let themeValue: Theme =
  (window as unknown as { __theme?: { value: Theme } }).__theme?.value ??
  storedTheme ??
  getSystemTheme();
let hasManualThemeChoice = storedTheme !== null;

function persist(): void {
  try {
    localStorage.setItem(MANUAL_THEME_KEY, themeValue);
    localStorage.removeItem(THEME_KEY);
  } catch {
    // Keep the selected theme for this page session if storage is unavailable.
  }
  reflect();
}

function reflect(): void {
  const root = document.firstElementChild;
  root?.setAttribute("data-theme", themeValue);
  root?.classList.toggle("dark", themeValue === DARK);
  document
    .querySelector("#theme-btn")
    ?.setAttribute("aria-pressed", String(themeValue === DARK));

  // Fill <meta name="theme-color"> with the computed background colour so
  // Android's browser chrome matches the page background.
  const bg = window.getComputedStyle(document.body).backgroundColor;
  document
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", bg);
}

function setup(): void {
  reflect();
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    themeValue = themeValue === LIGHT ? DARK : LIGHT;
    hasManualThemeChoice = true;
    persist();
  });
}

setup();

// Re-run after View Transitions navigation.
document.addEventListener("astro:after-swap", setup);

// Carry the theme-color value across View Transitions to prevent the
// Android navigation bar from flashing during page transitions.
document.addEventListener("astro:before-swap", event => {
  const color = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");
  if (color) {
    (event as { newDocument: Document }).newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", color);
  }
});

// Sync with OS-level dark/light preference changes.
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches }) => {
    if (hasManualThemeChoice) return;
    themeValue = matches ? DARK : LIGHT;
    reflect();
  });
