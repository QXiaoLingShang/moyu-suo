import { prepareSidenoteLayout } from "@/utils/sidenoteLayout";
import { getSidenoteChoices } from "@/utils/sidenoteSelection";
import { createSidenoteMotion } from "./sidenotes/motion";
import { fragmentId, isElementVisible } from "./sidenotes/dom";
import {
  collectNotes,
  restoreNotes,
  preferredReference,
  referenceKey,
  type NoteReference,
  type NoteGroup,
} from "./sidenotes/model";
import {
  createPreviewViews,
  setPreviewState,
  type NoteView,
  type PreviewState,
} from "./sidenotes/views";
import { createNoteDialog } from "./sidenotes/dialog";
import { createReadingFocus } from "./sidenotes/reading";

type Selection = NoteReference | null;
type PointerSample = {
  target: EventTarget | null;
  clientX: number;
  clientY: number;
  pointerType: string;
};

// Share the reading insets with height measurement so every card can fit the
// same viewport used by placement and the automatic reading divider.
const READING_VIEWPORT = {
  topRem: 5,
  bottomRem: 1.5,
  previewBufferRem: 6,
  focusRatio: 0.4,
} as const;

function enhanceSidenotes(article: HTMLElement): () => void {
  const sections = article.querySelectorAll<HTMLElement>(
    ":scope > section[data-footnotes]"
  );
  const candidateSection = sections.length === 1 ? sections[0] : undefined;
  const list = candidateSection?.querySelector<HTMLOListElement>(":scope > ol");
  if (!candidateSection || !list || typeof HTMLDialogElement === "undefined")
    return () => {};
  const section = candidateSection;
  const showSidenotes = article.dataset.showSidenotes !== "false";
  const showEndnotes = article.dataset.showEndnotes !== "false";
  const originalSectionHidden = section.hidden;
  const cards = Array.from(list.children).filter(
    (item): item is HTMLElement =>
      item instanceof HTMLElement && item.tagName === "LI" && !!item.id
  );
  if (!cards.length) return () => {};
  const en = document.documentElement.lang.startsWith("en");
  const controller = new AbortController();
  const { signal } = controller;
  const media = matchMedia("screen and (min-width: 80rem)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const refs = Array.from(
    article.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")
  ).filter(ref => !section.contains(ref));
  const end = document.createElement("div");
  end.className = "sidenote-end";
  end.setAttribute("aria-hidden", "true");
  section.before(end);
  // Keep previews separate from the canonical endnotes so either can be shown.
  const sidebar = document.createElement("aside");
  sidebar.className = "sidenote-sidebar";
  sidebar.dataset.pagefindIgnore = "";
  sidebar.setAttribute("aria-label", en ? "Margin notes" : "页边注解");
  const previewList = document.createElement("ol");
  sidebar.append(previewList);
  section.before(sidebar);
  const rail = document.createElement("div");
  rail.className = "sidenote-rail";
  rail.setAttribute("aria-label", en ? "Article notes" : "文章注解");
  sidebar.append(rail);
  const notes = collectNotes(cards, refs);
  const byRef = new Map(
    notes.flatMap(note => note.refs.map(ref => [ref, note] as const))
  );
  const bySource = new Map(notes.map(note => [note.source, note]));
  const referenceOrder = new Map(refs.map((ref, index) => [ref, index]));
  const previews = createPreviewViews(
    previewList,
    { note: notes[0], ref: notes[0].refs[0] },
    en
  );
  const dockView = previews.dock;
  const dockCard = dockView.card;
  const dotReferences = new Map<HTMLButtonElement, NoteReference[]>();
  let groups: NoteGroup[] = [];
  const connector = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  connector.classList.add("sidenote-connector");
  connector.setAttribute("aria-hidden", "true");
  const persistentConnections = document.createElementNS(
    connector.namespaceURI,
    "path"
  );
  const connection = document.createElementNS(connector.namespaceURI, "path");
  connection.classList.add("sidenote-connection-focused");
  connector.append(persistentConnections, connection);
  sidebar.append(connector);
  let wide = false,
    printing = false,
    frame = 0,
    paintFrame = 0,
    pointerFrame = 0,
    historyFrame = 0;
  let selected: Selection = null;
  const readingFocus = createReadingFocus();
  let previewLayout = prepareSidenoteLayout([], { gap: 0, anchorOffset: 0 });
  let dockEngaged = false;
  const motion = createSidenoteMotion(previewList, reducedMotion);
  let sidebarWidth = 0;
  let pointerPosition: { x: number; y: number } | null = null;
  let pendingPointer: PointerSample | null = null;
  let articleHeight = 0,
    previewHeight = 0,
    rem = 16,
    navigating = false;

  const details = createNoteDialog({
    article,
    section,
    notes,
    english: en,
    signal,
    onClose: scheduleLayout,
    returnTarget: () =>
      selected?.ref ?? selected?.note.refs.find(isElementVisible),
  });

  function selectionFrom(target: EventTarget | null): Selection {
    if (!(target instanceof Element)) return null;
    const ref = target.closest<HTMLAnchorElement>("a[data-footnote-ref]");
    const noteFromRef = ref && byRef.get(ref);
    if (ref && noteFromRef) return { note: noteFromRef, ref };
    const dot = target.closest<HTMLButtonElement>(".sidenote-dot");
    const group = dot && dotReferences.get(dot);
    if (group)
      return (
        groups.find(item => item.references === group)?.current ?? group[0]
      );
    const card = target.closest<HTMLElement>(
      ".sidenote-card, .sidenote-source"
    );
    const reference = card && previews.referenceForCard(card);
    if (reference) return reference;
    const note = card && bySource.get(card);
    return note ? { note, ref: preferredReference(note) } : null;
  }
  function remember(
    selection: Selection,
    source: "manual" | "reading" = "manual"
  ) {
    selected = selection;
    if (source === "manual")
      readingFocus.selectManually({ hasSelection: !!selection });
    const group = selection ? groupFor(selection) : undefined;
    if (group && selection) group.current = selection;
    if (selection?.ref?.id) {
      selection.note.lastRef = selection.ref;
    }
  }
  function groupFor(selection: NoteReference) {
    return groups.find(group =>
      group.references.some(
        item => item.note === selection.note && item.ref === selection.ref
      )
    );
  }
  let activeReference: HTMLAnchorElement | undefined;
  function connectionPath({
    top,
    height,
    anchor,
  }: {
    top: number;
    height: number;
    anchor: number;
  }): string {
    const x = sidebarWidth - 3 * rem;
    // Attach near the heading so changing excerpt length does not shift the line.
    const y = top + Math.min(height / 2, 1.25 * rem);
    return `M ${x} ${y} C ${x + rem} ${y}, ${x + rem} ${anchor}, ${sidebarWidth - 0.5 * rem} ${anchor}`;
  }

  function paint() {
    cancelAnimationFrame(paintFrame);
    paintFrame = 0;
    if (!wide || signal.aborted) return;
    const articleTop = article.getBoundingClientRect().top;
    const readingTop = READING_VIEWPORT.topRem * rem;
    const readingHeight = Math.max(
      0,
      innerHeight - readingTop - READING_VIEWPORT.bottomRem * rem
    );
    const viewportStart = readingTop - articleTop;
    // The last card may extend beyond the article. Clipping to articleHeight
    // would shrink its available viewport and hide it before it scrolls away.
    const viewportEnd =
      innerHeight - READING_VIEWPORT.bottomRem * rem - articleTop;
    const selectedIndex = groups.findIndex(group =>
      group.references.some(
        item => item.note === selected?.note && item.ref === selected?.ref
      )
    );
    const previewBuffer = READING_VIEWPORT.previewBufferRem * rem;
    const previewStart = -articleTop - previewBuffer;
    const previewEnd = innerHeight - articleTop + previewBuffer;
    // Keep the reading divider fixed on screen; the end of the article must not
    // move it and manufacture crossings as the endnote list enters view.
    const readingLine =
      readingTop + readingHeight * READING_VIEWPORT.focusRatio - articleTop;
    const focusIndex = readingFocus.resolve(previewLayout.readingTargets, {
      selectedIndex,
      viewportStart: previewStart,
      viewportEnd: previewEnd,
      readingLine,
    });
    const primary = groups[focusIndex];
    if (primary) {
      if (focusIndex !== selectedIndex) remember(primary.current, "reading");
      else if (selected) primary.current = selected;
    }
    // Cached heights avoid forcing card layout on every scroll frame.
    const placement = previewLayout.arrange({
      focusIndex,
      viewportStart,
      viewportEnd,
      previewStart,
      previewEnd,
      readingLine,
    });
    const focusedLayout = placement.items[focusIndex];
    const regionFirst = focusedLayout
      ? groups[placement.regions[focusedLayout.regionIndex].firstIndex]
          .references[0]
      : undefined;
    const target =
      primary && focusedLayout && regionFirst && placement.focusTop !== null
        ? {
            key: referenceKey(primary.current),
            card: focusedLayout.baseStatic
              ? previews.forGroup(primary).card
              : dockCard,
            top: placement.focusTop,
            baseStatic: focusedLayout.baseStatic,
            regionKey: referenceKey(regionFirst),
          }
        : null;

    const persistentPaths: string[] = [];
    motion.update(target, moveDock => {
      const currentViews = new Set<NoteView>();
      groups.forEach((group, index) => {
        const item = placement.items[index];
        const view = previews.forGroup(group);
        currentViews.add(view);
        const state: PreviewState =
          group === primary && item.baseStatic
            ? "focused"
            : item.baseStatic || item.visibleRepresentative
              ? "persistent"
              : "hidden";
        if (state !== "hidden") {
          previews.configure(group, view);
          const top = item.top + "px";
          if (view.card.style.top !== top) view.card.style.top = top;
          if (state === "persistent")
            persistentPaths.push(
              connectionPath({
                top: item.top,
                height: group.height,
                anchor: group.anchor,
              })
            );
        }
        setPreviewState(view, state, item.baseStatic);
      });
      for (const view of previews.values()) {
        if (!currentViews.has(view)) setPreviewState(view, "hidden");
      }
      const dockFocused = !!target && !target.baseStatic;
      if (dockFocused && primary) previews.configure(primary, dockView);
      dockCard.toggleAttribute("data-moving", moveDock);
      if (target) {
        const top = target.top + "px";
        if (dockCard.style.top !== top) dockCard.style.top = top;
      }
      setPreviewState(dockView, dockFocused ? "focused" : "hidden");
    });

    const focusY = primary?.anchor ?? 0;
    for (const [dot, items] of dotReferences) {
      const index = Number(dot.dataset.groupIndex);
      const distance = Math.abs(groups[index].anchor - focusY);
      const strength =
        primary && distance < 6 * rem
          ? Math.max(0, 1 - distance / (6 * rem)) ** 2
          : 0;
      const value = strength.toFixed(3);
      if (dot.style.getPropertyValue("--dock-strength") !== value)
        dot.style.setProperty("--dock-strength", value);
      const active = primary?.references === items;
      if (dot.hasAttribute("data-active") !== active)
        dot.toggleAttribute("data-active", active);
    }
    // Share two SVG paths instead of allocating a connector node per note on scroll.
    const persistentPath = persistentPaths.join(" ");
    if (persistentConnections.getAttribute("d") !== persistentPath)
      persistentConnections.setAttribute("d", persistentPath);
    const focusedPath =
      primary && target
        ? connectionPath({
            top: target.top,
            height: primary.height,
            anchor: primary.anchor,
          })
        : "";
    if (connection.getAttribute("d") !== focusedPath)
      connection.setAttribute("d", focusedPath);
    const nextReference = primary?.current.ref;
    if (activeReference !== nextReference) {
      activeReference?.removeAttribute("data-sidenote-active");
      nextReference?.setAttribute("data-sidenote-active", "");
      activeReference = nextReference;
    }
  }
  function schedulePaint() {
    if (!paintFrame && !signal.aborted)
      paintFrame = requestAnimationFrame(paint);
  }
  function processPointer({
    target,
    clientX,
    clientY,
    pointerType,
  }: PointerSample): boolean {
    if (!wide || details.isOpen || pointerType === "touch") return false;
    if (!(target instanceof Element)) return false;
    let selection = selectionFrom(target);
    if (sidebar.contains(target)) {
      const bounds = sidebar.getBoundingClientRect();
      // Across the short bridge from a node to its preview, keep that preview
      // reachable. Vertical movement near the rail selects by stable slots.
      if (target.closest(".sidenote-card")) {
        selection = selection ?? selected;
      } else if (clientX < bounds.right - 2 * rem) {
        const card = sidebar.querySelector<HTMLElement>(
          '[data-preview="focused"]'
        );
        const cardBounds = card?.getBoundingClientRect();
        selection =
          dockEngaged &&
          cardBounds &&
          clientY >= cardBounds.top &&
          clientY <= cardBounds.bottom
            ? selected
            : null;
      } else {
        const y = clientY - article.getBoundingClientRect().top;
        let low = 0;
        let high = groups.length;
        while (low < high) {
          const middle = low + Math.floor((high - low) / 2);
          if (groups[middle].anchor < y) low = middle + 1;
          else high = middle;
        }
        const before = groups[low - 1];
        const after = groups[low];
        const nearest =
          !before || (after && y - before.anchor > after.anchor - y)
            ? after
            : before;
        selection =
          nearest && Math.abs(nearest.anchor - y) < 3 * rem
            ? nearest.current
            : null;
      }
    } else if (!target.closest("a[data-footnote-ref]")) selection = null;
    const changed =
      dockEngaged !== !!selection ||
      (!!selection &&
        (selection.note !== selected?.note || selection.ref !== selected?.ref));
    dockEngaged = !!selection;
    if (changed && selection) remember(selection);
    return changed;
  }
  function clearPendingPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pendingPointer = null;
  }
  function flushPendingPointer(schedule = true): boolean {
    if (!pendingPointer) return false;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    const pointer = pendingPointer;
    pendingPointer = null;
    const changed = processPointer(pointer);
    if (changed && schedule) schedulePaint();
    return changed;
  }
  function schedulePointer(pointer: PointerSample) {
    pendingPointer = pointer;
    if (!pointerFrame)
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (flushPendingPointer(false)) paint();
      });
  }
  function layout() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (signal.aborted) return;
    // Width/font/content changes invalidate both measured geometry and any
    // shadow captured from the previous grouping.
    motion.reset();
    readingFocus.invalidateGeometry();
    const rootStyle = getComputedStyle(document.documentElement);
    rem = parseFloat(rootStyle.fontSize) || 16;
    const rect = article.getBoundingClientRect();
    // Read the same proportions as the TOC without depending on its visibility
    // or initialization order. clientWidth excludes the scrollbar, like fixed CSS.
    const sideSpace = Math.max(
      0,
      (document.documentElement.clientWidth - rect.width) / 2
    );
    const gapRatio = parseFloat(
      rootStyle.getPropertyValue("--article-side-gap-ratio")
    );
    const widthRatio = parseFloat(
      rootStyle.getPropertyValue("--article-side-width-ratio")
    );
    const maxWidth =
      parseFloat(rootStyle.getPropertyValue("--article-side-max-width-rem")) *
      rem;
    const railDistance = sideSpace * gapRatio;
    const sidebarGap = railDistance - 0.5 * rem;
    // The rail sits 0.5rem inside the sidebar, so include that inset in its width.
    const available = Math.min(sideSpace * widthRatio, maxWidth) + 0.5 * rem;
    const wasWide = wide;
    wide = showSidenotes && media.matches && !printing && available >= 12 * rem;
    section.hidden = !showEndnotes && !printing;
    if (!wide) {
      delete article.dataset.sidenotes;
      for (const view of previews.values()) view.card.inert = true;
      dockCard.inert = true;
      refs.forEach(ref => ref.removeAttribute("data-sidenote-active"));
      activeReference = undefined;
    } else {
      article.dataset.sidenotes = "wide";
      article.style.setProperty("--sidenote-width", `${available}px`);
      article.style.setProperty("--sidenote-gap", `${sidebarGap}px`);
      previewHeight = Math.max(
        1,
        Math.min(
          11 * rem,
          Math.max(7 * rem, innerHeight * 0.26),
          innerHeight -
            (READING_VIEWPORT.topRem + READING_VIEWPORT.bottomRem) * rem
        )
      );
      article.style.setProperty(
        "--sidenote-preview-height",
        `${previewHeight}px`
      );
      articleHeight = end.getBoundingClientRect().top - rect.top;
      article.style.setProperty("--sidenote-rail-height", `${articleHeight}px`);
      const previousGroups = groups;
      groups = [];
      const entries = notes
        .flatMap<NoteReference & { anchor: number }>(note => {
          if (!note.refs.length)
            return [
              {
                note,
                ref: undefined,
                anchor: Math.max(0, articleHeight - previewHeight),
              },
            ];
          return note.refs.filter(isElementVisible).map(ref => {
            const bounds = ref.getBoundingClientRect();
            return {
              note,
              ref,
              anchor: bounds.top + bounds.height / 2 - rect.top,
            };
          });
        })
        .sort(
          (a, b) =>
            a.anchor - b.anchor ||
            (referenceOrder.get(a.ref!) ?? 0) -
              (referenceOrder.get(b.ref!) ?? 0)
        );
      for (const entry of entries) {
        const group = groups.at(-1);
        if (group && entry.anchor - group.anchor < 1.5 * rem)
          group.references.push(entry);
        else
          groups.push({
            anchor: entry.anchor,
            height: 0,
            references: [entry],
            current: entry,
          });
      }
      const previousSelections = new Map(
        previousGroups.map(
          group => [referenceKey(group.current), group.current] as const
        )
      );
      for (const group of groups) {
        for (const reference of group.references) {
          const previous = previousSelections.get(referenceKey(reference));
          if (!previous) continue;
          group.current = previous;
          break;
        }
      }
      // Batch writes before height reads to avoid a layout flush for every variant.
      // A group reserves its tallest choice so switching does not move its tabs.
      const groupChoices = groups.map(group =>
        getSidenoteChoices(group.references, group.current)
      );
      const measurementViews = groups.map((group, index) =>
        groupChoices[index].map(item => {
          const view = previews.forGroup(group, item);
          previews.configure({ ...group, current: item }, view);
          return view;
        })
      );
      const liveViews = new Set(measurementViews.flat());
      previews.prune(liveViews);
      // Reuse controls to preserve keyboard focus across font/viewport changes.
      const old = Array.from(dotReferences.keys());
      dotReferences.clear();
      groups.forEach((group, index) => {
        const choices = groupChoices[index];
        const dot = old[index] ?? document.createElement("button");
        dot.type = "button";
        dot.className = "sidenote-dot";
        dot.style.top = `${group.anchor}px`;
        const numbers = choices.map(item => item.note.number).join(", ");
        dot.setAttribute(
          "aria-label",
          `${en ? "Read notes" : "查看注解"} ${numbers}`
        );
        if (choices.length === 1) dot.setAttribute("aria-haspopup", "dialog");
        else dot.removeAttribute("aria-haspopup");
        dot.dataset.groupIndex = String(index);
        dot.textContent =
          choices.length > 1
            ? `+${choices.length}`
            : String(choices[0].note.number).padStart(2, "0");
        dot.title = `${en ? "Notes" : "注解"} ${numbers}`;
        dot.toggleAttribute("data-group", choices.length > 1);
        dotReferences.set(dot, group.references);
        if (!dot.parentElement) rail.append(dot);
      });
      old.slice(groups.length).forEach(dot => dot.remove());
      rail.style.height = `${articleHeight}px`;
      groups.forEach((group, index) => {
        group.height = Math.max(
          ...measurementViews[index].map(view => view.card.offsetHeight)
        );
      });
      previewLayout = prepareSidenoteLayout(groups, {
        gap: 0.75 * rem,
        anchorOffset: 1.25 * rem,
      });
      sidebarWidth = sidebar.getBoundingClientRect().width;
      connector.setAttribute("width", String(sidebarWidth));
      connector.setAttribute("height", String(articleHeight));
      paint();
    }
    if (wasWide !== wide && !details.isOpen && !navigating) {
      const focusedElement = document.activeElement;
      const selection = selectionFrom(focusedElement);
      if (selection && focusedElement && sidebar.contains(focusedElement)) {
        const target =
          selection.ref ?? selection.note.refs.find(isElementVisible);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  }
  function scheduleLayout() {
    if (!frame && !signal.aborted) frame = requestAnimationFrame(layout);
  }
  function openDetail(reference: NoteReference, trigger?: HTMLElement): void {
    const group = wide ? groupFor(reference) : undefined;
    details.open(reference, {
      trigger,
      choices: group ? getSidenoteChoices(group.references, reference) : [],
    });
  }
  function reveal(target: HTMLElement) {
    for (
      let parent = target.parentElement;
      parent && parent !== article;
      parent = parent.parentElement
    )
      if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  function navigate(
    target: HTMLElement,
    selection: Selection,
    updateHash: boolean
  ) {
    navigating = true;
    if (details.isOpen) details.close({ restoreFocus: false });
    reveal(target);
    if (bySource.has(target)) {
      const note = bySource.get(target)!;
      const ref =
        selection?.ref ?? note.refs.find(isElementVisible) ?? note.refs[0];
      if (ref) reveal(ref);
      remember({ note, ref });
    } else remember(selection);
    layout();
    const referenceId = bySource.has(target)
      ? (selected?.ref?.id ?? null)
      : null;
    if (
      updateHash &&
      (fragmentId(location.hash) !== target.id ||
        history.state?.sidenoteReference !== referenceId)
    )
      history.pushState(
        { ...history.state, sidenoteReference: referenceId },
        "",
        `#${encodeURIComponent(target.id)}`
      );
    if ((wide || !showEndnotes) && bySource.has(target)) {
      // A direct footnote URL can initially land on the visible endnote list.
      // Restore its reading context before opening details (also for history).
      if (!updateHash && selected?.ref) {
        const bounds = selected.ref.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= innerHeight)
          selected.ref.scrollIntoView({ block: "center", behavior: "instant" });
      }
      openDetail(
        { note: bySource.get(target)!, ref: selected?.ref },
        selected?.ref
      );
    } else {
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "center",
        behavior: reducedMotion.matches ? "instant" : "smooth",
      });
    }
    navigating = false;
  }
  function fromHash() {
    const target = document.getElementById(fragmentId(location.hash));
    if (!target || !article.contains(target)) {
      if (details.isOpen) details.close();
      return;
    }
    const selection = selectionFrom(target);
    if (selection && bySource.has(target)) {
      const savedId = history.state?.sidenoteReference;
      const savedRef =
        typeof savedId === "string" ? document.getElementById(savedId) : null;
      selection.ref =
        savedRef instanceof HTMLAnchorElement &&
        byRef.get(savedRef) === selection.note
          ? savedRef
          : (selection.note.refs.find(isElementVisible) ??
            selection.note.refs[0]);
    }
    if (selection) navigate(target, selection, false);
    else if (details.isOpen) details.close();
  }
  function scheduleFromHash() {
    // A history entry may change only the occurrence, retaining the same hash.
    // Coalesce popstate/hashchange so one history change does not navigate twice.
    if (!historyFrame)
      historyFrame = requestAnimationFrame(() => {
        historyFrame = 0;
        fromHash();
      });
  }
  article.addEventListener(
    "click",
    event => {
      flushPendingPointer();
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const option =
        event.target.closest<HTMLButtonElement>(".sidenote-option");
      if (wide && option) {
        const selection = previews.referenceForOption(option);
        if (selection) {
          remember(selection);
          paint();
          const view = previews.focused();
          const activeButton = view?.switcher.querySelector<HTMLButtonElement>(
            '[aria-pressed="true"]'
          );
          activeButton?.focus({ preventScroll: true });
          if (activeButton) {
            // scrollIntoView could also move the article, pulling the card away from the pointer.
            const strip = view!.switcher;
            const buttonRect = activeButton.getBoundingClientRect();
            const stripRect = strip.getBoundingClientRect();
            if (buttonRect.left < stripRect.left)
              strip.scrollLeft += buttonRect.left - stripRect.left;
            else if (buttonRect.right > stripRect.right)
              strip.scrollLeft += buttonRect.right - stripRect.right;
          }
        }
        return;
      }
      const preview = event.target.closest<HTMLButtonElement>(
        ".sidenote-preview, .sidenote-dot"
      );
      if (wide && preview) {
        dockEngaged = true;
        const selection = selectionFrom(preview);
        if (selection) {
          remember(selection);
          const group = groupFor(selection);
          if (
            dotReferences.has(preview) &&
            group &&
            getSidenoteChoices(group.references, selection).length > 1
          ) {
            paint();
            previews
              .focused()
              ?.switcher.querySelector<HTMLButtonElement>(
                '[aria-pressed="true"]'
              )
              ?.focus({ preventScroll: true });
          } else openDetail(selection, preview);
        }
        return;
      }
      const link = event.target.closest<HTMLAnchorElement>(
        "a[data-footnote-ref], a[data-footnote-backref], a.sidenote-return"
      );
      if (!link || (!wide && showEndnotes && !details.isOpen)) return;
      const target = document.getElementById(fragmentId(link.hash));
      if (!target || !article.contains(target)) return;
      event.preventDefault();
      navigate(
        target,
        byRef.has(link) ? selectionFrom(link) : selectionFrom(target),
        true
      );
    },
    { signal }
  );
  article.addEventListener(
    "keydown",
    event => {
      flushPendingPointer();
      if (
        event.target instanceof HTMLButtonElement &&
        event.target.matches(".sidenote-dot") &&
        ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
      ) {
        const dots = Array.from(dotReferences.keys());
        const index = dots.indexOf(event.target);
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? dots.length - 1
              : Math.max(
                  0,
                  Math.min(
                    dots.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1)
                  )
                );
        event.preventDefault();
        const dot = dots[nextIndex];
        dot?.focus({ preventScroll: true });
        dot?.scrollIntoView({ block: "nearest", behavior: "instant" });
        return;
      }
      if (
        !(event.target instanceof HTMLButtonElement) ||
        !event.target.matches(".sidenote-option") ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      const options = Array.from(
        event.target.parentElement!.querySelectorAll<HTMLButtonElement>(
          "button"
        )
      );
      const index = options.indexOf(event.target);
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) %
              options.length;
      event.preventDefault();
      options[nextIndex].click();
    },
    { signal }
  );
  document.addEventListener(
    "pointermove",
    event => {
      if (
        pointerPosition?.x === event.clientX &&
        pointerPosition.y === event.clientY
      )
        return;
      pointerPosition = { x: event.clientX, y: event.clientY };
      if (!wide || details.isOpen || event.pointerType === "touch") return;
      schedulePointer({
        target: event.target,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
    },
    { passive: true, signal }
  );
  document.addEventListener(
    "pointerleave",
    () => {
      clearPendingPointer();
      dockEngaged = false;
      schedulePaint();
    },
    { signal }
  );
  article.addEventListener(
    "focusout",
    () => {
      flushPendingPointer();
      schedulePaint();
    },
    { signal }
  );
  article.addEventListener(
    "focusin",
    event => {
      flushPendingPointer();
      if (!wide || details.isOpen) return;
      const selection = selectionFrom(event.target);
      if (selection) {
        remember(selection);
        schedulePaint();
      }
    },
    { signal }
  );
  article.addEventListener("load", scheduleLayout, { capture: true, signal });
  article.addEventListener("toggle", scheduleLayout, { capture: true, signal });
  window.addEventListener(
    "scroll",
    () => {
      // Only a new pointer action can override reading; a stationary pointer
      // must not reselect an old note as the document moves underneath it.
      clearPendingPointer();
      dockEngaged = false;
      readingFocus.scrolled();
      schedulePaint();
    },
    { passive: true, signal }
  );
  window.addEventListener("resize", scheduleLayout, { passive: true, signal });
  window.addEventListener("hashchange", scheduleFromHash, { signal });
  window.addEventListener("popstate", scheduleFromHash, { signal });
  window.addEventListener(
    "beforeprint",
    () => {
      flushPendingPointer();
      details.close({ restoreFocus: false });
      printing = true;
      layout();
    },
    { signal }
  );
  window.addEventListener(
    "afterprint",
    () => {
      printing = false;
      scheduleLayout();
    },
    { signal }
  );
  media.addEventListener("change", scheduleLayout, { signal });
  reducedMotion.addEventListener(
    "change",
    () => {
      motion.reset();
      schedulePaint();
    },
    { signal }
  );
  document.fonts.ready.then(scheduleLayout);
  document.fonts.addEventListener("loadingdone", scheduleLayout, { signal });
  const resizeObserver = new ResizeObserver(scheduleLayout);
  resizeObserver.observe(article);
  const mutationObserver = new MutationObserver(records => {
    if (
      records.some(
        record =>
          !section.contains(record.target) &&
          !sidebar.contains(record.target) &&
          !details.element.contains(record.target)
      )
    )
      scheduleLayout();
  });
  mutationObserver.observe(article, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open", "hidden"],
  });
  layout();
  fromHash();
  return () => {
    details.close({ restoreFocus: false });
    controller.abort();
    motion.reset();
    clearPendingPointer();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(paintFrame);
    cancelAnimationFrame(historyFrame);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    delete article.dataset.sidenotes;
    section.hidden = originalSectionHidden;
    refs.forEach(ref => ref.removeAttribute("data-sidenote-active"));
    previews.dispose();
    restoreNotes(notes);
    for (const name of [
      "--sidenote-width",
      "--sidenote-gap",
      "--sidenote-preview-height",
      "--sidenote-rail-height",
    ])
      article.style.removeProperty(name);
    rail.remove();
    connector.remove();
    sidebar.remove();
    end.remove();
    details.dispose();
  };
}
let currentArticle: HTMLElement | null = null;
let cleanup: (() => void) | undefined;
function initialize() {
  const article = document.getElementById("article");
  if (article === currentArticle) return;
  cleanup?.();
  currentArticle = article;
  cleanup = article ? enhanceSidenotes(article) : undefined;
}
initialize();
document.addEventListener("astro:page-load", initialize);
document.addEventListener("astro:before-swap", () => {
  cleanup?.();
  cleanup = undefined;
  currentArticle = null;
});
