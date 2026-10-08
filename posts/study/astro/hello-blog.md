---
title: 初探 astro
pubDatetime: 2026-09-04T23:30:00+08:00
description: 记录我通过阅读 Astro 官方教程和示例仓库，初步了解 .astro 文件的组件结构。
draft: true
tags:
  - astro
aiGenerated: true
---
## 引言

虽然这个 blog 是纯 AI 搭建的，但我也好奇 astro 的语法。
发现官网提供了 [【Astro doc】# 搭建你的第一个 Astro 博客](https://docs.astro.build/zh-cn/tutorial/0-introduction/) 遂决定来看看和学习。。。

结果看了几页就看不下去了。。。（惭愧）
因为这个教程我感觉是面向 **只学过一点 html/js/css** 的 **超级萌新** 的。

手把手把饭喂给你吃，以致于过于冗长。（对于我来说）
于是我把官方的最终效果仓库[blog-tutorial-demo](https://github.com/withastro/blog-tutorial-demo)
clone 下来，来看代码来进行学习。


## Astro 文件

Astro 多了个 `.astro` 文件，我看了下，感觉和 `vue` 很像。Astro 采用固定格式

```astro
# ./Header.astro

---
// js代码
import Menu from "./Menu.astro";
import Navigation from "./Navigation.astro";
import ThemeIcon from "./ThemeIcon.astro";

---

<!-- html -->
<header>
  <nav>
    <div>
      <ThemeIcon />
      <Menu />
    </div>
    <Navigation />
  </nav>
</header>

<style>
  div {
    display: flex;
    justify-content: space-between;
  }
</style>
```
