import { getSidenoteChoices } from "@/utils/sidenoteLayout";
import {
  noteLabel,
  type Note,
  type NoteGroup,
  type NoteReference,
} from "./model";

export type PreviewState = "hidden" | "persistent" | "focused";
export type NoteView = {
  readonly card: HTMLLIElement;
  readonly label: HTMLSpanElement;
  readonly back: HTMLAnchorElement;
  readonly preview: HTMLButtonElement;
  readonly excerpt: HTMLSpanElement;
  readonly switcher: HTMLDivElement;
  reference: NoteReference;
};

export function setPreviewState(
  view: NoteView,
  state: PreviewState,
  baseStatic = false
): void {
  const { card } = view;
  if (card.dataset.preview !== state) card.dataset.preview = state;
  if (card.hasAttribute("data-static") !== baseStatic)
    card.toggleAttribute("data-static", baseStatic);
  const focused = state === "focused";
  if (card.hasAttribute("data-focused") !== focused)
    card.toggleAttribute("data-focused", focused);
  const hidden = state === "hidden";
  if (card.inert !== hidden) card.inert = hidden;
}

/** Keep preview DOM separate so regrouping cannot move or duplicate the original content. */
export function createPreviewViews(
  container: HTMLElement,
  first: NoteReference,
  english: boolean
) {
  const views = new Map<string, NoteView>();
  const byCard = new WeakMap<HTMLElement, NoteView>();
  const byOption = new WeakMap<HTMLButtonElement, NoteReference>();
  const renderedChoices = new WeakMap<NoteView, readonly Note[]>();

  function renderReference(view: NoteView, reference: NoteReference): void {
    const { note, ref } = reference;
    view.reference = reference;
    view.card.dataset.noteId = note.source.id;
    view.card.dataset.refId = ref?.id ?? "";
    view.back.hidden = !ref;
    if (ref) view.back.href = `#${encodeURIComponent(ref.id)}`;
    const occurrence = ref ? note.refs.indexOf(ref) + 1 : 0;
    const label = noteLabel(note, english);
    view.label.textContent = `${label}${note.refs.length > 1 ? ` · ${occurrence}/${note.refs.length}` : ""}`;
    view.label.title =
      note.refs.length > 1
        ? english
          ? `Reference ${occurrence} of ${note.refs.length}`
          : `正文第 ${occurrence} 处引用，共 ${note.refs.length} 处`
        : label;
    view.excerpt.textContent =
      note.excerpt || (english ? "Open to view content" : "打开查看内容");
    view.preview.setAttribute(
      "aria-label",
      `${english ? "Read note" : "查看完整注解"} ${note.number}`
    );
  }

  function create(reference: NoteReference, dock = false): NoteView {
    const card = document.createElement("li");
    card.className = "sidenote-card sidenote-occurrence";
    if (dock) card.classList.add("sidenote-dock-card");
    card.tabIndex = -1;
    card.dataset.pagefindIgnore = "";
    const heading = document.createElement("div");
    heading.className = "sidenote-heading";
    const label = document.createElement("span");
    const back = document.createElement("a");
    back.className = "sidenote-return";
    back.textContent = english ? "Back ↗" : "返回正文 ↗";
    heading.append(label, back);
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "sidenote-preview";
    preview.setAttribute("aria-haspopup", "dialog");
    const excerpt = document.createElement("span");
    excerpt.className = "sidenote-excerpt";
    const hint = document.createElement("span");
    hint.className = "sidenote-hint";
    hint.textContent = english ? "Read note ↗" : "查看详情 ↗";
    preview.append(excerpt, hint);
    const switcher = document.createElement("div");
    switcher.className = "sidenote-switcher";
    switcher.setAttribute("role", "group");
    switcher.setAttribute(
      "aria-label",
      english ? "Notes at this position" : "同位置注解，选择切换"
    );
    switcher.hidden = true;
    card.append(heading, switcher, preview);
    container.append(card);
    const view = { card, label, back, preview, excerpt, switcher, reference };
    byCard.set(card, view);
    renderReference(view, reference);
    return view;
  }

  const dock = create(first, true);

  function forGroup(group: NoteGroup, reference = group.current): NoteView {
    const firstReference = group.references.find(
      item => item.note === reference.note
    );
    if (!firstReference)
      throw new Error("A preview reference must belong to its group");
    // Key by the group's first occurrence so selecting a repeated citation reuses its card.
    const key = `${reference.note.source.id}:${firstReference.ref?.id ?? "orphan"}`;
    let view = views.get(key);
    if (!view) {
      view = create(reference);
      views.set(key, view);
    }
    return view;
  }

  function configure(group: NoteGroup, view: NoteView): void {
    const reference = group.current;
    if (
      view.reference.note !== reference.note ||
      view.reference.ref !== reference.ref
    )
      renderReference(view, reference);
    const choices = getSidenoteChoices(group.references, reference);
    const hideSwitcher = choices.length < 2;
    if (view.switcher.hidden !== hideSwitcher)
      view.switcher.hidden = hideSwitcher;
    const previous = renderedChoices.get(view);
    // Recreating unchanged buttons would drop keyboard focus on every selection update.
    const unchanged =
      previous?.length === choices.length &&
      choices.every((item, index) => item.note === previous[index]);
    if (!unchanged) {
      view.switcher.replaceChildren(
        ...choices.map(item => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "sidenote-option";
          button.textContent = String(item.note.number).padStart(2, "0");
          button.setAttribute(
            "aria-label",
            `${english ? "Preview note" : "预览注解"} ${item.note.number}`
          );
          return button;
        })
      );
      renderedChoices.set(
        view,
        choices.map(item => item.note)
      );
    }
    Array.from(
      view.switcher.querySelectorAll<HTMLButtonElement>("button")
    ).forEach((button, index) => {
      // A reused button must still return to the newly selected occurrence of this note.
      byOption.set(button, choices[index]);
      const pressed = String(choices[index].note === reference.note);
      if (button.getAttribute("aria-pressed") !== pressed)
        button.setAttribute("aria-pressed", pressed);
    });
  }

  function prune(live: ReadonlySet<NoteView>): void {
    for (const [key, view] of views) {
      if (live.has(view)) continue;
      view.card.remove();
      views.delete(key);
    }
  }

  function focused(): NoteView | undefined {
    const card = container.querySelector<HTMLElement>(
      '[data-preview="focused"]'
    );
    return card ? byCard.get(card) : undefined;
  }

  function dispose(): void {
    for (const view of views.values()) view.card.remove();
    views.clear();
    dock.card.remove();
  }

  return {
    dock,
    forGroup,
    configure,
    focused,
    prune,
    dispose,
    values: () => views.values(),
    referenceForCard: (card: HTMLElement) => byCard.get(card)?.reference,
    referenceForOption: (button: HTMLButtonElement) => byOption.get(button),
  };
}
