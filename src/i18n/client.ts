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
import en from "./lang/en";
import zhCN from "./lang/zh-CN";
import { formatDate, formatShortDate } from "@/utils/formatDate";
import type { UILang } from "@/utils/formatDate";

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

type PhrasePair = { path: string; f: string; t: string };

function collectLeafEntries(dict: object): Map<string, string> {
  const entries = new Map<string, string>();
  const walk = (node: object, parentPath = "") => {
    for (const [key, value] of Object.entries(node)) {
      const path = parentPath ? `${parentPath}.${key}` : key;
      if (typeof value === "string") entries.set(path, value);
      else if (value && typeof value === "object") walk(value, path);
    }
  };
  walk(dict);
  return entries;
}

function getPhrasePairs(
  from: LangCode,
  to: LangCode,
  preferredPath?: string
): PhrasePair[] {
  const source = collectLeafEntries(DICTS[from]);
  const target = collectLeafEntries(DICTS[to]);
  return [...source.entries()]
    .flatMap(([path, f]) => {
      const t = target.get(path);
      return t && f !== t ? [{ path, f, t }] : [];
    })
    .sort((a, b) => {
      const lengthOrder = b.f.length - a.f.length;
      if (lengthOrder !== 0) return lengthOrder;
      if (a.path === preferredPath) return -1;
      if (b.path === preferredPath) return 1;
      return 0;
    });
}

/** 文档标题短语替换：源语言叶子值（长→短）→ 目标语言叶子值 */
function swapDocumentTitle(from: LangCode, to: LangCode) {
  const preferredPath = document
    .querySelector("title")
    ?.getAttribute("data-i18n-phrase-key");
  const pairs = getPhrasePairs(from, to, preferredPath || undefined);
  let title = document.title;
  for (const { f, t } of pairs) {
    if (title.includes(f)) title = title.split(f).join(t);
  }
  document.title = title;
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

export function getInitialLang(): LangCode {
  return readStored();
}

/**
 * 短语替换：把容器内文本节点里出现的「源语言字典叶子值」整体替换为目标值。
 * 用于面包屑这类「字典词 + 数字/括号/内容词」拼接的场景，长词优先避免子串误伤。
 */
function phraseReplace(el: HTMLElement, pairs: { f: string; t: string }[]) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    let text = node.data;
    for (const { f, t } of pairs) {
      if (text.includes(f)) text = text.split(f).join(t);
    }
    if (text !== node.data) node.data = text;
  }
}

/** 把整页 UI 文案应用到指定语言（DOM 已按该语言渲染时安全无操作） */
export function applyLang(target: LangCode) {
  const dict = DICTS[target];

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const value = getByPath(dict, key);
    if (value && el.textContent !== value) el.textContent = value;
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

  const fromCode: LangCode = target === "en" ? "zh-CN" : "en";
  const pairs = getPhrasePairs(fromCode, target);

  document.querySelectorAll<HTMLElement>("[data-i18n-phrase]").forEach(el => {
    const preferredPath = el.dataset.i18nPhraseKey;
    phraseReplace(
      el,
      preferredPath ? getPhrasePairs(fromCode, target, preferredPath) : pairs
    );
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
  swapDocumentTitle(fromCode, target);

  currentLang = target;
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
