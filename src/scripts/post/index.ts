import { setupArticleToc } from "./articleToc";
import { setupBackToTop } from "./backToTop";
import { setupArticleContentEnhancements } from "./contentEnhancements";
import { setupImageLightbox } from "./lightbox";
import { setupReadingProgress } from "./readingProgress";

type Cleanup = () => void;

let activeArticle: HTMLElement | null = null;
let pageCleanups: Cleanup[] = [];

function cleanupArticlePage(): void {
  for (const cleanup of pageCleanups.splice(0).reverse()) cleanup();
  activeArticle = null;
}

function initializeArticlePage(): void {
  const article = document.querySelector<HTMLElement>("#article");
  if (article === activeArticle) return;

  cleanupArticlePage();
  if (!article) return;

  activeArticle = article;
  pageCleanups = [
    setupReadingProgress(),
    setupBackToTop(),
    setupArticleToc(article),
    setupArticleContentEnhancements(article),
    setupImageLightbox(article),
  ];
}

document.addEventListener("astro:before-swap", cleanupArticlePage);
document.addEventListener("astro:page-load", initializeArticlePage);
document.addEventListener("astro:after-swap", () => {
  window.scrollTo({ left: 0, top: 0, behavior: "instant" });
});

initializeArticlePage();
