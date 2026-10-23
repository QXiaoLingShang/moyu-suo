const DRAG_THRESHOLD = 5;
const WHEEL_IDLE_MS = 140;

/** Own the reel's input, capture, observation and pending frames as one lifetime. */
export function setupPaginationReel(reel: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;
  const options = [
    ...reel.querySelectorAll<HTMLAnchorElement>(".pagination-option"),
  ];
  const direction = getComputedStyle(reel).direction === "rtl" ? -1 : 1;
  let reelWidth = 0;
  let canScroll = false;
  let dragFrame = 0;
  let wheelFrame = 0;
  let wheelDelta = 0;
  let wheelEnd = 0;
  let pointerId: number | undefined;
  let startX = 0;
  let latestX = 0;
  let startScroll = 0;
  let dragged = false;

  function measure(): void {
    reelWidth = reel.clientWidth;
    canScroll = reel.scrollWidth > reelWidth + 1;
  }
  function focus(option: HTMLAnchorElement): void {
    // Physical geometry also works with RTL's negative scrollLeft coordinates.
    const itemBounds = option.getBoundingClientRect();
    const reelBounds = reel.getBoundingClientRect();
    reel.scrollLeft +=
      itemBounds.left +
      itemBounds.width / 2 -
      (reelBounds.left + reelBounds.width / 2);
    option.focus({ preventScroll: true });
  }
  function finishDrag(event?: PointerEvent): void {
    if (pointerId === undefined || (event && event.pointerId !== pointerId))
      return;
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    if (dragged) reel.scrollLeft = startScroll - (latestX - startX);
    const id = pointerId;
    pointerId = undefined;
    if (reel.hasPointerCapture(id)) reel.releasePointerCapture(id);
    delete reel.dataset.dragging;
  }
  function stop(): void {
    finishDrag();
    dragged = false;
    clearTimeout(wheelEnd);
    wheelEnd = 0;
    if (wheelFrame) cancelAnimationFrame(wheelFrame);
    wheelFrame = 0;
    wheelDelta = 0;
    delete reel.dataset.wheeling;
  }

  const observer = new ResizeObserver(measure);
  observer.observe(reel);
  reel.addEventListener(
    "wheel",
    event => {
      if (
        !canScroll ||
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      event.preventDefault();
      if (!wheelEnd) reel.dataset.wheeling = "";
      clearTimeout(wheelEnd);
      wheelEnd = window.setTimeout(() => {
        wheelEnd = 0;
        delete reel.dataset.wheeling;
      }, WHEEL_IDLE_MS);
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? reelWidth : 1;
      wheelDelta += event.deltaY * unit * direction;
      if (wheelFrame) return;
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = 0;
        reel.scrollLeft += wheelDelta;
        wheelDelta = 0;
      });
    },
    { signal, passive: false }
  );
  reel.addEventListener(
    "pointerdown",
    event => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = latestX = event.clientX;
      startScroll = reel.scrollLeft;
      dragged = false;
    },
    { signal }
  );
  reel.addEventListener(
    "pointermove",
    event => {
      if (event.pointerId !== pointerId) return;
      latestX = event.clientX;
      if (!dragged && Math.abs(latestX - startX) < DRAG_THRESHOLD) return;
      if (!dragged) {
        dragged = true;
        reel.setPointerCapture(event.pointerId);
        reel.dataset.dragging = "";
      }
      if (dragFrame) return;
      dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        reel.scrollLeft = startScroll - (latestX - startX);
      });
    },
    { signal }
  );
  document.addEventListener("pointerup", finishDrag, { signal });
  reel.addEventListener("pointercancel", finishDrag, { signal });
  reel.addEventListener("lostpointercapture", finishDrag, { signal });
  reel.addEventListener("dragstart", event => event.preventDefault(), {
    signal,
  });
  reel.addEventListener(
    "click",
    event => {
      if (!dragged || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    },
    { signal, capture: true }
  );
  reel.addEventListener(
    "keydown",
    event => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const selected =
        event.target.closest<HTMLAnchorElement>(".pagination-option");
      if (!selected) return;
      const index = options.indexOf(selected);
      if (index < 0) return;
      let target: HTMLAnchorElement | undefined;
      if (event.key === "ArrowRight") target = options[index + direction];
      else if (event.key === "ArrowLeft") target = options[index - direction];
      else if (event.key === "Home") target = options[0];
      else if (event.key === "End") target = options.at(-1);
      else return;
      event.preventDefault();
      if (target) focus(target);
    },
    { signal }
  );

  return {
    focusCurrent() {
      measure();
      const current = options.find(
        option => option.getAttribute("aria-current") === "page"
      );
      if (current) focus(current);
    },
    stop,
    dispose() {
      controller.abort();
      stop();
      observer.disconnect();
    },
  };
}
