import {
  isReadingFocusStyle,
  type ReadingFocusPreferences,
} from "./preferences";

type ControlsOptions = {
  toolbar: HTMLElement;
  menu: HTMLDetailsElement;
  signal: AbortSignal;
  initialPreferences: Readonly<ReadingFocusPreferences>;
  onInput: (patch: Partial<ReadingFocusPreferences>) => void;
  onCommit: () => void;
  onToggle: () => void;
};

export function bindReadingFocusControls({
  toolbar,
  menu,
  signal,
  initialPreferences,
  onInput,
  onCommit,
  onToggle,
}: ControlsOptions) {
  const pointerToggle = menu.querySelector<HTMLInputElement>(
    "[data-reading-focus-toggle]"
  );
  const tocToggle = menu.querySelector<HTMLInputElement>(
    "[data-reading-focus-toc-toggle]"
  );
  const styleInputs = Array.from(
    menu.querySelectorAll<HTMLInputElement>("[data-reading-focus-style]")
  );
  const durationInput = menu.querySelector<HTMLInputElement>(
    "#reading-focus-duration"
  );
  const offsetInput = menu.querySelector<HTMLInputElement>(
    "#reading-focus-offset"
  );
  const durationValue = menu.querySelector(
    "[data-reading-focus-duration-value]"
  );
  const offsetValue = menu.querySelector("[data-reading-focus-offset-value]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerRow = pointerToggle?.closest<HTMLElement>(
    ".reading-focus-switch-row"
  );
  let currentPreferences = { ...initialPreferences };

  function render(preferences: Readonly<ReadingFocusPreferences>): void {
    if (pointerToggle) {
      pointerToggle.checked = preferences.enabled && !reducedMotion.matches;
      pointerToggle.disabled = reducedMotion.matches;
    }
    pointerRow?.toggleAttribute("data-disabled", reducedMotion.matches);
    if (tocToggle) tocToggle.checked = preferences.highlightTocTarget;
    for (const input of styleInputs)
      input.checked = input.value === preferences.style;
    const seconds = String(preferences.highlightDuration / 1000);
    const offset = String(preferences.headingOffsetPercent);
    if (durationInput) durationInput.value = seconds;
    if (offsetInput) offsetInput.value = offset;
    if (durationValue) durationValue.textContent = seconds;
    if (offsetValue) offsetValue.textContent = offset;
  }

  function updatePreferences(patch: Partial<ReadingFocusPreferences>): void {
    currentPreferences = { ...currentPreferences, ...patch };
    onInput(patch);
  }

  reducedMotion.addEventListener(
    "change",
    () => {
      render(currentPreferences);
      onToggle();
    },
    { signal }
  );

  menu.addEventListener(
    "input",
    event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input === pointerToggle)
        updatePreferences({ enabled: input.checked });
      else if (input === tocToggle)
        updatePreferences({ highlightTocTarget: input.checked });
      else if (
        input === durationInput &&
        Number.isFinite(input.valueAsNumber)
      ) {
        updatePreferences({ highlightDuration: input.valueAsNumber * 1000 });
        if (durationValue) durationValue.textContent = input.value;
      } else if (
        input === offsetInput &&
        Number.isFinite(input.valueAsNumber)
      ) {
        updatePreferences({ headingOffsetPercent: input.valueAsNumber });
        if (offsetValue) offsetValue.textContent = input.value;
      } else if (
        styleInputs.includes(input) &&
        input.checked &&
        isReadingFocusStyle(input.value)
      )
        updatePreferences({ style: input.value });
    },
    { signal }
  );
  // Sliders preview on input; synchronous storage writes wait until the gesture ends.
  menu.addEventListener("change", onCommit, { signal });
  menu.addEventListener("toggle", onToggle, { signal });
  menu.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape" || !menu.open) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector<HTMLElement>("summary")?.focus();
    },
    { signal }
  );
  menu.addEventListener(
    "focusout",
    event => {
      // Label activation can briefly clear focus before focusing its input.
      if (
        event.relatedTarget instanceof Node &&
        !menu.contains(event.relatedTarget)
      )
        menu.open = false;
    },
    { signal }
  );
  document.addEventListener(
    "pointerdown",
    event => {
      if (
        menu.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      )
        menu.open = false;
    },
    { signal }
  );
  toolbar.hidden = false;
  render(initialPreferences);
  signal.addEventListener(
    "abort",
    () => {
      toolbar.hidden = true;
    },
    { once: true }
  );
}
