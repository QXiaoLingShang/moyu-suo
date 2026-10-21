# Icons

主题沿用 AstroPaper 的本地 svg 副本模式（Astro 会把 `.svg` 导入渲染为组件）：

```astro
import IconWorld from "@/assets/icons/IconWorld.svg";
<IconWorld class="size-4" />
```

## 来源与版本（防风格漂移，务必遵守）

- 全部图标来自 **tabler 图标库 v2.47.0**（与主题自带 16 枚同代同风格）。
  - 下载源：`https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/<name>.svg`
  - 复制时保留主题的文件约定：单行属性 + `class="icon icon-tabler icons-tabler-outline icon-tabler-<name>"`
- **禁止**从 `@tabler/icons@latest`（v3/v4 小数几何）或其他图标库混入——与 v2 代 m-arc 风格会有可见代差。
- 若某天想整体迁移图标体系（如 astro-icon + Iconify），应一次性替换全部图标，不要混用。

## Mermaid 与媒体预览图标

本轮交互新增的图标同样来自 Tabler v2.47.0：`code.svg`、`chart-dots-3.svg`、`maximize.svg`、`zoom-in.svg`、`zoom-out.svg`、`focus-centered.svg`、`copy.svg`，对应源码/图表开关、放大、缩放、适应视口和源码复制控件。统一从本地 SVG 资产导入，不在脚本中维护另一份图标路径。
