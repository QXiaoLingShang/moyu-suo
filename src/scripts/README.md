# 客户端脚本

这里负责 DOM 交互和 Astro 页面生命周期。页面及组件只导入需要的功能；没有统一启动所有功能的全站脚本入口。

## 功能入口

多文件功能以目录内的 `index.ts` 作为入口；内部文件按职责命名，不通过入口批量转导出私有实现。消费方可以导入目录路径，由 Astro / Vite 解析入口。

| 功能                                | 入口                                                         | 初始化与清理边界                                                    |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [首页](home/README.md)              | `home/index.ts`                                              | 首页导入；门户和氛围重复进入时检查各自 DOM 标记，交换前清理当前页面 |
| [文章增强](post/README.md)          | `post/index.ts`                                              | 文章页导入；协调当前文章的初始化和逆序清理                          |
| [Mermaid](mermaid/README.md)        | `mermaid/index.ts`                                           | 文章页懒加载；拥有渲染队列和每图状态                                |
| [边注](sidenotes/README.md)         | `sidenotes/index.ts`                                         | 每篇文章独立的选择、布局、观察器与详情                              |
| [阅读聚焦](reading-focus/README.md) | `reading-focus/index.ts`                                     | 文章节点及其工具栏；离页清理提示和监听                              |
| [分页](pagination/README.md)        | `pagination/index.ts`、`pagination/position.ts`              | 选择器由组件导入；路由定位由 Layout 全站导入，二者生命周期不同      |
| [媒体预览](media-preview/README.md) | `media-preview/controls.ts`、`media-preview/interactions.ts` | 由图片和 Mermaid 调用，不自行注册全站初始化                         |

单文件的 `theme.ts`、`siteHeader.ts`、`navigationHistory.ts`、`spoiler-tip.ts` 仍保留具名入口。[导航历史](navigation.md)拥有每条浏览记录的返回来源；`pageScrollLock.ts` 是所有覆盖层共用的滚动锁。功能模块只能释放自己获取的锁。

## 搜索

`search.ts` 由 `pages/search.astro` 导入。页面保留 Pagefind 容器、静态样式及功能开关；脚本负责空闲初始化、查询 URL 和清空查询，翻译表来自 `i18n/pagefind.ts`。

Pagefind 容器使用 `transition:persist`。初始化中的节点和已完成节点分别用 WeakSet 记录，异步加载前后核对节点仍属于当前页面；保留现有表单，避免重复创建 UI。开发时索引缺失显示构建提示，生产索引由 `pnpm build` 生成。不在这里增加缓存、全文排序或来源返回状态。

## 协作边界

- 常驻路由监听由 Layout 导入的模块注册一次；页面资源使用当前文章或 DOM 标记确认身份。交换页面时先清理旧资源，迟到的 Promise 不回写新页面。
- 纯路径、几何、选择计算放在 [utils](../utils/README.md)，依赖显式输入，不持有 DOM 或交互状态。样式从 Layout / 页面静态导入。
- 共享媒体能力放在 `media-preview/`；图片和图表各自拥有弹层的创建、关闭、焦点恢复和锁句柄，不互相接管内部状态。
- 阅读功能时以局部 README 中的状态与 DOM 契约为入口。全仓质量要求仍见[工程规范](../../docs/engineering/README.md)。
