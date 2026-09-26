import type { CollectionEntry } from "astro:content";
import config from "@/config";
import { slugifyStr } from "./slugify";

export type PostFilterOptions = {
  /** Include posts tagged `test` in this selection. */
  includeTestPosts?: boolean;
};

export function isTestPost(post: CollectionEntry<"posts">) {
  return post.data.tags.some(tag => slugifyStr(tag) === "test");
}

/**
 * Determines whether a post is eligible for a public listing.
 *
 * - Excludes drafts always
 * - Excludes `test` posts unless a test-aware route explicitly opts in
 * - In production, excludes scheduled posts until `pubDatetime` minus the configured margin
 * - In dev, eligible non-draft posts bypass the scheduled-date check
 */
export function postFilter(
  post: CollectionEntry<"posts">,
  { includeTestPosts = false }: PostFilterOptions = {}
) {
  const { data } = post;
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  return (
    !data.draft &&
    (includeTestPosts || !isTestPost(post)) &&
    (import.meta.env.DEV || isPublishTimePassed)
  );
}
