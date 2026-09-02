# 小铃殇的摸鱼所

个人中文博客：Markdown 写作 + **Astro 静态生成**（AstroPaper 主题），部署于 GitHub Pages。

在线地址：<https://QXiaoLingShang.github.io/moyu-suo/>

## 目录结构

| 目录/文件 | 用途 |
|---|---|
| `posts/` | 文章源 `.md`（框架无关，内容归自己）。`_` 开头的文件不参与发布（`_template.md` = 新文章模板、`_README.md` = 写作约定） |
| `src/` `public/` | AstroPaper 主题与站点源码（写文章不用碰） |
| `astro-paper.config.ts` | 站点配置：标题 / 作者 / 社交链接 |
| `.github/workflows/deploy.yml` | push main 自动构建并部署 GitHub Pages |

## 写一篇文章

1. 复制 `posts/_template.md` → 改名（可放 `posts/<分类>/` 子目录，目录名会进 URL）
2. 填 frontmatter：`title` / `description` / `pubDatetime`（ISO 时间，记得带时区或 Z）
3. `draft: true` 期间不会发布（dev 也不显示）；写完删掉该行即发布
4. 图片用相对路径随文走（如 `![](assets/x.png)`），构建时自动优化

## 本地命令

```bash
npm install     # 首次
npm run dev     # 开发预览 http://localhost:4321/moyu-suo/
npm run build   # 构建 + 搜索索引（产物 dist/）
```

## 致谢

主题基于 [AstroPaper](https://github.com/satnaing/astro-paper)（MIT），站点样式与防剧透等功能为本站定制。
