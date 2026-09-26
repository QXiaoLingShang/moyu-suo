export type FocusTarget = {
  key: HTMLElement;
  card: HTMLElement;
  top: number;
  baseStatic: boolean;
  regionKey: HTMLElement;
};

/** Decouple decoration from focus so rapid input never waits for an animation to finish. */
export function createSidenoteMotion(
  container: HTMLElement,
  reducedMotion: MediaQueryList
) {
  let previous: FocusTarget | null = null;
  let animation: Animation | null = null;
  let shadow: HTMLElement | null = null;

  function cancel() {
    animation?.cancel();
    animation = null;
    shadow?.remove();
    shadow = null;
  }

  function reset() {
    cancel();
    previous = null;
  }

  function update(
    next: FocusTarget | null,
    render: (moveDock: boolean) => void
  ) {
    const changed =
      previous?.key !== next?.key || previous?.baseStatic !== next?.baseStatic;
    const moved = previous?.top !== next?.top;
    const crossesRegion = previous?.regionKey !== next?.regionKey;
    // Skip a replacement shadow during interruption to avoid a trail of stale previews.
    const interrupted = !!animation;
    // Capture before rendering: reusing a view must not overwrite the origin.
    const source =
      changed &&
      previous &&
      next &&
      (previous.baseStatic || next.baseStatic || crossesRegion) &&
      !interrupted &&
      !reducedMotion.matches &&
      previous.card.isConnected
        ? previous.card
        : null;
    const sourceTop = source ? parseFloat(getComputedStyle(source).top) : 0;
    const copy = source ? (source.cloneNode(true) as HTMLElement) : null;
    if (changed || moved || reducedMotion.matches) cancel();

    // Within one dense region the dock moves directly. Region boundaries have
    // persistent representatives, so entering or leaving them uses a shadow.
    render(
      !!previous &&
        !!next &&
        !previous.baseStatic &&
        !next.baseStatic &&
        !crossesRegion &&
        (changed || !moved) &&
        !reducedMotion.matches
    );
    previous = next;

    if (!copy || !next || !Number.isFinite(sourceTop)) return;
    copy.classList.add("sidenote-transition-shadow");
    copy.dataset.preview = "shadow";
    copy.removeAttribute("data-focused");
    copy.removeAttribute("data-static");
    copy.removeAttribute("id");
    copy
      .querySelectorAll("[id]")
      .forEach(element => element.removeAttribute("id"));
    copy.style.top = `${sourceTop}px`;
    copy.style.pointerEvents = "none";
    copy.tabIndex = -1;
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    container.append(copy);
    shadow = copy;
    const distance = next.top - sourceTop;
    const running = copy.animate(
      [
        { transform: "translateY(0)", opacity: 0, filter: "blur(1.5px)" },
        {
          transform: `translateY(${distance * 0.18}px)`,
          opacity: 0.32,
          filter: "blur(1px)",
          offset: 0.18,
        },
        {
          transform: `translateY(${distance}px)`,
          opacity: 0,
          filter: "blur(1.5px)",
        },
      ],
      { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
    animation = running;
    running.onfinish = () => {
      copy.remove();
      if (animation === running) {
        animation = null;
        shadow = null;
      }
    };
  }

  return { update, reset };
}
