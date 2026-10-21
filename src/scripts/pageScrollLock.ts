type InlineStyleSnapshot = {
  rootOverflowY: string;
  bodyOverflow: string;
  bodyWidth: string;
  bodyScrollbarGutter: string;
};

let lockCount = 0;
let previousStyles: InlineStyleSnapshot | undefined;
let resizeHandler: (() => void) | undefined;

/**
 * Share the viewport lock across independent overlays without shifting content.
 * While root scrolling is locked, reserve its usual gutter inside a viewport-wide
 * body. This module owns the temporary width/gutter and restores them on final release;
 * callers only own their idempotent release handles.
 */
export function acquirePageScrollLock(): () => void {
  if (lockCount === 0) {
    const root = document.documentElement;
    const body = document.body;
    previousStyles = {
      rootOverflowY: root.style.overflowY,
      bodyOverflow: body.style.overflow,
      bodyWidth: body.style.width,
      bodyScrollbarGutter: body.style.scrollbarGutter,
    };

    root.style.overflowY = "hidden";
    body.style.overflow = "hidden";
    body.style.scrollbarGutter = "stable";
    resizeHandler = () => {
      // CSS viewport units exclude classic scrollbars; innerWidth includes the
      // root gutter that the body now reserves internally.
      body.style.width = `${window.innerWidth}px`;
    };
    resizeHandler();
    window.addEventListener("resize", resizeHandler);
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount > 0 || !previousStyles) return;

    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    resizeHandler = undefined;
    document.documentElement.style.overflowY = previousStyles.rootOverflowY;
    document.body.style.overflow = previousStyles.bodyOverflow;
    document.body.style.width = previousStyles.bodyWidth;
    document.body.style.scrollbarGutter = previousStyles.bodyScrollbarGutter;
    previousStyles = undefined;
  };
}
