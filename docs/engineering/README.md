# 工程规范索引

这里记录仓库级工程约定。改动前先阅读本索引，再按涉及的层阅读对应文档；跨层改动需要同时检查所有相关约定。功能内部的状态机和 DOM 契约继续记录在对应功能的局部说明中（如 README 或架构说明），并由本索引链接。

## 按改动范围阅读

| 改动范围 | 阅读文档 |
| --- | --- |
| 所有改动 | [项目原则](principles.md)、[质量与交付](quality.md) |
| 文件职责、状态所有权、模块接口 | [架构与接口](architecture.md) |
| Astro 页面、组件、客户端交互、可访问性 | [前端约定](frontend.md) |
| Tailwind、CSS、主题变量、DOM 样式契约 | [样式约定](styles.md) |
| TypeScript、命名、类型和注释 | [TypeScript 约定](typescript.md) |

## 局部功能说明

- **源码与公共能力**
  - 源码与文档分布：[src/README.md](../../src/README.md)
  - 客户端入口与生命周期：[src/scripts/README.md](../../src/scripts/README.md)
  - 计算与路径工具：[src/utils/README.md](../../src/utils/README.md)
  - 图标来源与格式：[src/assets/icons/README.md](../../src/assets/icons/README.md)

- **首页**
  - 入口数据：[src/data/README.md](../../src/data/README.md)
  - 首页交互与指针架构：[src/scripts/home/README.md](../../src/scripts/home/README.md)

- **Blog 目录与导航**
  - 导航层级、来源与历史恢复：[src/scripts/navigation.md](../../src/scripts/navigation.md)
  - 文章与标签列表分页：[src/scripts/pagination/README.md](../../src/scripts/pagination/README.md)
  - 搜索初始化与查询 URL：[src/scripts/README.md](../../src/scripts/README.md#搜索)

- **文章阅读页**
  - 页面增强、目录与图片预览：[src/scripts/post/README.md](../../src/scripts/post/README.md)
  - 阅读聚焦：[src/scripts/reading-focus/README.md](../../src/scripts/reading-focus/README.md)
  - 边注解：[src/scripts/sidenotes/README.md](../../src/scripts/sidenotes/README.md)
  - Mermaid 图表、源码与聚焦：[src/scripts/mermaid/README.md](../../src/scripts/mermaid/README.md)
  - 图片与图表共享预览：[src/scripts/media-preview/README.md](../../src/scripts/media-preview/README.md)

- **写作与发布**
  - 文章格式与发布规则：[posts/_README.md](../../posts/_README.md)
  - Markdown 构建插件：[src/utils/markdown/README.md](../../src/utils/markdown/README.md)

局部说明补充对应功能，不覆盖仓库级原则。实现、类型和测试是行为依据；文档要随接口或约束的实际变化同步更新。

临时审查、调试和验证产物的保存与发布边界见[质量与交付](quality.md#临时文件与发布边界)，不在本索引登记或依赖临时报告。
