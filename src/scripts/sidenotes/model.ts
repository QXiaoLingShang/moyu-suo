import { fragmentId, isElementVisible } from "./dom";

/** Keep one rich body so opening details preserves element IDs and existing handlers. */
export type Note = {
  readonly number: number;
  readonly source: HTMLElement;
  readonly body: HTMLDivElement;
  readonly excerpt: string;
  readonly refs: readonly HTMLAnchorElement[];
  readonly originalTabindex: string | null;
  lastRef?: HTMLAnchorElement;
};

/** One occurrence in the article; an orphan note may have no reference. */
export type NoteReference = { note: Note; ref?: HTMLAnchorElement };
export type NoteGroup = {
  anchor: number;
  height: number;
  references: NoteReference[];
  current: NoteReference;
};

/** DOM identity survives regrouping without conflating distant references to the same note. */
export function referenceKey(reference: NoteReference): HTMLElement {
  return reference.ref ?? reference.note.source;
}

function plainText(node: Node): string {
  // Controls are not note content; KaTeX's parallel MathML would repeat the formula.
  if (
    node instanceof Element &&
    node.matches("[data-footnote-backref], button, .katex-mathml")
  )
    return "";
  return node.nodeType === Node.TEXT_NODE
    ? (node.textContent ?? "")
    : Array.from(node.childNodes).map(plainText).join(" ");
}

export function collectNotes(
  sources: HTMLElement[],
  refs: HTMLAnchorElement[]
): Note[] {
  const referencesById = new Map<string, HTMLAnchorElement[]>();
  for (const ref of refs) {
    const id = fragmentId(ref.hash);
    const references = referencesById.get(id) ?? [];
    references.push(ref);
    referencesById.set(id, references);
  }
  return sources.map((source, index) => {
    const body = document.createElement("div");
    body.className = "sidenote-body";
    body.append(...Array.from(source.childNodes));
    const originalTabindex = source.getAttribute("tabindex");
    source.tabIndex = -1;
    source.classList.add("sidenote-source");
    source.append(body);
    return {
      number: index + 1,
      source,
      body,
      excerpt: plainText(body)
        .replace(/[↩↵]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240),
      refs: referencesById.get(source.id) ?? [],
      originalTabindex,
    };
  });
}

export function restoreNotes(notes: readonly Note[]): void {
  for (const note of notes) {
    note.body.replaceWith(...Array.from(note.body.childNodes));
    note.source.classList.remove("sidenote-source");
    if (note.originalTabindex === null) note.source.removeAttribute("tabindex");
    else note.source.setAttribute("tabindex", note.originalTabindex);
  }
}

export function preferredReference(note: Note): HTMLAnchorElement | undefined {
  // Returning to the last occurrence preserves context when the same note is cited again.
  return note.lastRef ?? note.refs.find(isElementVisible) ?? note.refs[0];
}

export function noteLabel(note: Note, english: boolean): string {
  return `${english ? "NOTE" : "注解"} ${String(note.number).padStart(2, "0")}`;
}
