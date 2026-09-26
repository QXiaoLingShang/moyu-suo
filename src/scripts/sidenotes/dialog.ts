import { NOTE_DIALOG_BEFORE_CLOSE, isElementVisible } from "./dom";
import {
  noteLabel,
  preferredReference,
  type Note,
  type NoteReference,
} from "./model";

type DialogOptions = {
  article: HTMLElement;
  section: HTMLElement;
  notes: readonly Note[];
  english: boolean;
  signal: AbortSignal;
  onClose: () => void;
  returnTarget: () => HTMLElement | undefined;
};
type OpenOptions = {
  trigger?: HTMLElement;
  choices?: readonly NoteReference[];
};

/** Keep body transfer and scroll restoration together so closing cannot leave either behind. */
export function createNoteDialog({
  article,
  section,
  notes,
  english: en,
  signal,
  onClose,
  returnTarget,
}: DialogOptions) {
  const dialog = document.createElement("dialog");
  dialog.className = "sidenote-dialog";
  dialog.dataset.pagefindIgnore = "";
  dialog.setAttribute("aria-label", en ? "Note details" : "注解详情");
  const dialogHeader = document.createElement("div");
  dialogHeader.className = "sidenote-dialog-header";
  const dialogTitle = document.createElement("strong");
  const dialogReturn = document.createElement("a");
  dialogReturn.className = "sidenote-return";
  dialogReturn.textContent = en ? "Back to text ↗" : "返回正文 ↗";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", en ? "Close note" : "关闭注解");
  dialogHeader.append(dialogTitle, dialogReturn, close);
  const content = document.createElement("div");
  content.className = "sidenote-dialog-content";
  const footer = document.createElement("div");
  footer.className = "sidenote-dialog-footer";
  const previous = document.createElement("button");
  const next = document.createElement("button");
  previous.type = next.type = "button";
  previous.textContent = en ? "← Previous" : "← 上一条";
  next.textContent = en ? "Next →" : "下一条 →";
  const counter = document.createElement("span");
  counter.setAttribute("aria-live", "polite");
  footer.append(previous, counter, next);
  dialog.append(dialogHeader, content, footer);
  article.append(dialog);
  let modalNote: Note | null = null,
    opener: HTMLElement | null = null;
  let modalItems: NoteReference[] = [];
  let modalAllNotes = true;
  let sourceMinHeight = "";
  let rootOverflow = "",
    bodyOverflow = "",
    rootGutter = "";
  function restoreBody() {
    if (modalNote) {
      modalNote.source.append(modalNote.body);
      modalNote.source.style.minHeight = sourceMinHeight;
    }
    modalNote = null;
  }
  function closeDetail({
    restoreFocus = true,
  }: { restoreFocus?: boolean } = {}) {
    if (!dialog.open) return;
    dialog.dispatchEvent(
      new Event(NOTE_DIALOG_BEFORE_CLOSE, { bubbles: true })
    );
    dialog.close();
    restoreBody();
    document.documentElement.style.overflowY = rootOverflow;
    document.documentElement.style.scrollbarGutter = rootGutter;
    document.body.style.overflow = bodyOverflow;
    if (restoreFocus && opener?.isConnected) {
      const target =
        opener.closest("[inert]") || !isElementVisible(opener)
          ? returnTarget()
          : opener;
      target?.focus({ preventScroll: true });
    }
    onClose();
  }
  function show(reference: NoteReference, trigger?: HTMLElement) {
    const { note, ref } = reference;
    const opening = !dialog.open;
    if (!dialog.open) {
      opener =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      rootOverflow = document.documentElement.style.overflowY;
      rootGutter = document.documentElement.style.scrollbarGutter;
      if (
        innerWidth > document.documentElement.clientWidth &&
        !getComputedStyle(document.documentElement).scrollbarGutter.includes(
          "stable"
        )
      )
        document.documentElement.style.scrollbarGutter = "stable";
      bodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflowY = "hidden";
      document.body.style.overflow = "hidden";
    }
    // Switching notes also moves the image viewer's host; close it before restoring the body.
    if (dialog.open)
      dialog.dispatchEvent(
        new Event(NOTE_DIALOG_BEFORE_CLOSE, { bubbles: true })
      );
    restoreBody();
    modalNote = note;
    // Moving the unique rich body must not shorten a visible endnote list or
    // clamp the page's scroll position while its detail dialog is open.
    sourceMinHeight = note.source.style.minHeight;
    if (!section.hidden)
      note.source.style.minHeight = `${note.source.getBoundingClientRect().height}px`;
    content.append(note.body);
    dialogTitle.textContent = noteLabel(note, en);
    const returnRef = ref ?? note.refs.find(isElementVisible) ?? note.refs[0];
    if (returnRef && note.refs.length > 1)
      dialogTitle.textContent += ` · ${note.refs.indexOf(returnRef) + 1}/${note.refs.length}`;
    dialogReturn.hidden = !returnRef;
    if (returnRef) dialogReturn.href = `#${encodeURIComponent(returnRef.id)}`;
    const position = modalItems.findIndex(item => item.note === note);
    counter.textContent = `${modalAllNotes ? (en ? "All notes" : "全篇") : en ? "This position" : "同位置"} · ${position + 1} / ${modalItems.length}`;
    previous.disabled = position === 0;
    next.disabled = position === modalItems.length - 1;
    content.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
    if (
      opening ||
      (document.activeElement === previous && previous.disabled) ||
      (document.activeElement === next && next.disabled)
    )
      close.focus({ preventScroll: true });
  }

  function open(
    reference: NoteReference,
    { trigger, choices = [] }: OpenOptions = {}
  ): void {
    modalAllNotes = choices.length < 2;
    modalItems = modalAllNotes
      ? notes.map(note =>
          note === reference.note
            ? reference
            : { note, ref: preferredReference(note) }
        )
      : [...choices];
    show(reference, trigger);
  }
  close.addEventListener("click", () => closeDetail(), { signal });
  function step(offset: number): void {
    if (!modalNote) return;
    const position = modalItems.findIndex(item => item.note === modalNote);
    const reference = modalItems[position + offset];
    if (position >= 0 && reference) show(reference);
  }
  previous.addEventListener("click", () => step(-1), { signal });
  next.addEventListener("click", () => step(1), { signal });
  dialog.addEventListener(
    "cancel",
    event => {
      event.preventDefault();
      if (!dialog.querySelector("[data-image-lightbox]")) closeDetail();
    },
    { signal }
  );
  let backdropDown = false;
  dialog.addEventListener(
    "pointerdown",
    event => {
      backdropDown = event.target === dialog;
    },
    { signal }
  );
  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog && backdropDown) closeDetail();
      backdropDown = false;
    },
    { signal }
  );

  return {
    element: dialog,
    get isOpen() {
      return dialog.open;
    },
    open,
    close: closeDetail,
    dispose() {
      closeDetail({ restoreFocus: false });
      dialog.remove();
    },
  };
}
