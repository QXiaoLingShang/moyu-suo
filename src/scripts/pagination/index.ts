import { setupPaginationReel } from "./reel";

/** Native details/links remain usable without the focus and scrolling enhancement. */
class PaginationPicker extends HTMLElement {
  private cleanup?: () => void;

  connectedCallback(): void {
    this.cleanup?.();
    const details = this.querySelector("details");
    const trigger = details?.querySelector("summary");
    const reel = details?.querySelector<HTMLElement>(".pagination-reel");
    if (!details || !trigger || !reel) return;
    const controller = new AbortController();
    const { signal } = controller;
    const interaction = setupPaginationReel(reel);
    details.addEventListener(
      "toggle",
      () => {
        if (details.open) interaction.focusCurrent();
        else interaction.stop();
      },
      { signal }
    );
    document.addEventListener(
      "pointerdown",
      event => {
        if (event.target instanceof Node && !this.contains(event.target))
          details.open = false;
      },
      { signal }
    );
    document.addEventListener(
      "keydown",
      event => {
        if (event.defaultPrevented || event.key !== "Escape" || !details.open)
          return;
        event.preventDefault();
        details.open = false;
        trigger.focus({ preventScroll: true });
      },
      { signal }
    );
    this.addEventListener(
      "focusout",
      event => {
        if (
          event.relatedTarget instanceof Node &&
          !this.contains(event.relatedTarget)
        )
          details.open = false;
      },
      { signal }
    );
    this.cleanup = () => {
      controller.abort();
      interaction.dispose();
    };
  }
  disconnectedCallback(): void {
    this.cleanup?.();
    this.cleanup = undefined;
  }
}
if (!customElements.get("pagination-picker"))
  customElements.define("pagination-picker", PaginationPicker);
