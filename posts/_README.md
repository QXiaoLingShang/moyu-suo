# posts（文章源）

blog 文章一律以 `.md` 存放于此，一篇一个文件。本目录在仓库根、与生成器解耦（`_` 开头的文件/目录不参与发布，本文件即靠此前缀隐身）。

> **新文章 = 复制 `_template.md`**（自带元数据注释与写作骨架），改名后填元数据即可开写。

## 组织与 URL

- **目录 = 分类**：`posts/dev/foo.md` → URL `/posts/dev/foo/`；目录名 + 文件名拼出 URL
- 目录与文件名用 **ascii 短名**（中文目录名会 percent-encode 成一长串）；中文标题写进 front matter
- 归档列表（首页/标签/归档页）不受目录影响，按 front matter 排序

## 图片等本地资源

- **正文插图**：放文章同目录，md 相对引用 `![](a.png)` → Astro 自动优化（hash 命名 / 转 webp / 懒加载 / 尺寸），换生成器时图随文章走不丢
- **全站共用图 / 封面**：放 `public/images/xxx.png`，绝对路径 `/images/xxx.png` 引用
- 不要动 `src/assets`（那是主题自己的资源）

## front matter（生成器要求）

| 字段 | 说明 |
|---|---|
| `title` | 必填 |
| `description` | 必填，列表页/摘要用 |
| `pubDatetime` | 必填，ISO 格式；**未来时间 = 定时发布**（届时才上架） |
| `draft` | 草稿置 `true` → 构建与 dev 都隐藏；发布删除 |
| `excludeFromRss` | 置 `true` → 文章仍正常发布，但不收录进 RSS |
| `tags` | 可选，数组 |
| `status` | 非必填，给人看的状态（草稿/待核实/可发布），生成器透传不报错 |

示例：

```yaml
---
title: 文章标题
pubDatetime: 2026-09-03T00:00:00.000Z
description: 一句话摘要
draft: true
excludeFromRss: true
tags: ["AI"]
---
```

## 防剧透（可选）

行内黑条：悬停/按住才显示内容（Obsidian 预览不生效，发布后可用）：

```md
结局是 <span class="spoiler">主角其实没死</span>，
另一个剧透 <span class="spoiler">也是假的</span>。
```
