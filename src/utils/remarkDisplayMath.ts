type SourcePosition = {
  start: { offset?: number };
  end: { offset?: number };
};

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  value?: string;
  position?: SourcePosition;
  data?: unknown;
};

function isDoubleDollarMath(
  node: MarkdownNode,
  source: string
): node is MarkdownNode & { type: "inlineMath"; value: string } {
  if (node.type !== "inlineMath") return false;

  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return false;

  const raw = source.slice(start, end).trim();
  const hasDoubleDollarDelimiters =
    raw.length > 4 &&
    raw.startsWith("$$") &&
    !raw.startsWith("$$$") &&
    raw.endsWith("$$") &&
    !raw.endsWith("$$$");

  return hasDoubleDollarDelimiters && Boolean(node.value?.trim());
}

function hasParagraphContent(nodes: MarkdownNode[]): boolean {
  return nodes.some(node => {
    if (node.type === "text") return Boolean(node.value?.trim());
    if (node.children) return hasParagraphContent(node.children);
    return true;
  });
}

function makeParagraph(
  original: MarkdownNode,
  children: MarkdownNode[]
): MarkdownNode {
  const first = children[0]?.position?.start;
  const last = children.at(-1)?.position?.end;

  return {
    ...original,
    children,
    position: first && last ? { start: first, end: last } : original.position,
  };
}

function makeDisplayMath(node: MarkdownNode): MarkdownNode {
  const value = node.value ?? "";

  return {
    type: "math",
    value,
    data: {
      hName: "pre",
      hChildren: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-math", "math-display"] },
          children: [{ type: "text", value }],
        },
      ],
    },
    position: node.position,
  };
}

function splitParagraph(
  paragraph: MarkdownNode,
  source: string
): MarkdownNode[] {
  const parts: MarkdownNode[] = [];
  let textNodes: MarkdownNode[] = [];
  let didSplit = false;

  const flushText = () => {
    if (hasParagraphContent(textNodes)) {
      parts.push(makeParagraph(paragraph, textNodes));
    }
    textNodes = [];
  };

  for (const child of paragraph.children ?? []) {
    if (isDoubleDollarMath(child, source)) {
      didSplit = true;
      flushText();
      parts.push(makeDisplayMath(child));
    } else {
      textNodes.push(child);
    }
  }

  if (!didSplit) return [paragraph];

  flushText();
  return parts;
}

/** Turn double-dollar math into display blocks, splitting surrounding prose. */
export default function remarkDisplayMath() {
  return (tree: MarkdownNode, file: { value: unknown }) => {
    const source =
      typeof file.value === "string"
        ? file.value
        : new TextDecoder().decode(file.value as Uint8Array);

    const visit = (parent: MarkdownNode) => {
      if (!parent.children) return;

      const children: MarkdownNode[] = [];
      for (const node of parent.children) {
        if (node.type === "paragraph") {
          children.push(...splitParagraph(node, source));
        } else {
          visit(node);
          children.push(node);
        }
      }

      parent.children = children;
    };

    visit(tree);
  };
}
