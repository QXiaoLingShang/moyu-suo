import { getHomeGeometry, MAX_ORBIT_ENTRANCES } from "@/utils/homeGeometry";

export type HomeEntranceNode = {
  item: HTMLLIElement;
  group: SVGGElement;
  path: SVGPathElement;
  grain: SVGPathElement;
  dot: SVGCircleElement;
};

type HomeOrbitOptions = {
  stage: HTMLElement;
  avatar: HTMLButtonElement;
  svg: SVGSVGElement;
  entrances: HomeEntranceNode[];
};

export type HomeOrbitLayout = { destroy: () => void };

export function createHomeOrbitLayout({
  stage,
  avatar,
  svg,
  entrances,
}: HomeOrbitOptions): HomeOrbitLayout {
  const listeners = new AbortController();
  const { signal } = listeners;
  const desktop = window.matchMedia("(min-width: 48.01rem)");
  const observer = new ResizeObserver(draw);
  entrances.forEach(({ item }) => observer.observe(item));

  function clearLayout(): void {
    delete stage.dataset.geometryReady;
    for (const entrance of entrances) {
      delete entrance.item.dataset.side;
      entrance.item.style.removeProperty("left");
      entrance.item.style.removeProperty("top");
    }
  }

  function draw(): void {
    const canOrbit =
      desktop.matches &&
      entrances.length > 0 &&
      entrances.length <= MAX_ORBIT_ENTRANCES;

    if (!canOrbit) {
      clearLayout();
      return;
    }

    const width = stage.clientWidth;
    const centerY = avatar.offsetTop + avatar.offsetHeight / 2;
    const maxLabelWidth = Math.max(
      ...entrances.map(({ item }) => {
        const value = Number.parseFloat(getComputedStyle(item).maxWidth);
        return Number.isFinite(value) ? value : item.offsetWidth;
      })
    );
    const labelWidths = entrances.map(({ item }) => item.offsetWidth);
    const geometry = getHomeGeometry({
      count: entrances.length,
      width,
      centerY,
      maxLabelWidth,
      labelWidths,
    });

    svg.setAttribute("viewBox", `0 0 ${width} ${stage.clientHeight}`);
    for (const [index, entrance] of entrances.entries()) {
      const current = geometry[index];
      entrance.item.style.left = `${current.label.x}px`;
      entrance.item.style.top = `${current.label.y}px`;
      entrance.item.dataset.side = current.side;
      entrance.path.setAttribute("d", current.connector);
      entrance.grain.setAttribute("d", current.connector);
      entrance.dot.setAttribute("cx", String(current.point.x));
      entrance.dot.setAttribute("cy", String(current.point.y));
    }
    stage.dataset.geometryReady = "true";
  }

  observer.observe(stage);
  desktop.addEventListener("change", draw, { signal });
  document.fonts.addEventListener("loadingdone", draw, { signal });
  draw();

  return {
    destroy() {
      observer.disconnect();
      listeners.abort();
      clearLayout();
    },
  };
}
