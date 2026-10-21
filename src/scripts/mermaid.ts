import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";
import { createMermaidFocus } from "./mermaid/focus";
import Code from "@/assets/icons/IconCode.svg?raw";
import Copy from "@/assets/icons/IconCopy.svg?raw";
import Chart from "@/assets/icons/IconChartDots3.svg?raw";
import Maximize from "@/assets/icons/IconMaximize.svg?raw";
import { createIconControl } from "./post/previewControls";

type Diagram = {
  wrapper: HTMLElement;
  pre: HTMLPreElement;
  source: string;
  graph: HTMLDivElement;
  toggleButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  focusButton: HTMLButtonElement;
  status: HTMLElement;
  view: "chart" | "source";
  phase: "loading" | "ready" | "error";
  fixedColors: boolean;
  copied: boolean;
  copyTimer?: number;
  originalId: string | null;
  originalTabIndex: string | null;
};

let cleanup: (() => void) | undefined;
let activeBody: HTMLElement | undefined;
// Mermaid shares configuration: serialize initialize + render across page lifetimes.
let renderQueue = Promise.resolve();
let nextId = 0;

function setupMermaid(): void {
  if (activeBody === document.body) return;
  cleanup?.();
  const blocks = document.querySelectorAll<HTMLElement>(
    'pre[data-language="mermaid"] > code, pre > code.language-mermaid'
  );
  if (!blocks.length) return;
  activeBody = document.body;
  const controller = new AbortController();
  const { signal } = controller;
  const focus = createMermaidFocus();
  const diagrams: Diagram[] = [];
  const sandboxes = new Set<HTMLElement>();
  let revision = 0;
  let disposed = false;
  let theme = document.documentElement.dataset.theme;
  let renderFrame = 0;

  function update(diagram: Diagram): void {
    const ready = diagram.phase === "ready";
    const available =
      diagram.phase !== "error" &&
      (!!diagram.graph.querySelector("svg") || focus.isOpenFor(diagram.graph));
    const source = diagram.view === "source" || !available;
    diagram.wrapper.dataset.view = source ? "source" : "chart";
    diagram.wrapper.dataset.phase = diagram.phase;
    diagram.graph.hidden = source;
    diagram.pre.hidden = !source;
    diagram.toggleButton.disabled = !available;
    diagram.toggleButton.setAttribute("aria-pressed", String(source));
    const nextViewLabel = getUIString(
      source ? "mermaid.chart" : "mermaid.source"
    );
    diagram.toggleButton.setAttribute("aria-label", nextViewLabel);
    diagram.focusButton.disabled = !ready || source;
    diagram.copyButton.hidden = !source;
    diagram.copyButton.disabled = false;
    const copyLabel = getUIString(
      diagram.copied ? "post.codeCopied" : "post.copyCode"
    );
    diagram.copyButton.setAttribute("aria-label", copyLabel);
    diagram.status.textContent = getUIString(`mermaid.${diagram.phase}`);
    diagram.status.hidden = ready;
    focus.refreshState(diagram.graph);
  }

  function toggleView(diagram: Diagram): void {
    diagram.view = diagram.view === "chart" ? "source" : "chart";
    update(diagram);
  }

  for (const code of blocks) {
    const pre = code.closest("pre");
    if (!pre || pre.closest(".mermaid-block")) continue;
    const source = code.textContent ?? "";
    const wrapper = document.createElement("figure");
    wrapper.className = "mermaid-block not-prose";
    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-toolbar media-preview-toolbar";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", getUIString("mermaid.views"));
    toolbar.dataset.i18nAriaLabel = "mermaid.views";
    const toggleButton = createIconControl("mermaid.sourceView", Code);
    toggleButton.classList.add("mermaid-view-toggle");
    toggleButton
      .querySelector(".media-preview-icon")
      ?.classList.add("mermaid-source-icon");
    const previewIcon = document.createElement("span");
    previewIcon.className = "media-preview-icon mermaid-preview-icon";
    previewIcon.setAttribute("aria-hidden", "true");
    previewIcon.innerHTML = Chart;
    toggleButton.append(previewIcon);
    const focusButton = createIconControl("mermaid.focus", Maximize);
    focusButton.setAttribute("aria-haspopup", "dialog");
    const copyButton = createIconControl("post.copyCode", Copy);
    copyButton.classList.add("mermaid-copy");
    const graph = document.createElement("div");
    graph.className = "mermaid-graph";
    graph.id = `mermaid-chart-${++nextId}`;
    graph.tabIndex = 0;
    graph.setAttribute("role", "button");
    graph.setAttribute("aria-haspopup", "dialog");
    graph.setAttribute("aria-label", getUIString("mermaid.chart"));
    graph.dataset.i18nAriaLabel = "mermaid.chart";
    const originalId = pre.getAttribute("id");
    const originalTabIndex = pre.getAttribute("tabindex");
    pre.id ||= `mermaid-source-${nextId}`;
    pre.tabIndex = 0;
    toggleButton.setAttribute("aria-controls", `${graph.id} ${pre.id}`);
    const status = document.createElement("p");
    status.className = "mermaid-status";
    status.setAttribute("role", "status");
    toolbar.append(toggleButton, copyButton, focusButton);
    pre.before(wrapper);
    wrapper.append(toolbar, status, graph, pre);
    const diagram: Diagram = {
      wrapper,
      pre,
      source,
      graph,
      toggleButton,
      copyButton,
      focusButton,
      status,
      view: "chart",
      phase: "loading",
      originalId,
      originalTabIndex,
      // Explicit palettes use a light surface; author colors are never rewritten.
      fixedColors:
        /\b(?:classDef|style|linkStyle)\s|\b(?:fill|stroke|color)\s*:|%%\{|^---\s*$/m.test(
          source
        ),
      copied: false,
    };
    diagrams.push(diagram);
    function openFocus(trigger: HTMLElement): void {
      focus.open({
        target: graph,
        trigger,
        fallback: toggleButton,
        isPending: () => diagram.phase === "loading",
      });
    }
    toggleButton.addEventListener("click", () => toggleView(diagram), {
      signal,
    });
    copyButton.addEventListener(
      "click",
      async () => {
        try {
          await navigator.clipboard.writeText(diagram.source);
          if (disposed || !diagram.wrapper.isConnected) return;
          if (diagram.copyTimer !== undefined)
            window.clearTimeout(diagram.copyTimer);
          diagram.copied = true;
          update(diagram);
          diagram.copyTimer = window.setTimeout(() => {
            diagram.copyTimer = undefined;
            if (disposed || !diagram.wrapper.isConnected) return;
            diagram.copied = false;
            update(diagram);
          }, 1200);
        } catch {
          // Clipboard access may be unavailable outside a secure context.
          if (disposed || !diagram.wrapper.isConnected) return;
          diagram.copied = false;
          update(diagram);
        }
      },
      { signal }
    );
    graph.addEventListener(
      "click",
      event => {
        if (
          event.target instanceof Element &&
          !event.target.closest("a") &&
          !window.getSelection()?.toString()
        )
          openFocus(graph);
      },
      { signal }
    );
    graph.addEventListener(
      "keydown",
      event => {
        if (
          event.target === graph &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          openFocus(graph);
        }
      },
      { signal }
    );
    focusButton.addEventListener("click", () => openFocus(focusButton), {
      signal,
    });
    update(diagram);
  }

  function render(): void {
    const currentRevision = ++revision;
    const dark = document.documentElement.dataset.theme === "dark";
    const renderTargets = diagrams.filter(
      diagram =>
        !diagram.fixedColors || !diagram.graph.querySelector(":scope > svg")
    );
    if (renderTargets.length === 0) return;
    for (const diagram of renderTargets) {
      diagram.phase = "loading";
      update(diagram);
    }
    renderQueue = renderQueue.then(async () => {
      const valid = () => !disposed && revision === currentRevision;
      if (!valid()) return;
      try {
        const { default: mermaid } = await import("mermaid");
        if (!valid()) return;
        for (const diagram of renderTargets) {
          if (!valid()) return;
          const id = `mermaid-svg-${++nextId}`;
          // Own measurement and parse-error DOM, including stale async renders.
          const sandbox = document.createElement("div");
          sandbox.className = "mermaid-render-sandbox";
          sandbox.setAttribute("aria-hidden", "true");
          document.body.append(sandbox);
          sandboxes.add(sandbox);
          try {
            mermaid.initialize({
              startOnLoad: false,
              theme: dark && !diagram.fixedColors ? "dark" : "default",
              securityLevel: "strict",
              suppressErrorRendering: true,
            });
            const { svg } = await mermaid.render(id, diagram.source, sandbox);
            if (!valid() || !diagram.wrapper.isConnected) return;
            diagram.graph.dataset.palette =
              dark && !diagram.fixedColors ? "dark" : "light";
            diagram.phase = "ready";
            // The article owns the current render; the modal always clones it.
            diagram.graph.innerHTML = svg;
            focus.refresh(diagram.graph);
          } catch {
            if (!valid()) return;
            diagram.phase = "error";
            update(diagram);
            focus.closeFor(diagram.graph, diagram.pre);
            diagram.graph.replaceChildren();
          } finally {
            sandbox.remove();
            sandboxes.delete(sandbox);
          }
          update(diagram);
        }
      } catch {
        if (!valid()) return;
        for (const diagram of renderTargets) {
          diagram.phase = "error";
          update(diagram);
          focus.closeFor(diagram.graph, diagram.pre);
        }
      }
    });
  }

  const observer = new MutationObserver(() => {
    const nextTheme = document.documentElement.dataset.theme;
    if (theme === nextTheme) return;
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      const latestTheme = document.documentElement.dataset.theme;
      if (theme === latestTheme) return;
      theme = latestTheme;
      render();
    });
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  document.addEventListener(
    UI_LANGUAGE_CHANGE_EVENT,
    () => diagrams.forEach(update),
    { signal }
  );
  cleanup = () => {
    disposed = true;
    revision++;
    observer.disconnect();
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    controller.abort();
    focus.dispose();
    for (const sandbox of sandboxes) sandbox.remove();
    sandboxes.clear();
    for (const diagram of diagrams) {
      const { wrapper, pre, originalId, originalTabIndex, copyTimer } = diagram;
      if (copyTimer !== undefined) window.clearTimeout(copyTimer);
      diagram.copyTimer = undefined;
      pre.hidden = false;
      if (originalId === null) pre.removeAttribute("id");
      else pre.id = originalId;
      if (originalTabIndex === null) pre.removeAttribute("tabindex");
      else pre.setAttribute("tabindex", originalTabIndex);
      wrapper.replaceWith(pre);
    }
    activeBody = undefined;
    cleanup = undefined;
  };
  render();
}

setupMermaid();
document.addEventListener("astro:page-load", setupMermaid);
document.addEventListener("astro:before-swap", () => cleanup?.());
