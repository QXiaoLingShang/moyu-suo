import { getUIString } from "@/i18n/client";

/** Icons are trusted, bundled Tabler SVGs; labels always stay outside the SVG. */
export function createIconControl(
  labelKey: string,
  icon: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-preview-control";
  button.dataset.i18nAriaLabel = labelKey;
  button.setAttribute("aria-label", getUIString(labelKey));
  const glyph = document.createElement("span");
  glyph.className = "media-preview-icon";
  glyph.setAttribute("aria-hidden", "true");
  glyph.innerHTML = icon;
  button.append(glyph);
  return button;
}
