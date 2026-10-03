export function setupReadingProgress(): () => void {
  const container = document.createElement("div");
  container.className =
    "progress-container fixed top-0 z-10 h-1 w-full bg-background";
  container.setAttribute("aria-hidden", "true");

  const bar = document.createElement("div");
  bar.className = "progress-bar h-1 w-0 bg-accent";
  container.append(bar);
  document.body.append(container);

  const controller = new AbortController();
  let frame = 0;

  function update(): void {
    frame = 0;
    const root = document.documentElement;
    const scrollableHeight = root.scrollHeight - root.clientHeight;
    const scrollTop =
      window.scrollY || root.scrollTop || document.body.scrollTop;
    const progress =
      scrollableHeight > 0
        ? Math.min(100, Math.max(0, (scrollTop / scrollableHeight) * 100))
        : 0;
    bar.style.width = `${progress}%`;
  }

  function scheduleUpdate(): void {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", scheduleUpdate, {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener("resize", scheduleUpdate, {
    passive: true,
    signal: controller.signal,
  });
  scheduleUpdate();

  return () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
    container.remove();
  };
}
