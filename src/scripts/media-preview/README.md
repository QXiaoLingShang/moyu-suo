# 共享媒体预览能力

图片预览和 Mermaid 聚焦复用这里的控件与手势。调用方分别是 [post/lightbox.ts](../post/lightbox.ts)、[mermaid/index.ts](../mermaid/index.ts) 和 [mermaid/focus.ts](../mermaid/focus.ts)；不通过 `post/` 获取图表需要的公共能力。

| 模块              | 接口与职责                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `controls.ts`     | `createIconControl(labelKey, icon)` 创建图标控件；图标来自打包内 SVG，文案从 UI 字典取得                                       |
| `interactions.ts` | `setupPreviewInteractions(overlay, media, close)` 管理缩放、平移、指针 / 触摸输入及缩放工具栏，返回 `refresh()` 和 `dispose()` |

## 所有权

`interactions.ts` 独占当前缩放和平移状态、输入帧、拖拽捕获及自己创建的工具栏。缩放 1 表示媒体适应容器后的尺寸，上限为 4。调用方在媒体尺寸或视口变化后调用 `refresh()`，关闭或离页时调用 `dispose()`。

图片和图表各自拥有媒体加载、覆盖层 / dialog、关闭效果、焦点恢复与 `pageScrollLock.ts` 的释放句柄。共享模块只通过传入的 `close` 请求关闭，不另建弹层或滚动锁。`dispose()` 先中止监听再释放捕获，避免捕获释放事件重新触发处理。

样式由 [PostLayout](../../layouts/PostLayout.astro) 静态导入 [media-preview.css](../../styles/media-preview.css)。控件、缩放状态和手势由行为模块管理，主题和层级继续使用全站 token。

## 回归入口

图片和 Mermaid 分别验证滚轮缩放、拖拽、双击复位 / 放大、触摸缩放、键盘、关闭后的焦点及离页清理。嵌套边注详情时核对锁的释放顺序；图表的 SVG 副本与刷新约束见 [Mermaid README](../mermaid/README.md)。
