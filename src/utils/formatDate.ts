/** 文章/日期 UI 显示格式（服务端与客户端共用同一份，保证一致） */

export type UILang = "zh-CN" | "en";

const DATE_OPTIONS: Record<UILang, Intl.DateTimeFormatOptions> = {
  // 2026年9月3日
  "zh-CN": { year: "numeric", month: "long", day: "numeric" },
  // Sep 3, 2026
  en: { year: "numeric", month: "short", day: "numeric" },
};

export function formatDate(
  date: Date,
  timeZone: string,
  lang: UILang
): string {
  const text = new Intl.DateTimeFormat(lang === "zh-CN" ? "zh-CN" : "en-US", {
    ...DATE_OPTIONS[lang],
    timeZone,
  }).format(date);
  // 中文日期数字与年月日之间补空格，增强可读性：2026 年 9 月 3 日
  if (lang === "zh-CN") {
    return text
      .replace(/(\d+)(?=[年月日])/g, "$1 ")
      .replace(/([年月])(?=\d)/g, "$1 ");
  }
  return text;
}
