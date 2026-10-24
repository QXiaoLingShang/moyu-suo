# 源码导航

从需要修改的行为找到实现入口。全仓的职责和接口约定见[工程规范](../docs/engineering/README.md)；这里以及各功能旁的 Markdown 记录当前实现、状态归属和维护边界。

## 按功能阅读

| 修改内容                         | 入口与局部说明                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| 首页入口与指针、背景动效         | [页面](pages/index.astro)、[首页脚本](scripts/home/README.md)、[入口数据](data/README.md) |
| Blog 栏目、面包屑、来源返回      | [顶部导航](components/PageNavigation.astro)、[导航规则](scripts/navigation.md)            |
| 文章与标签列表分页               | [分页模块](scripts/pagination/README.md)、[呈现组件](components/Pagination.astro)         |
| 文章目录、代码复制、图片预览     | [文章增强](scripts/post/README.md)                                                        |
| 图片与图表的共享缩放、拖拽、控件 | [媒体预览](scripts/media-preview/README.md)                                               |
| Mermaid 图表、源码切换与聚焦     | [图表模块](scripts/mermaid/README.md)                                                     |
| 边注预览、详情及精确引用         | [边注模块](scripts/sidenotes/README.md)                                                   |
| 阅读聚焦                         | [阅读聚焦模块](scripts/reading-focus/README.md)                                           |
| 搜索初始化与查询 URL             | [脚本导航中的搜索说明](scripts/README.md#搜索)                                            |
| 部署路径、内容筛选与几何计算     | [计算与路径工具](utils/README.md)                                                         |

## 阅读源码的顺序

页面在 `pages/` 取数并组合 `layouts/`、`components/`；复杂浏览器交互进入 `scripts/`。先读功能 README，再看入口及其直接依赖。客户端模块与生命周期的索引见 [scripts/README.md](scripts/README.md)。

站点可配置项从根目录的 [astro-paper.config.ts](../astro-paper.config.ts) 修改，`config.ts` 只负责补齐默认值，类型位于 `types/config.ts`。固定界面文案在 `i18n/lang/`，文章和原始标签名来自内容。文章源及其写作约定位于仓库根的 [posts/](../posts/_README.md)。

共享样式和主题变量在 `styles/`；页面或组件自己的局部样式可以随 Astro 文件维护。功能脚本通过明确的 class / `data-*` 属性消费样式，不负责重新定义主题或全站层级。

## 源码文档与 docs 的边界

- `src/**/README.md` 随功能维护：入口、必要的文件分工、状态与资源所有权、外部依赖、DOM / 事件契约和回归入口。详细专题可以另用 `.md`，由该 README 链接，例如首页的指针状态机说明。
- `docs/engineering/` 维护跨功能的稳定规范，`docs/TODO.md` 只记录未完成事项。局部 README 通过链接引用它们，不复制整份规范或累计任务流水。临时审查、调试和验证记录只存放在已忽略目录或工作区外，不提交或上传，正式说明不依赖这些报告。
- 不要求每个目录都有 README，也不把临时代码清单、自动生成的行数或过时方案写成长期契约。接口变化时同时更新相邻说明和索引。
- `pages/` 参与文件路由，不在其中增加会作为页面发布的普通 `README.md`。页面说明放在这里或对应脚本模块旁。
