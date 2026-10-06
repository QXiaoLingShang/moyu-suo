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

- 文章格式与发布规则：[posts/_README.md](../../posts/_README.md)
- 首页入口数据：[src/data/README.md](../../src/data/README.md)
- 首页指针动效状态和 DOM 契约：[src/scripts/homePointerArchitecture.md](../../src/scripts/homePointerArchitecture.md)
- 阅读聚焦：[src/scripts/reading-focus/README.md](../../src/scripts/reading-focus/README.md)
- 边注解：[src/scripts/sidenotes/README.md](../../src/scripts/sidenotes/README.md)
- 图标来源与格式：[src/assets/icons/README.md](../../src/assets/icons/README.md)

局部说明补充对应功能，不覆盖仓库级原则。实现、类型和测试是行为依据；文档要随接口或约束的实际变化同步更新。
