import {
  bindPortalEvents,
  type PortalDetail,
} from "@/scripts/homePortalEvents";
import {
  createHomeOrbitLayout,
  type HomeEntranceNode,
} from "@/scripts/homeOrbit";

type DetailElements = {
  eyebrow: HTMLElement;
  title: HTMLElement;
  text: HTMLElement;
};

function createEntranceGlyphs(title: string): HTMLSpanElement[] {
  return Array.from(title, (glyph, glyphIndex) => {
    const element = document.createElement("span");
    element.className = "home-entrance__glyph";
    element.dataset.glyphIndex = String(glyphIndex);
    element.textContent = glyph;
    return element;
  });
}

function collectEntranceNodes(
  stage: HTMLElement,
  svg: SVGSVGElement
): HomeEntranceNode[] {
  // Pair by stable ids so harmless DOM ordering changes cannot miswire connectors.
  const groupsByKey = new Map(
    Array.from(svg.querySelectorAll<SVGGElement>(":scope > g[data-key]")).map(
      group => [group.dataset.key, group]
    )
  );
  const entrances: HomeEntranceNode[] = [];

  for (const item of stage.querySelectorAll<HTMLLIElement>(".home-entrance")) {
    const group = groupsByKey.get(item.dataset.key);
    const path = group?.querySelector<SVGPathElement>(".home-connectors__line");
    const grain = group?.querySelector<SVGPathElement>(
      ".home-connectors__grain"
    );
    const dot = group?.querySelector<SVGCircleElement>("circle");
    if (group && path && grain && dot) {
      entrances.push({ item, group, path, grain, dot });
    }
  }

  return entrances;
}

function createDetailRenderer({
  stage,
  detail,
  elements,
}: {
  stage: HTMLElement;
  detail: HTMLElement;
  elements: DetailElements;
}): (state: PortalDetail) => void {
  let activeEntrance: HomeEntranceNode | null = null;

  function setActiveEntrance(next: HomeEntranceNode | null): void {
    if (activeEntrance === next) return;
    activeEntrance?.item.removeAttribute("data-active");
    activeEntrance?.group.removeAttribute("data-active");
    next?.item.setAttribute("data-active", "true");
    next?.group.setAttribute("data-active", "true");
    activeEntrance = next;
  }

  return state => {
    detail.setAttribute(
      "aria-live",
      state?.kind === "intro" ? "polite" : "off"
    );
    if (!state) {
      stage.removeAttribute("data-detail-visible");
      detail.dataset.kind = "idle";
      elements.eyebrow.textContent = "";
      elements.title.textContent = "";
      elements.text.textContent = stage.dataset.introText ?? "";
      setActiveEntrance(null);
      return;
    }

    if (state.kind === "intro") {
      elements.eyebrow.textContent = stage.dataset.introLabel ?? "";
      elements.title.textContent = stage.dataset.introTitle ?? "";
      elements.text.textContent = stage.dataset.introText ?? "";
      detail.dataset.kind = "intro";
      setActiveEntrance(null);
    } else {
      const { entrance } = state;
      const live = entrance.item.dataset.status === "live";
      const entranceTitle = entrance.item.dataset.title ?? "";
      elements.eyebrow.textContent = live
        ? entranceTitle
        : `${entranceTitle} · ${stage.dataset.plannedLabel ?? ""}`;
      elements.title.textContent = "";
      elements.text.textContent = entrance.item.dataset.description ?? "";
      detail.dataset.kind = "entry";
      setActiveEntrance(entrance);
    }

    stage.dataset.detailVisible = "true";
  };
}

function syncPortalLanguage({
  stage,
  avatar,
  entrances,
  renderDetail,
}: {
  stage: HTMLElement;
  avatar: HTMLButtonElement;
  entrances: HomeEntranceNode[];
  renderDetail: (state: PortalDetail) => void;
}): void {
  const language = document.documentElement.lang.toLowerCase().startsWith("en")
    ? "En"
    : "Zh";
  const read = (element: HTMLElement, key: string): string =>
    element.dataset[`${key}${language}`] ?? element.dataset[key] ?? "";

  stage.dataset.introLabel = read(stage, "introLabel");
  stage.dataset.introTitle = read(stage, "introTitle");
  stage.dataset.introText = read(stage, "introText");
  stage.dataset.plannedLabel = read(stage, "plannedLabel");

  const isIntroOpen = avatar.getAttribute("aria-expanded") === "true";
  avatar.dataset.labelOpen = read(avatar, "labelOpen");
  avatar.dataset.labelClose = read(avatar, "labelClose");
  avatar.setAttribute(
    "aria-label",
    isIntroOpen
      ? (avatar.dataset.labelClose ?? "")
      : (avatar.dataset.labelOpen ?? "")
  );

  for (const { item } of entrances) {
    const title = read(item, "title");
    const description = read(item, "description");
    item.dataset.title = title;
    item.dataset.description = description;

    const titleElement = item.querySelector<HTMLElement>(
      ".home-entrance__title"
    );
    if (titleElement && titleElement.textContent !== title) {
      titleElement.replaceChildren(...createEntranceGlyphs(title));
    }

    const accessibleLabel = item.querySelector<HTMLElement>(
      ".home-entrance__accessible-label"
    );
    if (accessibleLabel) {
      const status =
        item.dataset.status === "live" ? "" : `${stage.dataset.plannedLabel}. `;
      accessibleLabel.textContent = `${title}. ${status}${description}`;
    }
  }

  if (isIntroOpen) {
    renderDetail({ kind: "intro" });
    return;
  }

  const activeEntrance = entrances.find(({ item }) =>
    item.hasAttribute("data-active")
  );
  renderDetail(
    activeEntrance ? { kind: "entrance", entrance: activeEntrance } : null
  );
}

function initHomePortal(): void {
  const stageCandidate = document.querySelector<HTMLElement>(".home-stage");
  if (!stageCandidate || stageCandidate.dataset.homeInitialized) return;

  const avatarCandidate =
    stageCandidate.querySelector<HTMLButtonElement>(".home-disc");
  const svgCandidate =
    stageCandidate.querySelector<SVGSVGElement>(".home-connectors");
  const detailCandidate =
    stageCandidate.querySelector<HTMLElement>(".home-detail");
  const eyebrowCandidate = detailCandidate?.querySelector<HTMLElement>(
    ".home-detail__eyebrow"
  );
  const titleCandidate = detailCandidate?.querySelector<HTMLElement>(
    ".home-detail__title"
  );
  const textCandidate =
    detailCandidate?.querySelector<HTMLElement>(".home-detail__text");
  if (
    !avatarCandidate ||
    !svgCandidate ||
    !detailCandidate ||
    !eyebrowCandidate ||
    !titleCandidate ||
    !textCandidate
  )
    return;

  const stage: HTMLElement = stageCandidate;
  const avatar: HTMLButtonElement = avatarCandidate;
  const svg: SVGSVGElement = svgCandidate;
  const detail: HTMLElement = detailCandidate;
  const entrances = collectEntranceNodes(stage, svg);
  const renderDetail = createDetailRenderer({
    stage,
    detail,
    elements: {
      eyebrow: eyebrowCandidate,
      title: titleCandidate,
      text: textCandidate,
    },
  });
  syncPortalLanguage({ stage, avatar, entrances, renderDetail });
  const orbit = createHomeOrbitLayout({ stage, avatar, svg, entrances });
  const destroyInteractions = bindPortalEvents({
    stage,
    avatar,
    entrances,
    renderDetail,
  });

  stage.dataset.homeInitialized = "true";
  const languageObserver = new MutationObserver(() => {
    syncPortalLanguage({ stage, avatar, entrances, renderDetail });
  });
  languageObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  document.addEventListener(
    "astro:before-swap",
    () => {
      destroyInteractions();
      orbit.destroy();
      languageObserver.disconnect();
      delete stage.dataset.homeInitialized;
    },
    { once: true }
  );

  const home = document.querySelector<HTMLElement>(
    "#main-content[data-layout='index']"
  );
  if (!home) return;

  try {
    sessionStorage.setItem(
      "backUrl",
      home.dataset.homePath ?? import.meta.env.BASE_URL
    );
  } catch {
    // Returning to the homepage still works when browser storage is unavailable.
  }
}

let pageLoadListenerRegistered = false;

export function setupHomePortal(): void {
  initHomePortal();
  if (pageLoadListenerRegistered) return;
  document.addEventListener("astro:page-load", initHomePortal);
  pageLoadListenerRegistered = true;
}
