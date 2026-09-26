/** Shared with the image viewer so nested scroll locks close in order. */
export const NOTE_DIALOG_BEFORE_CLOSE = "sidenote:before-close";

export function fragmentId(hash: string): string {
  const fragment = hash.replace(/^#/, "");
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

export function isElementVisible(element: HTMLElement): boolean {
  if (element.closest("[hidden]")) return false;
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (
      parent instanceof HTMLDetailsElement &&
      !parent.open &&
      !parent.querySelector(":scope > summary")?.contains(element)
    )
      return false;
  }
  return (
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible"
  );
}
