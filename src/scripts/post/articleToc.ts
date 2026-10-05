import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";

type TocNode = {
  heading: HTMLHeadingElement;
  level: number;
  children: TocNode[];
};

export function setupArticleToc(article: HTMLElement): () => void {
  const toc = document.getElementById("article-toc");
  const tocScroll = document.getElementById("article-toc-scroll");
  const tocContent = document.getElementById("article-toc-content");
  const tocList = document.getElementById("article-toc-list");
  const tocProgress = document.getElementById("article-toc-progress");

  if (!toc || !tocScroll || !tocContent || !tocList || !tocProgress)
    return () => {};
  const tocRoot = toc!;
  const tocScroller = tocScroll!;
  const tocContentRoot = tocContent!;
  const tocListRoot = tocList as HTMLUListElement;
  const tocProgressMarker = tocProgress!;

  const headings = Array.from(
    article.querySelectorAll<HTMLHeadingElement>(
      "h2[id], h3[id], h4[id], h5[id], h6[id]"
    )
  ).filter(heading => !heading.closest("[data-footnotes]"));
  if (headings.length < 2) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    const node: TocNode = {
      heading,
      level: Number(heading.tagName.slice(1)),
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= node.level)
      stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  const links = new Map<string, HTMLAnchorElement>();
  const initialExpandLabel = tocRoot.dataset.expandLabel ?? "Expand";
  const initialCollapseLabel = tocRoot.dataset.collapseLabel ?? "Collapse";
  let expandLabel =
    getUIString("post.expandTocSection") || initialExpandLabel;
  let collapseLabel =
    getUIString("post.collapseTocSection") || initialCollapseLabel;
  let childListCount = 0;

  function updateToggleLabels(): void {
    expandLabel = getUIString("post.expandTocSection") || initialExpandLabel;
    collapseLabel =
      getUIString("post.collapseTocSection") || initialCollapseLabel;

    for (const toggle of tocListRoot.querySelectorAll<HTMLButtonElement>(
      ".article-toc-toggle"
    )) {
      const headingText =
        toggle.parentElement
          ?.querySelector(".article-toc-link")
          ?.textContent?.trim() ?? "";
      const actionLabel =
        toggle.getAttribute("aria-expanded") === "true"
          ? collapseLabel
          : expandLabel;
      toggle.setAttribute("aria-label", `${actionLabel} ${headingText}`);
    }
  }

  function appendNodes(nodes: TocNode[], list: HTMLUListElement): void {
    for (const node of nodes) {
      const item = document.createElement("li");
      const entry = document.createElement("div");
      entry.className = "article-toc-entry";

      const link = document.createElement("a");
      link.className = "article-toc-link";
      link.dataset.headingId = node.heading.id;
      link.dataset.level = String(node.level);
      link.href = `#${encodeURIComponent(node.heading.id)}`;
      link.textContent = node.heading.textContent.trim();
      links.set(node.heading.id, link);
      entry.append(link);
      item.append(entry);

      if (node.children.length > 0) {
        const children = document.createElement("ul");
        children.className = "article-toc-children";
        children.id = `article-toc-children-${++childListCount}`;
        appendNodes(node.children, children);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "article-toc-toggle";
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-controls", children.id);
        toggle.setAttribute(
          "aria-label",
          `${collapseLabel} ${node.heading.textContent.trim()}`
        );

        const icon = document.createElement("span");
        icon.className = "article-toc-toggle-icon";
        icon.setAttribute("aria-hidden", "true");
        toggle.append(icon);
        entry.append(toggle);
        item.append(children);
      }
      list.append(item);
    }
  }

  appendNodes(roots, tocListRoot);
  document.addEventListener(
    UI_LANGUAGE_CHANGE_EVENT,
    updateToggleLabels,
    { signal }
  );

  const desktopQuery = window.matchMedia("(min-width: 80rem)");
  function syncVisibility(): void {
    tocRoot.hidden = !desktopQuery.matches;
  }
  syncVisibility();

  function updateScrollEdges(): void {
    tocScroller.dataset.canScrollUp = String(tocScroller.scrollTop > 1);
    tocScroller.dataset.canScrollDown = String(
      tocScroller.scrollTop + tocScroller.clientHeight <
        tocScroller.scrollHeight - 1
    );
  }
  updateScrollEdges();

  let frame = 0;
  function updateActiveHeading(): void {
    frame = 0;
    if (!desktopQuery.matches) return;

    const documentElement = document.documentElement;
    const atPageEnd =
      window.scrollY + window.innerHeight >= documentElement.scrollHeight - 2;
    let activeHeading = headings[0];
    if (atPageEnd) {
      activeHeading = headings[headings.length - 1];
    } else {
      const activationLine = window.innerHeight * 0.24;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > activationLine) break;
        activeHeading = heading;
      }
    }

    const initialActiveLink = links.get(activeHeading.id);
    if (!initialActiveLink) return;
    let activeLink: HTMLAnchorElement = initialActiveLink;

    while (true) {
      const hiddenList: HTMLUListElement | null =
        activeLink.closest<HTMLUListElement>("ul[hidden]");
      if (!hiddenList) break;
      const parentLink: HTMLAnchorElement | null =
        hiddenList.parentElement?.querySelector<HTMLAnchorElement>(
          ":scope > .article-toc-entry > .article-toc-link"
        ) ?? null;
      if (!parentLink) break;
      activeLink = parentLink;
    }

    for (const link of links.values()) {
      if (link === activeLink) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }

    const scrollRect = tocScroller.getBoundingClientRect();
    let linkRect = activeLink.getBoundingClientRect();
    const edgeFadeInset = 16;
    const visibleTop = scrollRect.top + tocScroller.clientTop + edgeFadeInset;
    const visibleBottom =
      scrollRect.top +
      tocScroller.clientTop +
      tocScroller.clientHeight -
      edgeFadeInset;
    if (linkRect.top < visibleTop) {
      tocScroller.scrollTop -= visibleTop - linkRect.top;
    } else if (linkRect.bottom > visibleBottom) {
      tocScroller.scrollTop += linkRect.bottom - visibleBottom;
    }

    linkRect = activeLink.getBoundingClientRect();
    const contentRect = tocContentRoot.getBoundingClientRect();
    tocProgressMarker.style.height = `${linkRect.height}px`;
    tocProgressMarker.style.transform = `translateY(${linkRect.top - contentRect.top}px)`;
    updateScrollEdges();
  }

  function scheduleUpdate(): void {
    if (!frame) frame = window.requestAnimationFrame(updateActiveHeading);
  }

  document.addEventListener("scroll", scheduleUpdate, {
    passive: true,
    signal,
  });
  window.addEventListener(
    "resize",
    () => {
      updateScrollEdges();
      scheduleUpdate();
    },
    { passive: true, signal }
  );
  tocScroller.addEventListener("scroll", updateScrollEdges, {
    passive: true,
    signal,
  });
  tocList.addEventListener(
    "click",
    event => {
      const toggle =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>(".article-toc-toggle")
          : null;
      if (!toggle) return;

      const controlledId = toggle.getAttribute("aria-controls");
      const controlledList = controlledId
        ? document.getElementById(controlledId)
        : null;
      if (!controlledList) return;

      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      controlledList.hidden = expanded;
      const headingText =
        toggle.parentElement
          ?.querySelector(".article-toc-link")
          ?.textContent?.trim() ?? "";
      toggle.setAttribute(
        "aria-label",
        `${expanded ? expandLabel : collapseLabel} ${headingText}`
      );
      updateScrollEdges();
      scheduleUpdate();
    },
    { signal }
  );
  desktopQuery.addEventListener(
    "change",
    () => {
      syncVisibility();
      updateScrollEdges();
      scheduleUpdate();
    },
    { signal }
  );

  updateActiveHeading();

  return () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
  };
}
