import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";
import { slugifyStr } from "./slugify";

/**
 * Builds a de-duplicated, sorted tag list from posts.
 *
 * - Drafts and scheduled posts are excluded via `postFilter()`; published test
 *   posts are included so the `test` tag can be reached
 * - `tag` is the slug used in URLs; `tagName` is the original label for display
 * - Uniqueness is based on the slug (so differently-cased labels collapse)
 */
export function getUniqueTags(posts: CollectionEntry<"posts">[]) {
  const tagNamesBySlug = new Map<string, string>();
  for (const post of posts) {
    if (!postFilter(post, { includeTestPosts: true })) continue;
    for (const tagName of post.data.tags) {
      const tag = slugifyStr(tagName);
      if (!tagNamesBySlug.has(tag)) tagNamesBySlug.set(tag, tagName);
    }
  }
  return [...tagNamesBySlug]
    .map(([tag, tagName]) => ({ tag, tagName }))
    .sort((tagA, tagB) => tagA.tag.localeCompare(tagB.tag));
}
