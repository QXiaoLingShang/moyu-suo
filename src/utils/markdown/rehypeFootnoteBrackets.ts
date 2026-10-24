type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

function isFootnoteBracket(node: HastNode | undefined): boolean {
  const className = node?.properties?.className;
  return (
    node?.type === "element" &&
    node.tagName === "span" &&
    Array.isArray(className) &&
    className.includes("footnote-bracket")
  );
}

function makeFootnoteBracket(value: "[" | "]"): HastNode {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["footnote-bracket"] },
    children: [{ type: "text", value }],
  };
}

/** Add literal delimiters so copied references keep their grouping. */
export default function rehypeFootnoteBrackets() {
  return (tree: HastNode) => {
    const visit = (node: HastNode): void => {
      if (!node.children) return;

      for (const child of node.children) {
        const isReference =
          child.type === "element" &&
          child.tagName === "a" &&
          Object.prototype.hasOwnProperty.call(
            child.properties ?? {},
            "dataFootnoteRef"
          );

        if (isReference && child.children) {
          const first = child.children[0];
          const last = child.children.at(-1);
          if (!isFootnoteBracket(first) || !isFootnoteBracket(last)) {
            child.children = [
              makeFootnoteBracket("["),
              ...child.children,
              makeFootnoteBracket("]"),
            ];
          }
        }

        visit(child);
      }
    };

    visit(tree);
  };
}
