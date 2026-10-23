/** The first URL comes from Astro, including its base and tag/locale segments. */
export function getPaginationHref({
  firstPageUrl,
  page,
}: {
  firstPageUrl: string;
  page: number;
}): string {
  const root = firstPageUrl.replace(/\/+$/, "");
  return page === 1 ? `${root}/` : `${root}/${page}/`;
}

/** Preserve retired four-post listing URLs without overriding future real pages. */
export function withLegacyPaginationUrls<
  T extends { props: { page: { url: { current: string } } } },
>({ pages, legacyPages }: { pages: T[]; legacyPages: T[] }) {
  const lastPage = pages.at(-1);
  if (!lastPage) return [];
  // All controls and retired URLs use the same canonical trailing slash.
  const redirectTo = new URL(
    lastPage.props.page.url.current,
    "https://pagination.invalid"
  ).pathname.replace(/\/?$/, "/");
  return [
    ...pages.map(route => ({
      ...route,
      props: { ...route.props, redirectTo: undefined },
    })),
    ...legacyPages.slice(pages.length).map(route => ({
      ...route,
      props: {
        ...route.props,
        // Location headers require ASCII; URL also preserves already encoded tags.
        redirectTo,
      },
    })),
  ];
}
