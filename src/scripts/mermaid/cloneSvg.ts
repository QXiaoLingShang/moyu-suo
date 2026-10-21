let nextCloneId = 0;

/** Clone an inline diagram for the modal without sharing document-wide SVG IDs. */
export function cloneSvgWithUniqueIds(source: SVGSVGElement): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const ids = new Map<string, string>();
  const elements = [clone, ...clone.querySelectorAll<SVGElement>("[id]")];

  elements.forEach((element, index) => {
    if (!element.id) return;
    const replacement = `mermaid-focus-${nextCloneId++}-${index}`;
    ids.set(element.id, replacement);
    element.id = replacement;
  });

  for (const element of [clone, ...clone.querySelectorAll<SVGElement>("*")]) {
    for (const attribute of Array.from(element.attributes)) {
      const value = rewriteReference(attribute.value, ids, attribute.name);
      if (value !== attribute.value)
        element.setAttribute(attribute.name, value);
    }

    if (element.localName === "style" && element.textContent)
      element.textContent = element.textContent.replace(
        /#([\w-]+)/g,
        (_match, id: string) => `#${ids.get(id) ?? id}`
      );
  }

  return clone;
}

function rewriteReference(
  value: string,
  ids: Map<string, string>,
  attributeName: string
): string {
  let rewritten = value.replace(
    /url\(#([^\)]+)\)/g,
    (_match, id: string) => `url(#${ids.get(id) ?? id})`
  );

  if (
    ["href", "xlink:href"].includes(attributeName) &&
    rewritten.startsWith("#")
  ) {
    const id = rewritten.slice(1);
    rewritten = `#${ids.get(id) ?? id}`;
  }

  if (["aria-labelledby", "aria-describedby"].includes(attributeName))
    rewritten = rewritten
      .split(/\s+/)
      .map(id => ids.get(id) ?? id)
      .join(" ");

  return rewritten;
}
