# 首页交互

`pages/index.astro` 只导入本目录的 `index.ts`。入口先启动门户导航，再启动氛围效果，保留进入文章后再次返回首页的初始化路径。

## 文件职责

| 文件                                                     | 职责                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `index.ts`                                               | 页面初始化、背景效果组合及最近文章的滚动显现                                             |
| `homePortal.ts`、`homePortalEvents.ts`                   | 门户入口、详情区、语言同步和输入事件                                                     |
| `homeOrbit.ts`                                           | 入口布局及窗口变化后的重排                                                               |
| `homePointer.ts` 与 `homePointer*`                       | 指针生命周期、目标解析、效果状态、高亮与粒子资源；详见[指针架构](pointerArchitecture.md) |
| `homeHalftone.ts`、`homeRipple.ts`、`homeWaterGlints.ts` | 各自的背景效果及清理                                                                     |
| `homeImage.ts`                                           | 首页背景图片 URL 和解码 Promise 复用；加载失败移除缓存项                                 |

入口数据来自 [data/homeEntrances.ts](../../data/homeEntrances.ts)；环绕布局、字形抽样和水波计算仍在 [utils](../../utils/README.md)，样式位于 [home.css](../../styles/home.css)。

## 生命周期与状态

门户和氛围使用各自 DOM 标记避免重复初始化；常驻 `astro:page-load` 监听只注册一次。离页在 `astro:before-swap` 释放对应监听、观察器、动画与临时 DOM，然后移除标记。图片解码 Promise 按资源复用，不保存跨页交互状态。

指针坐标、效果阶段、锚点高亮、粒子资源各有独立所有者；入口只负责组合。滚动、主题、语言和减少动态效果偏好的变化通过已有接口刷新，不能由另一个模块直接修改状态副本。

## 回归入口

纯计算见 `tests/home-geometry.test.mjs`、`home-pointer-geometry.test.mjs`、`home-ripple-wave.test.mjs`。真实浏览器检查：首页进入文章再返回、窗口变化、手机布局、文字和 SVG 控件悬停、明暗与语言切换、键盘以及减少动态效果。几何测试通过不代替动画与输入验证。
