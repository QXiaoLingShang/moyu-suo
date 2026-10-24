# 计算与路径工具

功能计算按使用领域归组，跨功能共用的小工具保留在根目录。客户端交互状态、监听器和 DOM 资源仍归 [scripts](../scripts/README.md)所有，不通过新增 `index.ts` 转导出整组工具。

## 功能目录

| 目录         | 职责与入口                                                                                                                                     | 消费方                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `home/`      | [环绕几何](home/homeGeometry.ts)、[指针几何](home/homePointerGeometry.ts)、[抽样](home/homePointerSampling.ts)、[水波](home/homeRippleWave.ts) | 首页页面及[首页脚本](../scripts/home/README.md) |
| `sidenotes/` | [几何](sidenotes/sidenoteGeometry.ts)、[选择](sidenotes/sidenoteSelection.ts)、[布局](sidenotes/sidenoteLayout.ts)                             | [边注模块](../scripts/sidenotes/README.md)      |
| `posts/`     | [文章集合与地址](posts/README.md)：筛选、排序、标签及文章路径                                                                                  | 页面、文章卡片、RSS 与内容生成                  |
| `markdown/`  | [构建插件](markdown/README.md)：公式、脚注标记与代码文件名                                                                                     | 根目录的 `astro.config.ts`                      |

首页和边注的计算接收几何、内容或选择快照；DOM 测量、缓存和当前选择由交互模块持有。文章筛选则依赖当前时间、配置和开发模式，不能假设整个目录都是脱离运行环境的纯函数。

## 根目录的共享工具

- 路径与命名：`withBase.ts`、`slugify.ts`、`toTransitionName.ts`。
- 栏目与分页：`navigation.ts`、`pagination.ts`，由静态组件、路由和客户端共同消费。
- 日期与图片元数据：`formatDate.ts`、`getFontPathByWeight.ts`、`resolveDefaultOgImagePath.ts`。

消费方直接导入所需文件，保持依赖明确。不要让浏览器计算通过聚合入口加载文章集合或构建插件；函数能否直接在 Node 测试中运行，取决于其配置、Astro 和 `import.meta.env` 依赖。
