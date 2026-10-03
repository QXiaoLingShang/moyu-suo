---
title: Codeforces 题面与术语注解规范（内部）
pubDatetime: 2026-09-27T00:00:00+08:00
description: CF 题解中题面概述、英文术语和脚注解释的写作约定。
draft: true
excludeFromRss: true
tags:
  - OI日记
  - CodeFoces
status: 草稿
---

# Codeforces 题面与术语注解规范

本文件用于统一 `posts/study/OI/CF/` 下题解的题目翻译方式。文章按本目录已有的 Round-1122.md 风格撰写：中文概述题意，不逐句硬译；题目本身与后续解析分开。

本规范文件保留 `draft: true` 和 `excludeFromRss: true`，只作仓库内参考，不发布到博客。

## 题面概述

- 每题使用 `## A 题` 这样的标题，题意放进 Obsidian note 引用块；note 标题保留英文题名，并链接到 Codeforces 官方题目页。
- 用简洁、自然的中文交代对象、规则、操作和目标。省略比赛说明、输入输出格式等重复性框架文字；样例和纯粹的时间、内存限制通常不抄入题解。
- 保留会影响理解或答案的条件，包括操作前提与顺序、是否允许不操作、询问是否独立、优化目标等。若 easy/hard 版本的差异只有数据范围，可在 hard 版简要说明这一点。
- 变量、下标和数学条件按原题保留；不要为了压缩文字改变量词、边界、操作含义或“任意/恰好/至少”等限定。
- 题意 note 结束后，在引用块外写 `解析：`，解法、证明和代码由作者补充。

示例骨架：

```md
## A 题

> [!note] 题目：[English Title](https://codeforces.com/contest/编号/problem/A)
> 用中文概述题目对象、操作和目标。首次出现的重要术语加脚注说明[^term]。

解析：

[^term]: 在文章末尾写清术语的定义。
```

## 术语与脚注

- 对题目核心、容易误解或原题专门定义的概念，使用 Markdown 脚注解释，不把长定义塞进题干，也不只用一句模糊的近义词带过。
- 首次出现时先写中文名，再附英文全称；若原题使用缩写，也一并写出缩写。例如：`回文串（Palindrome）[^palindrome]`、`最小未出现非负整数（MEX，minimum excluded value）[^mex]`。不要只写 `MEX` 而不展开全称。
- 定义要能独立读懂，并尽量沿用 Codeforces 原题的精确定义。涉及字符串时，说明量词和下标关系；涉及集合或序列时，说明取值范围、重复元素是否影响定义。需要时补一个短例子。
- 同一篇文章内同一术语只在首次出现处解释一次；脚注标识使用有含义的小写英文，如 `[^palindrome]`、`[^mex]`。脚注定义统一放在文章末尾。
- 普通词语和不会影响理解的基础操作不必加注。若“子串（substring）”与“子序列（subsequence）”的连续性区别会影响题意，应在首次出现处分别说明。

脚注内容示例：

> 给定一个非负整数序列 $a$，求它的最小未出现非负整数（MEX，minimum excluded value）[^mex]。

[^mex]: 一个非负整数序列的 MEX，是没有出现在序列中的最小非负整数。例如，序列 `[0, 1, 1, 3]` 的 MEX 是 `2`；序列 `[2, 2, 1]` 的 MEX 是 `0`。

## 官方来源与核对

- 以 Codeforces 官方题目页为准；标题链接直接指向对应题目页。中文概述完成后，对照原题核对关键定义、操作、目标与版本差异。
- 例如，Codeforces 对 [Palindrome](https://codeforces.com/contest/2267/problem/A) 的定义可写成等式条件；对 [MEX](https://codeforces.com/problemset/problem/1554/C) 的定义明确为序列中没有出现的最小非负整数。
