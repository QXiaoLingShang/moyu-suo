import { defineAstroPaperConfig } from "./src/types/config";

// 站点全局配置。TODO(上线前必改):
//   site.url      -> 你的 GitHub Pages 地址（如 https://用户名.github.io）
//   site.author   -> 作者名（会出现在文章与 RSS）
//   site.profile  -> 个人主页链接
//   site.title    -> 站点标题
// 部署为 <user>.github.io/blog 项目站时 base="/blog/" 见 astro.config.ts；
// 若仓库本身就是 <user>.github.io 根站，把那里改成 ""。
export default defineAstroPaperConfig({
  site: {
    url: "https://QXiaoLingShang.github.io",
    title: "小铃殇的摸鱼所",
    description: "个人技术博客（中文为主）",
    author: "小铃殇",
    profile: "https://github.com/QXiaoLingShang",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    // 两个开关独立生效；边注解仅在宽屏留白足够时显示。
    showSidenotes: true,
    // 关闭文末列表后，上标仍可打开详情；打印和无 JS 时保留列表。
    showEndnotes: true,
    // 文章源在仓库根 posts/，与主题自带编辑链接不一致，先关闭
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [{ name: "github", url: "https://github.com/QXiaoLingShang" }],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
