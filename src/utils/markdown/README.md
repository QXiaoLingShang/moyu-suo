# Markdown 构建插件

本目录由根目录的 [astro.config.ts](../../../astro.config.ts)注册，处理 Markdown / HTML 语法树和代码块。运行在内容构建阶段，不导入客户端交互模块。

| 文件                        | 职责与顺序                                                                     |
| --------------------------- | ------------------------------------------------------------------------------ |
| `remarkDisplayMath.ts`      | 在 `remark-math` 之后识别双美元分隔的公式，将同段正文拆开，交给后续 KaTeX 渲染 |
| `rehypeFootnoteBrackets.ts` | 为明确的脚注引用加入文字方括号；保留引用链接与 ID，已有括号时不重复添加        |
| `transformerFileName.js`    | Shiki 文件名标记及 `--file-name-offset`；复制控件会读取同一变量调整位置        |

脚注 ID 是[边注模块](../../scripts/sidenotes/README.md)的输入，代码围栏和原始源码由[文章增强](../../scripts/post/README.md)及 [Mermaid](../../scripts/mermaid/README.md)继续增强。调整 AST 标记时同步检查这些消费方，不从文章内容猜测控件状态。

验证使用 `pnpm build` 的真实文章，核对公式渲染、脚注链接和代码文件名标记；插件运行成功不等于客户端布局验收。
