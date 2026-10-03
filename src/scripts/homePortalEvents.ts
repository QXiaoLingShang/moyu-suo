import type { HomeEntranceNode } from "@/scripts/homeOrbit";

export type PortalDetail =
  { kind: "intro" } | { kind: "entrance"; entrance: HomeEntranceNode } | null;

type PortalEventsOptions = {
  stage: HTMLElement;
  avatar: HTMLButtonElement;
  entrances: HomeEntranceNode[];
  renderDetail: (state: PortalDetail) => void;
};

export function bindPortalEvents({
  stage,
  avatar,
  entrances,
  renderDetail,
}: PortalEventsOptions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let introOpen = false;
  let activeEntrance: HomeEntranceNode | null = null;

  function syncAvatarState(open: boolean): void {
    introOpen = open;
    avatar.setAttribute("aria-expanded", String(open));
    avatar.setAttribute(
      "aria-label",
      open
        ? (avatar.dataset.labelClose ?? "Hide my introduction")
        : (avatar.dataset.labelOpen ?? "Show my introduction")
    );
  }

  function showEntrance(entrance: HomeEntranceNode): void {
    activeEntrance = entrance;
    syncAvatarState(false);
    renderDetail({ kind: "entrance", entrance });
  }

  function showIdleDetail(): void {
    activeEntrance = null;
    if (introOpen) return;
    renderDetail(null);
  }

  function toggleIntro(): void {
    const open = !introOpen;
    activeEntrance = null;
    syncAvatarState(open);
    renderDetail(open ? { kind: "intro" } : null);
  }

  avatar.addEventListener("click", toggleIntro, { signal });

  for (const entrance of entrances) {
    entrance.item.addEventListener(
      "pointerenter",
      event => {
        if (!finePointer.matches || event.pointerType === "touch") return;
        showEntrance(entrance);
      },
      { signal }
    );
    entrance.item.addEventListener(
      "pointerleave",
      () => {
        if (entrance.item.contains(document.activeElement)) return;
        if (activeEntrance === entrance) showIdleDetail();
      },
      { signal }
    );
    entrance.item.addEventListener("focusin", () => showEntrance(entrance), {
      signal,
    });
    entrance.item.addEventListener(
      "focusout",
      () => {
        queueMicrotask(() => {
          if (signal.aborted || entrance.item.contains(document.activeElement))
            return;
          if (activeEntrance === entrance) {
            const stillHovered =
              finePointer.matches && entrance.item.matches(":hover");
            if (!stillHovered) showIdleDetail();
          }
        });
      },
      { signal }
    );
  }

  stage.addEventListener(
    "focusout",
    () => {
      queueMicrotask(() => {
        if (signal.aborted || stage.contains(document.activeElement)) return;
        if (!introOpen) showIdleDetail();
      });
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape" || (!introOpen && !activeEntrance)) return;
      activeEntrance = null;
      syncAvatarState(false);
      renderDetail(null);
    },
    { signal }
  );

  return () => controller.abort();
}
