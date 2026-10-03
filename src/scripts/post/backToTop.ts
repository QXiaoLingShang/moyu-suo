export function setupBackToTop(): () => void {
  const container = document.getElementById("btt-btn-container");
  const button = container?.querySelector<HTMLButtonElement>(
    "[data-button='back-to-top']"
  );
  const progressIndicator = container?.querySelector<HTMLElement>(
    "#progress-indicator"
  );
  if (!container || !button || !progressIndicator) return () => {};
  const buttonContainer = container;
  const backToTopButton = button;
  const indicator = progressIndicator;

  const controller = new AbortController();
  const { signal } = controller;
  const root = document.documentElement;
  let lastVisible: boolean | undefined;
  let frame = 0;

  function update(): void {
    frame = 0;
    const scrollTotal = root.scrollHeight - root.clientHeight;
    const scrollTop =
      window.scrollY || root.scrollTop || document.body.scrollTop;
    const scrollPercent =
      scrollTotal > 0 ? Math.floor((scrollTop / scrollTotal) * 100) : 0;
    const boundedPercent = Math.min(100, Math.max(0, scrollPercent));

    indicator.style.setProperty(
      "background-image",
      `conic-gradient(var(--accent), var(--accent) ${boundedPercent}%, transparent ${boundedPercent}%)`
    );

    const isVisible = scrollTotal > 0 && scrollTop / scrollTotal > 0.3;
    if (isVisible === lastVisible) return;
    buttonContainer.classList.toggle("opacity-100", isVisible);
    buttonContainer.classList.toggle("translate-y-0", isVisible);
    buttonContainer.classList.toggle("opacity-0", !isVisible);
    buttonContainer.classList.toggle("translate-y-14", !isVisible);
    lastVisible = isVisible;
  }

  function scheduleUpdate(): void {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  backToTopButton.addEventListener(
    "click",
    () => {
      document.body.scrollTop = 0;
      root.scrollTop = 0;
    },
    { signal }
  );
  document.addEventListener("scroll", scheduleUpdate, {
    passive: true,
    signal,
  });
  scheduleUpdate();

  return () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
  };
}
