const EXCERPT_LIMIT = 240;
const BLOCK_ELEMENTS =
  "address, article, blockquote, div, h1, h2, h3, h4, h5, h6, li, ol, p, pre, section, table, tr, ul";

function appendSeparator(target: DocumentFragment, remaining: number): number {
  if (remaining <= 0 || target.childNodes.length === 0) return remaining;
  const last = target.lastChild;
  if (last?.nodeType === Node.TEXT_NODE && /\s$/.test(last.textContent ?? ""))
    return remaining;
  target.append(document.createTextNode(" "));
  return remaining - 1;
}

function appendChildren(
  parent: Node,
  target: DocumentFragment,
  remaining: number
): number {
  for (let child = parent.firstChild; child && remaining > 0;) {
    const next = child.nextSibling;
    remaining = appendExcerpt(child, target, remaining);
    child = next;
  }
  return remaining;
}

function appendText(
  text: string,
  target: DocumentFragment,
  remaining: number
): number {
  let excerpt = "";
  for (const character of text) {
    if (remaining <= 0) break;
    excerpt += character;
    remaining--;
  }
  if (excerpt) target.append(document.createTextNode(excerpt));
  return remaining;
}

function consumeMathBudget(
  source: string | undefined,
  remaining: number
): number {
  let consumed = 0;
  for (const _character of source ?? "") {
    if (consumed >= remaining) break;
    consumed++;
  }
  return remaining - Math.max(1, consumed);
}

function appendExcerpt(
  node: Node,
  target: DocumentFragment,
  remaining: number
): number {
  if (remaining <= 0) return 0;
  if (node instanceof Element) {
    if (node.matches("[data-footnote-backref], button, .katex-mathml"))
      return remaining;

    const isDisplayMath = node.matches(".katex-display");
    if (isDisplayMath || node.matches(".katex")) {
      const math = isDisplayMath ? node.querySelector(".katex") : node;
      if (math) {
        if (isDisplayMath) remaining = appendSeparator(target, remaining);
        if (remaining <= 0) return 0;
        // Text extraction destroys fraction/script layout; retain KaTeX's rendered and MathML forms.
        const copy = math.cloneNode(true) as HTMLElement;
        copy.removeAttribute("id");
        copy
          .querySelectorAll("[id]")
          .forEach(element => element.removeAttribute("id"));

        if (isDisplayMath) {
          // A margin card is narrow, so block equations become compact inline math.
          const compact = document.createElement("span");
          compact.className = "sidenote-math-compact";
          compact.append(copy);
          target.append(compact);
        } else target.append(copy);

        const source = math.querySelector(
          'annotation[encoding="application/x-tex"]'
        )?.textContent;
        remaining = consumeMathBudget(source, remaining);
        return isDisplayMath ? appendSeparator(target, remaining) : remaining;
      }
    }

    const isBlock = node.matches(BLOCK_ELEMENTS);
    if (isBlock) remaining = appendSeparator(target, remaining);
    if (remaining <= 0) return 0;
    if (node.matches("br")) return appendSeparator(target, remaining);

    remaining = appendChildren(node, target, remaining);
    return isBlock ? appendSeparator(target, remaining) : remaining;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "")
      .replace(/[↩↵]/g, "")
      .replace(/\s+/g, " ");
    return appendText(text, target, remaining);
  }

  return appendChildren(node, target, remaining);
}

/** Build a short, inert preview while preserving the original math layout. */
export function createSidenoteExcerpt(body: HTMLElement): DocumentFragment {
  const excerpt = document.createDocumentFragment();
  appendExcerpt(body, excerpt, EXCERPT_LIMIT);
  return excerpt;
}
