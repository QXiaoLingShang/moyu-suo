type HomeEntranceBase = {
  id: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
};

export type HomeEntrance = HomeEntranceBase &
  (
    | { visibility: "live"; route: string }
    | { visibility: "planned" | "hidden"; route?: never }
  );

// Entries are paired in reading order: left, right, then the next row.
// A planned entry reserves its place without implying that a destination exists.
export const homeEntrances: readonly HomeEntrance[] = [
  {
    id: "posts",
    title: { zh: "文章", en: "Posts" },
    description: {
      zh: "从最近写下的文字开始阅读。",
      en: "Start with the latest writing.",
    },
    route: "posts",
    visibility: "live",
  },
  {
    id: "projects",
    title: { zh: "项目", en: "Projects" },
    description: { zh: "一些有趣的尝试。", en: "Experiments and projects." },
    visibility: "planned",
  },
  {
    id: "about",
    title: { zh: "关于", en: "About" },
    description: { zh: "认识这里的我。", en: "A little more about me." },
    route: "about",
    visibility: "live",
  },
  {
    id: "gallery",
    title: { zh: "相册", en: "Gallery" },
    description: { zh: "收集生活的片段。", en: "Fragments of everyday life." },
    visibility: "planned",
  },
  {
    id: "archives",
    title: { zh: "归档", en: "Archives" },
    description: { zh: "按时间翻阅文章。", en: "Browse writing by date." },
    route: "archives",
    visibility: "live",
  },
  {
    id: "friends",
    title: { zh: "友链", en: "Friends" },
    description: { zh: "遇见有趣的人。", en: "People worth visiting." },
    visibility: "planned",
  },
];
