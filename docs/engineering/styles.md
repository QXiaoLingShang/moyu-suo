# 样式约定

## 样式来源

- 项目使用 Tailwind CSS 4。布局和常见间距优先使用现有 Tailwind utility；共享设计 token 维护在 `src/styles/theme.css` 并通过 `@theme` 暴露。
- 全站基线放在 `global.css` / `typography.css`，页面专属规则放在对应页面样式，功能状态样式放在对应功能样式文件（如 `home.css`、`reading-focus.css`、`sidenotes.css`）。
- 有全局语义 token 时使用 token，如 `var(--foreground)`、`var(--border)`、`var(--accent)`；颜色和尺寸常量只在有具体视觉理由时局部定义。
- 同类控件沿用共享颜色、焦点轮廓、间距和主题行为，不为单页另造一套通用设计系统。

## 叠放层级

- 全站层级 token 统一定义在 `global.css` 的 `:root`：sticky `10`、floating `20`、pointer effects `25`（装饰层，低于交互弹层）、popover `30`、navigation `40`、modal overlay `50`、skip link `70`。数值只在 token 定义处出现，页面和组件按语义引用对应的 `--z-*` token。
- 原生 `<dialog>.showModal()` 使用浏览器 top layer，高于普通文档 z-index；图片预览放在打开它的 dialog 内，或普通 body overlay 用 modal token。需要置于 dialog 之上的内容必须进入同一 dialog/top layer，单纯增加 z-index 不会越过 top layer。
- 组件自身的装饰叠层使用 `--z-local-*`（behind/base/raised/overlay/accent/top）局部刻度，只在各自 stacking context 内比较，不拿局部值与全站浮层 token 比较。全屏效果层必须选有限、具名的全站层级，禁止使用巨大魔法数。

## 类名和选择器

- 新增功能样式使用可辨识的 kebab-case 功能前缀，例如 `reading-focus-*`、`sidenote-*`、`home-*`。
- 选择器尽量作用于明确的组件类或状态类，不依赖容易随文案、图标增删而变化的宽泛后代结构。
- 若 CSS 需要区分装饰节点和文案节点，给装饰节点明确类名；不要用“第一个/所有 `span`”之类的结构选择器把呈现规则误套到文字上。
- `data-*` 属性用于有语义的状态或脚本/CSS 接口，不用它们存放 CSS 已可推导的重复状态。属性新增、改名或清理时同步检查脚本写入方和所有样式消费方。

## 响应式和动态效果

- 根滚动条空间从首次绘制起由全局 CSS 预留；滚动锁切换与窗口缩放保持正文宽度及位置稳定，覆盖层覆盖实际视口。空间补偿只有一个所有者，不硬编码滚动条宽度或叠加各弹层自己的补偿。
- 所有覆盖层与移动导航通过 [acquirePageScrollLock()](../../src/scripts/pageScrollLock.ts) 获取可嵌套、幂等释放的滚动锁。共享模块负责保存和恢复临时样式、监听窗口变化；调用方负责按自身生命周期释放句柄，Astro 页面离开时必须清理其所有锁。布局算法细节记录在模块旁。

- 以内容和断点行为为目标设计，不以单张截图或单一窗口尺寸为依据；长标题、窄屏和密集内容属于正常输入。
- 明暗模式使用主题变量；键盘可见焦点保持清楚；`prefers-reduced-motion` 下移除不必要的过渡和动画并保留信息反馈。
- 伪元素和纯装饰层不承载唯一信息，也不能遮挡链接、文本选择或焦点轮廓。
- 改动标记或 DOM 子节点时，同时检查相应 CSS 选择器；改动选择器时确认它匹配的是预期节点，而非新增的标签文本。
