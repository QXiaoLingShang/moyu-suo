/**
 * Mermaid 客户端渲染：把正文里的 mermaid 围栏转换成图表。
 *
 * Shiki 没有 mermaid 语法：语言名会以 pre[data-language="mermaid"] 保留，
 * 但也可能回退成 plaintext（标记丢失）——所以再用首行关键词做内容探测兜底。
 * 静态构建期不预渲染；仅当页面存在 mermaid 块时才动态 import。
 */
async function renderMermaid() {
  const sniff =
    /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2?|erDiagram|gantt|pie|journey|gitGraph)/m;

  const attrBlocks = Array.from(
    document.querySelectorAll(
      'pre[data-language="mermaid"] > code, pre > code.language-mermaid'
    )
  ) as HTMLElement[];

  let blocks = attrBlocks;
  if (blocks.length === 0) {
    blocks = (Array.from(
      document.querySelectorAll("pre > code")
    ) as HTMLElement[]).filter(code =>
      sniff.test((code.textContent ?? "").trimStart())
    );
  }
  if (blocks.length === 0) return;

  const { default: mermaid } = await import("mermaid");

  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains("dark")
      ? "dark"
      : "default",
    securityLevel: "loose",
  });

  for (const code of blocks) {
    const pre = code.closest("pre");
    if (!pre || pre.dataset.mermaidDone) continue;
    pre.dataset.mermaidDone = "1";

    const id = `mmd-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const { svg } = await mermaid.render(id, code.textContent ?? "");
      const wrap = document.createElement("div");
      wrap.className = "my-4 overflow-x-auto";
      wrap.innerHTML = svg;
      pre.replaceWith(wrap);
    } catch (err) {
      console.warn("[mermaid] render failed:", err);
    }
  }
}

renderMermaid();
document.addEventListener("astro:page-load", renderMermaid);
