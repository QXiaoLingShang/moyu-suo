# 首页指针动效：架构基准

本文区分三类内容：仓库级原则来自 [`docs/engineering/principles.md`](../../docs/engineering/principles.md) 与 [`docs/engineering/architecture.md`](../../docs/engineering/architecture.md)，`AGENTS.md` 只提供规范入口；实现事实根据当前指针代码和 CSS 整理；局部 review 建议只适用于首页指针动效，不自动成为全仓规则。视觉效果要求仍以 [`TODO.md`](../../docs/TODO.md) 为准；本文不代替浏览器验收。

## 与仓库原则的关系

仓库级相关原则记录在 `docs/engineering/architecture.md`、`frontend.md` 和 `principles.md`：交互脚本与可复用计算分层；复杂功能按职责和状态所有权拆分；高频指针/滚动工作合并并减少布局读写交错；监听器、观察器和动画资源要清理；响应式布局、键盘操作和减少动态效果偏好都要考虑；抽象应解决实际重复或耦合。

下面的文件职责表和 `data-*` 映射是对现有实现的归纳；“后续 review 清单”是把上述原则具体化到本功能的审查建议。它们不是 `AGENTS.md` 里的逐字规则，也不能只凭文档打勾就证明交互行为正确。

## 当前模块职责（源码归纳）

| 模块                                                                   | 当前职责                                                                     | 建议维持的边界                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `src/scripts/homePointer.ts`                                           | 创建无障碍树隐藏的装饰层，组合各模块，绑定指针/几何/偏好事件，并返回清理函数 | 不承接动画算法、命中策略和效果状态转换 |
| `src/scripts/homeAtmosphere.ts`                                        | 负责首页氛围功能的页面初始化，并在 Astro 页面切换前调用各功能的清理函数      | 指针状态与粒子动画                     |
| `src/scripts/homePointerController.ts`                                 | 接收指针输入，保存指针/光环位置与速度，合并动画帧，响应目标几何和偏好变化    | 决定粒子如何抵达、字形如何点亮         |
| `src/scripts/homePointerTargeting.ts`                                  | 按“直接命中、保留当前目标的缓冲范围、首页入口几何范围”解析目标               | 写入高亮状态或创建 DOM                 |
| `src/scripts/homePointerTransitions.ts`                                | 独占效果状态、当前悬停目标和回收目标；驱动接近、散开、合并、回收及粒子回调   | 自行维护指针坐标或逐帧插值             |
| `src/scripts/homePointerTargets.ts`                                    | 准备目标字形、提供字形目的点和边界几何，并缓存稳定入口的测量结果             | 决定目标状态或控制 CSS 表现            |
| `src/scripts/homePointerHighlight.ts`                                  | 保存抽样锚点与实际抵达记录，更新目标/字形上的展示属性                        | 推进粒子或拥有整体效果状态             |
| `src/scripts/homePointerParticles.ts`                                  | 管理粒子 DOM、动画帧、延时器、预算与取消；完成结果区分抵达和预算淘汰         | 直接判定字形已经抵达或点亮             |
| `src/utils/homePointerGeometry.ts`、`src/utils/homePointerSampling.ts` | 提供可独立使用的几何和抽样计算                                               | 访问页面 DOM 或持有交互状态            |
| `src/styles/home.css`                                                  | 根据脚本写入的 `data-*` 属性呈现状态                                         | 成为状态机的另一份隐式实现             |

状态流向如下：

```text
browser events
     ↓
homePointerController ── calls ──> homePointerTargeting
     │                                  │
     └──────────── resolved target ─────┘
                       ↓
              homePointerTransitions <── motion port ──> controller
                 ├─ start/retarget ──> homePointerParticles
                 │                       └─ completion callback ──> transitions
                 └─ phase/highlight ──> homePointerHighlight ──> data-* ──> home.css

controller ── transform ──> pointer / glow
particles  ── create/remove ──> satellite DOM
```

控制器向状态协调器提供 motion 接口。效果状态的可变数据由 `homePointerTransitions` 持有；位置与插值由控制器持有；锚点/抵达记录由高亮模块持有；活动粒子及其计时资源由粒子模块持有。这是当前实现的分工，不代表这些文件名和拆分方式是全仓唯一标准。

## 脚本与 CSS 的 DOM 契约

这些属性是模块间接口。增加、重命名或改变含义时，需同时检查写入方、清理方和 `src/styles/home.css` 中的选择器。

| DOM 属性                                                    | 写入方                   | 含义与样式约定                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 指针/光环 `data-active`、根节点 `data-home-cursor-active`   | `homePointerController`  | 控制器在首次有效鼠标输入时写入、停用时清除；CSS 用于显隐/恢复原链接 hover 样式。控制器也读取指针 `data-active` 作为激活门闩，因此它兼有交互控制和显示用途。                                                                                                             |
| 光环 `data-state`                                           | `homePointerTransitions` | 内部状态为 `inactive` 或 `following` 时移除；`approaching`、`icon`、`dispersing`、`merged`、`gathering`、`departing` 才写入。`icon` 仅用于没有可见文字且没有可采样 SVG 路径的图像控件；可见 SVG 与文字共用拆散/合并流程。不要为纯内部状态增加属性，除非确有样式消费者。 |
| 光环/指针 `data-mode`                                       | `homePointerTransitions` | `entry` 和 `text` 表示特定视觉模式；默认模式通过移除属性表达。CSS 的默认样式就是缺省模式，不写入冗余的 `moon` 值。                                                                                                                                                      |
| 目标/入口 `data-home-pointer-phase`                         | `homePointerHighlight`   | `approaching`、`dispersing`、`merged`、`departing` 描述目标生命周期。`departing` 会撤销整控件的 `merged` 样式，即使当前没有单独的 departing 选择器，也不能随意省略。                                                                                                    |
| 目标 `data-home-pointer-text="glyphs"`                      | `homePointerTargets`     | 表示文本已按字形拆分；CSS 据此避免整控件高亮与逐字高亮叠加。清理目标时由 `homePointerHighlight` 移除。                                                                                                                                                                  |
| 字形 `data-home-pointer-anchor`、`data-home-pointer-source` | `homePointerHighlight`   | 粒子锚点和扩散来源的关联数据，供回收及高亮扩散使用；清理时随目标状态一并移除。                                                                                                                                                                                          |
| 字形 `data-home-pointer-lit`、`data-home-pointer-fading`    | `homePointerHighlight`   | 分别驱动抵达高亮和离开渐隐；仅粒子结果为 `arrived` 时记为抵达，预算淘汰不能点亮字形。                                                                                                                                                                                   |

内部效果状态与 `data-state` 不要求一一对应。例如 `following` 只驱动控制器插值，不是 CSS 状态。`data-active` 是另一个已存在的控制门闩；若重构它，应同步考虑 CSS 消费方，避免状态与显示属性失配。

目标按实际可见字形分流：`.sr-only`、脚本/样式和 CSS 隐藏文本不生成字形；`aria-hidden` 本身不等于视觉隐藏（例如语言按钮的“中 / EN”）。可见文字继续按字形生成目的点；可见 SVG 的实际路径按屏幕坐标采样，和文字字形一起进入同一套光环接近、光点扩散、目标点亮与回收流程。纯 SVG 控件不伪造文本字形或退化到中心点；没有可见文字且没有可采样 SVG 路径的图像控件才进入 `icon`，直接高亮自身。图文混合控件从 SVG 内部或控件边缘命中时仍保留逐字粒子效果，光点抵达后 SVG 同步高亮。切换目标时取消上一轮粒子回收并清理高亮，避免旧回调影响新目标；滚动/尺寸变化重新命中，语言变化重新判定文字和 SVG 目的点，停用和页面离开沿用统一清理路径。

## 生命周期和性能边界

- 入口使用一个 `AbortController` 绑定窗口、根元素和媒体偏好监听器；根元素的 `pointerleave` 不冒泡到窗口，因此在根元素上处理移出视口的停用。清理时先中止监听，再调用控制器销毁，最后移除装饰层。
- 控制器销毁时停用效果、取消动画帧并断开语言观察器。粒子取消时清除动画帧、延时器、粒子节点和活动记录。
- 光环/指针位置绘制、命中解析以及滚动、尺寸、字体、语言触发的目标刷新通过同一个 `requestAnimationFrame` 合并；连续指针事件只保留最新位置和事件目标。入口和普通链接的命中边界按布局失效点缓存；活动粒子因布局变化重定向时，只重测其锚点字形。
- 每帧优先使用 `transform` 更新光环、指针和粒子位置。避免在高频路径反复创建粒子 DOM、读取布局后立即写布局样式，或引入不受预算约束的活动粒子。
- 效果仅响应细指针设备上的鼠标；触摸输入会停用效果，减少动态效果偏好会停用效果。装饰层保持 `aria-hidden="true"` 且不接收指针事件。

## 后续改动的 review 清单

- [ ] 新增状态时，确认由 `homePointerTransitions` 独占；说明它是否需要 CSS 属性，更新状态联合类型、属性写入/清理和对应样式。
- [ ] 新增目标模式时，检查中英文切换、滚动/尺寸/字体重测及目标快速切换时的命中结果。
- [ ] 修改粒子完成回调时，区分 `arrived` 与 `budget-evicted`；确认被取消或重定向的旧回调不会推进新一轮目标的计数或高亮。
- [ ] 修改字形准备或目标清理时，检查普通链接、入口、嵌套元素、空文本和多字素字符；明确哪些隐藏文本应排除，并核对它们不会被包成可见字形。
- [ ] 修改事件或动画资源时，检查页面切换、窗口失焦、指针离开、偏好变化和重复初始化后的清理。
- [ ] 修改 CSS 属性契约时，用实际页面核对日/夜主题、宽/窄视口、键盘焦点和减少动态效果偏好。
- [ ] 新增抽象应消除已存在的重复或耦合；不要仅为缩短单个文件而增加纯转发层。
