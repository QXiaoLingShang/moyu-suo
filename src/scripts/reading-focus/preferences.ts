import type { ReadingFocusStyle } from "@/types/config";

export type ReadingFocusPreferences = {
  enabled: boolean;
  style: ReadingFocusStyle;
  highlightTocTarget: boolean;
  highlightDuration: number;
  headingOffsetPercent: number;
};

const STORAGE_KEY = "moyu-reading-focus:v1";
let sessionPreferences: ReadingFocusPreferences | undefined;
let hasUnsavedPreferences = false;

function boundedNumber(
  value: unknown,
  {
    fallback,
    min,
    max,
    step = 1,
  }: {
    fallback: number;
    min: number;
    max: number;
    step?: number;
  }
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value / step) * step))
    : fallback;
}

export function isReadingFocusStyle(
  value: unknown
): value is ReadingFocusStyle {
  return value === "left" || value === "right" || value === "block";
}

export function readPreferences(article: HTMLElement): ReadingFocusPreferences {
  const defaults: ReadingFocusPreferences = {
    enabled: article.dataset.readingFocusDefault === "true",
    style: isReadingFocusStyle(article.dataset.readingFocusStyle)
      ? article.dataset.readingFocusStyle
      : "left",
    highlightTocTarget: article.dataset.readingFocusTocHighlight === "true",
    highlightDuration: boundedNumber(
      Number(article.dataset.readingFocusDuration),
      { fallback: 4000, min: 2000, max: 8000, step: 1000 }
    ),
    headingOffsetPercent: boundedNumber(
      Number(article.dataset.readingFocusOffset),
      { fallback: 22, min: 10, max: 40 }
    ),
  };
  // A failed write must not let an older stored value override the reader's latest choice.
  if (hasUnsavedPreferences && sessionPreferences)
    return { ...sessionPreferences };
  let stored: unknown = sessionPreferences;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    stored = undefined;
    if (value) {
      try {
        stored = JSON.parse(value);
      } catch {
        return defaults;
      }
    }
  } catch {
    // Keep choices across Astro navigation even when browser storage is blocked.
  }
  if (!stored || typeof stored !== "object") return defaults;
  const values = stored as Partial<ReadingFocusPreferences>;
  return {
    enabled:
      typeof values.enabled === "boolean" ? values.enabled : defaults.enabled,
    style: isReadingFocusStyle(values.style) ? values.style : defaults.style,
    highlightTocTarget:
      typeof values.highlightTocTarget === "boolean"
        ? values.highlightTocTarget
        : defaults.highlightTocTarget,
    highlightDuration: boundedNumber(values.highlightDuration, {
      fallback: defaults.highlightDuration,
      min: 2000,
      max: 8000,
      step: 1000,
    }),
    headingOffsetPercent: boundedNumber(values.headingOffsetPercent, {
      fallback: defaults.headingOffsetPercent,
      min: 10,
      max: 40,
    }),
  };
}

export function savePreferences(preferences: ReadingFocusPreferences): void {
  sessionPreferences = { ...preferences };
  hasUnsavedPreferences = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    hasUnsavedPreferences = false;
  } catch {
    // The controls remain usable for this browsing session.
  }
}
