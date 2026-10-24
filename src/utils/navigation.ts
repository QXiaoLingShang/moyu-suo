import {
  BLOG_ROUTE_ROOT,
  blogNavigation,
  globalNavigation,
  type NavigationItem,
  type NavigationLabel,
} from "../data/siteNavigation.ts";
import type { UIStrings } from "../i18n/types.ts";

const sections = [...globalNavigation, ...blogNavigation];
const returnLabels: Record<NavigationLabel, keyof UIStrings["navigation"]> = {
  home: "backToHome",
  posts: "backToPosts",
  tags: "backToTags",
  about: "backToAbout",
  archives: "backToArchives",
  search: "backToSearch",
};

function isArticleRoute(segments: readonly string[]): boolean {
  const [root, detail] = segments;
  return (
    root === BLOG_ROUTE_ROOT &&
    !!detail &&
    (segments.length > 2 || !/^\d+$/.test(detail))
  );
}

/** Keep encoded content segments intact; only base and supported locale are routing. */
export function getNavigationSegments({
  pathname,
  basePath,
  locales = [],
}: {
  pathname: string;
  basePath: string;
  locales?: readonly string[];
}): string[] | undefined {
  const base = basePath.replace(/\/+$/, "");
  if (base && pathname !== base && !pathname.startsWith(`${base}/`)) return;
  const segments = pathname.slice(base.length).split("/").filter(Boolean);
  if (locales.includes(segments[0])) segments.shift();
  return segments;
}

/** Ancestors reflect content hierarchy, independently of how a visitor arrived. */
export function getPageAncestors(
  segments: readonly string[]
): [NavigationItem, ...NavigationItem[]] {
  const home = globalNavigation.find(item => item.id === "home");
  const blog = globalNavigation.find(item => item.route === BLOG_ROUTE_ROOT);
  if (!home || !blog)
    throw new Error("Home and Blog navigation must be configured.");
  const [root, detail] = segments;
  const section = blogNavigation.find(item => item.route === root);
  const ancestors: [NavigationItem, ...NavigationItem[]] = [home];
  if (section) ancestors.push(blog);
  if (section?.id === "tags" && detail) ancestors.push(section);
  if (isArticleRoute(segments)) ancestors.push(blog);
  return ancestors;
}

export function getReturnLabel({
  segments,
  tagName,
}: {
  segments: readonly string[];
  tagName?: string;
}): {
  key: `navigation.${keyof UIStrings["navigation"]}`;
  params?: Record<string, string>;
} {
  const [root, detail] = segments;
  if (isArticleRoute(segments)) return { key: "navigation.backToArticle" };
  if (root === "tags" && detail)
    return tagName
      ? { key: "navigation.backToTag", params: { tag: tagName } }
      : { key: "navigation.backToTaggedPosts" };
  const section = sections.find(item => item.route === (root ?? ""));
  return {
    key: `navigation.${section ? returnLabels[section.label] : "backToPage"}`,
  };
}
