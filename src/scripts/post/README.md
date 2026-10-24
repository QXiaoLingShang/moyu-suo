# 文章页面增强

文章路由导入 `index.ts`。入口持有当前文章身份和清理函数列表，在 `astro:before-swap` 逆序清理，在 `astro:page-load` 初始化；相同文章节点不会重复增强。

| 文件                     | 职责                                           |
| ------------------------ | ---------------------------------------------- |
| `articleToc.ts`          | 文章目录、当前标题与窄屏目录开关               |
| `backToTop.ts`           | 返回顶部按钮                                   |
| `readingProgress.ts`     | 文章阅读进度                                   |
| `contentEnhancements.ts` | 标题链接与普通代码块的复制控件、语言更新和还原 |
| `lightbox.ts`            | 图片加载、预览覆盖层、焦点与锁的生命周期       |

每项增强返回自己的清理函数。离页后异步复制不再更新旧按钮，新增的包装层、属性和控件在清理时按原始状态还原。

Mermaid、边注和阅读聚焦是各自持有状态的独立功能，由文章页按需导入，不由本入口重复初始化。普通代码增强跳过 Mermaid 围栏，即使图表模块尚在懒加载，也不能生成第二套包装和控件。

图片的缩放与拖拽调用 [media-preview](../media-preview/README.md)。图片弹层仍由 `lightbox.ts` 管理；`sidenote:before-close` 时先关闭边注中的图片，再交还外层滚动锁。图表聚焦的生命周期见 [Mermaid](../mermaid/README.md)，来源返回见[导航](../navigation.md)。
