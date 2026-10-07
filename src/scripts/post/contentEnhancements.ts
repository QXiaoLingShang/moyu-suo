import { getUIString, UI_LANGUAGE_CHANGE_EVENT } from "@/i18n/client";
import { tplStr } from "@/i18n/format";

type CopyButtonPhrase = "post.copyCode" | "post.codeCopied";

export function setupArticleContentEnhancements(
  article: HTMLElement
): () => void {
  const controller = new AbortController();
  const headingLinks: Array<{
    link: HTMLAnchorElement;
    headingText: string;
  }> = [];
  const addedGroupClasses = new Set<HTMLElement>();
  const codeBlocks: Array<{
    block: HTMLPreElement;
    wrapper: HTMLDivElement;
    button: HTMLButtonElement;
    originalTabIndex: string | null;
  }> = [];
  const copyTimers = new Set<number>();

  const headings = Array.from(
    article.querySelectorAll<HTMLHeadingElement>("h2, h3, h4, h5, h6")
  ).filter(heading => !heading.closest("[data-footnotes]"));

  for (const heading of headings) {
    if (!heading.id) continue;
    if (!heading.classList.contains("group")) addedGroupClasses.add(heading);
    heading.classList.add("group");

    const link = document.createElement("a");
    link.className =
      "heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100";
    link.href = `#${heading.id}`;
    const headingText = heading.textContent.trim();
    link.setAttribute("aria-label", getHeadingLinkLabel(headingText));

    const marker = document.createElement("span");
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "#";
    link.append(marker);
    heading.append(link);
    headingLinks.push({ link, headingText });
  }

  for (const block of article.querySelectorAll<HTMLPreElement>("pre")) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const fileNameOffset = getComputedStyle(block)
      .getPropertyValue("--file-name-offset")
      .trim();

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "copy-code absolute end-3 -top-3 rounded bg-muted border border-muted px-2 py-1 text-xs leading-4 text-foreground font-medium";
    // The button is a sibling of pre, so it cannot inherit pre's offset variable.
    if (fileNameOffset) button.style.top = fileNameOffset;
    setCopyButtonPhrase(button, "post.copyCode");
    const originalTabIndex = block.getAttribute("tabindex");
    block.setAttribute("tabindex", "0");
    block.before(wrapper);
    wrapper.append(block, button);
    codeBlocks.push({ block, wrapper, button, originalTabIndex });

    button.addEventListener(
      "click",
      async () => {
        const code = block.querySelector("code");
        await navigator.clipboard.writeText(code?.innerText ?? "");
        setCopyButtonPhrase(button, "post.codeCopied");

        const timer = window.setTimeout(() => {
          copyTimers.delete(timer);
          setCopyButtonPhrase(button, "post.copyCode");
        }, 700);
        copyTimers.add(timer);
      },
      { signal: controller.signal }
    );
  }

  function getHeadingLinkLabel(headingText: string): string {
    return tplStr(getUIString("post.copySectionLink"), { title: headingText });
  }

  function setCopyButtonPhrase(
    button: HTMLButtonElement,
    phrase: CopyButtonPhrase
  ): void {
    button.dataset.i18n = phrase;
    button.textContent = getUIString(phrase);
  }

  function updateHeadingLinkLabels(): void {
    for (const { link, headingText } of headingLinks)
      link.setAttribute("aria-label", getHeadingLinkLabel(headingText));
  }

  document.addEventListener(UI_LANGUAGE_CHANGE_EVENT, updateHeadingLinkLabels, {
    signal: controller.signal,
  });

  return () => {
    controller.abort();
    copyTimers.forEach(timer => window.clearTimeout(timer));
    headingLinks.forEach(({ link }) => link.remove());
    addedGroupClasses.forEach(heading => heading.classList.remove("group"));

    for (const { block, wrapper, button, originalTabIndex } of codeBlocks) {
      button.remove();
      if (wrapper.parentElement) wrapper.replaceWith(block);
      if (originalTabIndex === null) block.removeAttribute("tabindex");
      else block.setAttribute("tabindex", originalTabIndex);
    }
  };
}
