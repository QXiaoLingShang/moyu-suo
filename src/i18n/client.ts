/**
 * Client-side UI language switcher.
 *
 * 静态站只有一套页面（默认中文 UI，构建期由字典渲染）。
 * 本模块在浏览器端做"文案层切换"：localStorage 记偏好，
 * 遍历 data-i18n / data-i18n-title 标记替换文本与属性，
 * 并同步 <html lang> 与 document.title。
 *
 * 与服务器端无关：字典（en / zh-CN）全部随 bundle 打进客户端。
 */
import en from "./lang/en.ts";
import zhCN from "./lang/zh-CN.ts";
import { tplStr } from "./format.ts";
import { formatDate, formatShortDate } from "../utils/formatDate.ts";
import type { UILang } from "../utils/formatDate.ts";

export type LangCode = "zh-CN" | "en";

export const LANGS: LangCode[] = ["zh-CN", "en"];

const DICTS: Record<LangCode, typeof en> = {
  "zh-CN": zhCN,
  en,
};

export const OTHER: Record<LangCode, LangCode> = {
  "zh-CN": "en",
  en: "zh-CN",
};

const STORAGE_KEY = "blog-ui-lang";

/** Dynamic controls use this to refresh labels composed with page content. */
export const UI_LANGUAGE_CHANGE_EVENT = "ui:language-change";

function getByPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur && typeof cur === "object" && seg in cur) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return "";
    }
  }
  return typeof cur === "string" ? cur : "";
}

/** Parameters are content, so interpolate them only after selecting the UI template. */
function getTextParams(el: HTMLElement): Record<string, string | number> {
  const raw = el.getAttribute("data-i18n-params");
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === "string" || typeof value === "number"
      )
    );
  } catch {
    return {};
  }
}

let currentLang: LangCode = "zh-CN";

function readStored(): LangCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "zh-CN" ? v : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function getCurrentLang(): LangCode {
  return currentLang;
}

/** Read a UI phrase for controls that are created dynamically in the browser. */
export function getUIString(path: string): string {
  const documentLanguage = document.documentElement.lang;
  const language: LangCode =
    documentLanguage === "en" || documentLanguage === "zh-CN"
      ? documentLanguage
      : currentLang;
  return getByPath(DICTS[language], path);
}

export function getInitialLang(): LangCode {
  return readStored();
}

/** 把整页 UI 文案应用到指定语言（DOM 已按该语言渲染时安全无操作） */
export function applyLang(target: LangCode) {
  const dict = DICTS[target];

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const template = getByPath(dict, key);
    if (!template) return;
    const value =
      tplStr(template, getTextParams(el)) +
      (el.getAttribute("data-i18n-suffix") ?? "");
    if (el.textContent !== value) el.textContent = value;
  });

  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    const value = getByPath(dict, key);
    if (!value) return;
    el.setAttribute("title", value);
    el.setAttribute("aria-label", value);
  });

  document
    .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
    .forEach(el => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      const value = getByPath(dict, key);
      if (value) el.setAttribute("aria-label", value);
    });

  // 日期：按目标语言与元素自带时区重算（与 SSR 同规则，见 utils/formatDate）
  document.querySelectorAll<HTMLElement>("[data-i18n-date]").forEach(el => {
    const iso = el.getAttribute("datetime");
    const tz = el.getAttribute("data-tz") || undefined;
    if (!iso || !tz) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    el.textContent =
      el.dataset.i18nDateFormat === "short"
        ? formatShortDate(d, tz, target as UILang)
        : formatDate(d, tz, target as UILang);
  });

  document.documentElement.lang = target === "en" ? "en" : "zh-CN";

  currentLang = target;
  document.dispatchEvent(new Event(UI_LANGUAGE_CHANGE_EVENT));
}

export function setLang(target: LangCode) {
  const changed = target !== currentLang;
  if (changed) applyLang(target);
  try {
    localStorage.setItem(STORAGE_KEY, target);
  } catch {
    /* 隐私模式等场景忽略 */
  }
  const switcher = document.querySelector<HTMLElement>("[data-lang-switcher]");
  const currentLabel = switcher?.querySelector<HTMLElement>(
    "[data-lang-current]"
  );
  if (currentLabel) currentLabel.textContent = target === "zh-CN" ? "中" : "EN";
  switcher
    ?.querySelectorAll<HTMLButtonElement>("[data-lang-option]")
    .forEach(option => {
      const selected = option.dataset.langOption === target;
      option.dataset.selected = String(selected);
      option.setAttribute("aria-pressed", String(selected));
    });

  // Pagefind 无运行时 i18n：搜索页切换语言后重载一次以按新语言重建 UI
  if (changed && document.querySelector(".pagefind-ui")) {
    window.location.reload();
  }
}

export function toggleLang() {
  setLang(currentLang === "zh-CN" ? "en" : "zh-CN");
}

/** 页面加载 / 视图切换(astro:after-swap)后调用：还原已保存的语言 */
export function restoreLang() {
  const stored = readStored();
  applyLang(stored);
  // Apply also updates the visible selected language and its pressed state.
  setLang(stored);
}

let langSwitcherEvents: AbortController | undefined;

export function setupLangSwitcher() {
  restoreLang();
  langSwitcherEvents?.abort();

  const switcher = document.querySelector<HTMLElement>("[data-lang-switcher]");
  const toggle =
    switcher?.querySelector<HTMLButtonElement>("[data-lang-toggle]");
  const menu = switcher?.querySelector<HTMLElement>("[data-lang-menu]");
  if (!switcher || !toggle || !menu) return;

  const activeSwitcher = switcher;
  const toggleButton = toggle;
  const optionMenu = menu;
  const controller = new AbortController();
  const { signal } = controller;
  langSwitcherEvents = controller;

  function setMenuOpen(open: boolean, restoreFocus = false) {
    activeSwitcher.dataset.open = String(open);
    toggleButton.setAttribute("aria-expanded", String(open));
    optionMenu.hidden = !open;
    if (!open && restoreFocus) toggleButton.focus({ preventScroll: true });
  }

  toggleButton.addEventListener(
    "click",
    () => {
      setMenuOpen(toggleButton.getAttribute("aria-expanded") !== "true");
    },
    { signal }
  );

  activeSwitcher.addEventListener(
    "click",
    event => {
      const target = event.target;
      const option =
        target instanceof Element
          ? target.closest<HTMLButtonElement>("[data-lang-option]")
          : null;
      const language = option?.dataset.langOption;
      if (
        !option ||
        !activeSwitcher.contains(option) ||
        (language !== "zh-CN" && language !== "en")
      )
        return;

      setLang(language);
      setMenuOpen(false, true);
    },
    { signal }
  );

  document.addEventListener(
    "pointerdown",
    event => {
      if (
        activeSwitcher.dataset.open === "true" &&
        event.target instanceof Node &&
        !activeSwitcher.contains(event.target)
      )
        setMenuOpen(false);
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape" || activeSwitcher.dataset.open !== "true")
        return;
      event.preventDefault();
      setMenuOpen(false, true);
    },
    { signal }
  );

  document.addEventListener(
    "astro:before-swap",
    () => {
      setMenuOpen(false);
      controller.abort();
      if (langSwitcherEvents === controller) langSwitcherEvents = undefined;
    },
    { once: true }
  );
}
