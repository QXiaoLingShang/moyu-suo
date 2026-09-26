import type { CollectionEntry } from "astro:content";
import { postFilter, type PostFilterOptions } from "./postFilter";

/**
 * Returns eligible posts sorted by “last updated” descending (uses `modDatetime`
 * when present, otherwise `pubDatetime`). Test posts are omitted by default;
 * tag pages and detail page generation can opt in.
 *
 * Note: filtering respects drafts and scheduled posts via `postFilter()`.
 */
export function getSortedPosts(
  posts: CollectionEntry<"posts">[],
  options: PostFilterOptions = {}
) {
  return posts
    .filter(post => postFilter(post, options))
    .sort(
      (a, b) =>
        (b.data.modDatetime ?? b.data.pubDatetime).getTime() -
        (a.data.modDatetime ?? a.data.pubDatetime).getTime()
    );
}
