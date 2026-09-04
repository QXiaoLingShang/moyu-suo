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
import { formatDate } from "@/utils/formatDate";
import type { UILang } from "@/utils/formatDate";

export type LangCode = "zh-CN" | "en";

export const LANGS: LangCode[] = ["zh-CN", "en"];

const DICTS: Record<LangCode, typeof en> = {
  "zh-CN": zhCN,
  en,
};

/** 目标语言的母语自称，用于 title / aria-label（语言无关，两语用户都懂） */
function titleOf(current: LangCode): string {
  return current === "zh-CN" ? "English" : "中文";
}

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

function collectLeafValues(dict: object): string[] {
  const out: string[] = [];
  const walk = (node: object) => {
    for (const v of Object.values(node)) {
      if (typeof v === "string") out.push(v);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(dict);
  return out;
}

/** 文档标题短语替换：源语言叶子值（长→短）→ 目标语言叶子值 */
function swapDocumentTitle(from: LangCode, to: LangCode) {
  const fromValues = collectLeafValues(DICTS[from]);
  const toValues = collectLeafValues(DICTS[to]);
  const pairs = fromValues
    .map((f, i) => ({ f, t: toValues[i] }))
    .filter(p => p.f && p.t && p.f !== p.t)
    .sort((a, b) => b.f.length - a.f.length);
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

  const fromCode: LangCode = target === "en" ? "zh-CN" : "en";
  const fromValues = collectLeafValues(DICTS[fromCode]);
  const toValues = collectLeafValues(DICTS[target]);
  const pairs = fromValues
    .map((f, i) => ({ f, t: toValues[i] }))
    .filter(p => p.f && p.t && p.f !== p.t)
    .sort((a, b) => b.f.length - a.f.length);

  document
    .querySelectorAll<HTMLElement>("[data-i18n-phrase]")
    .forEach(el => phraseReplace(el, pairs));

  // 日期：按目标语言与元素自带时区重算（与 SSR 同规则，见 utils/formatDate）
  document.querySelectorAll<HTMLElement>("[data-i18n-date]").forEach(el => {
    const iso = el.getAttribute("datetime");
    const tz = el.getAttribute("data-tz") || undefined;
    if (!iso || !tz) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    el.textContent = formatDate(d, tz, target as UILang);
  });

  document.documentElement.lang = target === "en" ? "en" : "zh-CN";
  swapDocumentTitle(fromCode, target);

  currentLang = target;
}

export function setLang(target: LangCode) {
  if (target !== currentLang) applyLang(target);
  try {
    localStorage.setItem(STORAGE_KEY, target);
  } catch {
    /* 隐私模式等场景忽略 */
  }
  const button = document.querySelector<HTMLElement>("[data-lang-btn]");
  if (button) {
    const label = button.querySelector("[data-lang-label]");
    if (label) label.textContent = target === "zh-CN" ? "EN" : "中";
    const t = titleOf(target);
    button.title = t;
    button.setAttribute("aria-label", t);
  }

  // Pagefind 无运行时 i18n：搜索页切换语言后重载一次以按新语言重建 UI
  if (document.querySelector(".pagefind-ui")) {
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
  // 让按钮文字与状态一致（即使无需换文案）
  setLang(stored);
}

export function setupLangSwitcher() {
  restoreLang();
  document.querySelector("[data-lang-btn]")?.addEventListener("click", () => {
    toggleLang();
  });
}
