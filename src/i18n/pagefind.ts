/**
 * Pagefind UI 文案（默认 UI 无简体中文内置，仅 en 及若干 zh 方言）。
 * 通过 PagefindUI({ translations }) 覆盖；键位取自其内置 en 串。
 * 语言：跟随站点当前 UI 语言，EN 走内置英文（无需覆盖）。
 */
import type { UILang } from "@/utils/formatDate";

export type PagefindStrings = Record<string, string>;

const zh: PagefindStrings = {
  placeholder: "搜索文章……",
  clear_search: "清除",
  load_more: "加载更多结果",
  search_label: "搜索本站",
  filters_label: "筛选",
  zero_results: "没有与 [SEARCH_TERM] 相关的结果",
  many_results: "[COUNT] 条与 [SEARCH_TERM] 相关的结果",
  one_result: "[COUNT] 条与 [SEARCH_TERM] 相关的结果",
  total_zero_results: "无结果",
  total_one_result: "共 [COUNT] 条结果",
  total_many_results: "共 [COUNT] 条结果",
  alt_search:
    "没有与 [SEARCH_TERM] 相关的结果，已改为显示 [DIFFERENT_TERM] 的结果",
  search_suggestion: "没有与 [SEARCH_TERM] 相关的结果，试试以下关键词：",
  searching: "正在搜索 [SEARCH_TERM]……",
  results_label: "搜索结果",
  keyboard_navigate: "导航",
  keyboard_select: "选择",
  keyboard_clear: "清除",
  keyboard_close: "关闭",
  keyboard_search: "搜索",
  error_search: "搜索失败",
  filter_selected_one: "已选 [COUNT] 项",
  filter_selected_many: "已选 [COUNT] 项",
  input_hint: "输入时实时显示结果",
  loading: "加载中",
};

export function pagefindTranslations(
  lang: UILang
): PagefindStrings | undefined {
  return lang === "zh-CN" ? zh : undefined;
}
