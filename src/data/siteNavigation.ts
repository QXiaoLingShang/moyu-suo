const NAVIGATION_KEYS = [
  "home",
  "posts",
  "about",
  "tags",
  "archives",
  "search",
] as const;

export type NavigationLabel = (typeof NAVIGATION_KEYS)[number];
export type NavigationIcon = NavigationLabel;
type NavigationId = NavigationLabel | "blog";

const BLOG_ROUTE_ROOT = "posts" as const;

export type NavigationItem = {
  id: NavigationId;
  label: NavigationLabel;
  route: string;
  icon: NavigationIcon;
};

// Global links switch between site sections; blog links stay local to that section.
// Adding a published module here keeps the header extensible without mixing its
// controls into the blog's own navigation.
export const globalNavigation: readonly NavigationItem[] = [
  { id: "home", label: "home", route: "", icon: "home" },
  { id: "blog", label: "posts", route: BLOG_ROUTE_ROOT, icon: "posts" },
  { id: "about", label: "about", route: "about", icon: "about" },
];

export const blogNavigation: readonly NavigationItem[] = [
  { id: "tags", label: "tags", route: "tags", icon: "tags" },
  { id: "archives", label: "archives", route: "archives", icon: "archives" },
  { id: "search", label: "search", route: "search", icon: "search" },
];

export const BLOG_ROUTE_ROOTS = [
  BLOG_ROUTE_ROOT,
  ...blogNavigation.map(item => item.route),
] as const;
