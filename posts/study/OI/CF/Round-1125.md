---
title: Codeforces Round 1125（Div. 3）练习记录
pubDatetime: 2026-10-09T00:00:00+08:00
description: Round 1125练习记录，先整理A—H题意，解析待补。
draft: true
excludeFromRss: true
tags:
  - OI日记
  - CodeFoces
status: 草稿
---

这场没有正式参赛，作为练习做了 A—D 四题。

## A 题

> [!note] 题目：[In Search of Convenience](https://codeforces.com/contest/2275/problem/A)
> 给定整数坐标 $(x_0,y_0)$ 和正整数 $R$，找到任意一个整数坐标点 $(x,y)$，使它到 $(x_0,y_0)$ 的欧氏距离恰好为 $R$。

解析：

TODO

## B 题

> [!note] 题目：[Did Not Go to Print](https://codeforces.com/contest/2275/problem/B)
> 有 $n$ 份编号为 $1$ 到 $n$ 的文档，打印机内存初始为空。按顺序执行 $n$ 条指令，第 $i$ 条指令由 $s_i$ 指定：
>
> - `1`：将文档 $i$ 扫描到内存，放在最上方。
> - `2`：若内存非空，打印最上方的文档并将它移出内存；否则打印文档 $i$。
> - `3`：直接打印文档 $i$，不改变内存。
>
> 求所有未被打印的文档数量，并按编号递增顺序输出它们。

解析：

TODO

## C 题

> [!note] 题目：[Unrequited Love](https://codeforces.com/contest/2275/problem/C)
> 给定长度为 $n$ 的整数数组 $a$。选择起点 $x$（$1\le x\le n-4$），同时取下标 $x,x+2,x+4$，得到一个三元组，其值为 $a_x+a_{x+2}-a_{x+4}$。
> 求有多少对不同的三元组，满足不共用任何下标，且两个三元组的值相等。每对只计一次，不区分顺序。

解析：

TODO

## D 题

> [!note] 题目：[Precision Alignment](https://codeforces.com/contest/2275/problem/D)
> 给定 $n$ 个三元组 $(a_i,b_i,c_i)$，三者的顺序固定，不能重排。每次选择一个三元组，进行以下一种调整：
>
> - $c_i\gets c_i+\operatorname{sgn}(a_i-b_i)$；
> - $b_i\gets b_i+\operatorname{sgn}(a_i-c_i)$；
> - $a_i\gets a_i+\operatorname{sgn}(b_i-c_i)$。
>
> 其中 $\operatorname{sgn}$ 表示符号函数（sign function）[^sgn]。操作依次进行，每次根据当前值计算；同一个三元组可以调整多次。
> 总共至多进行 $k$ 次操作，也可以不操作，求最终 $\min_{1\le i\le n}(a_i+b_i+c_i)$ 的最大值。

解析：

TODO

## E 题

> [!note] 题目：[Repentance Is Already on the Way](https://codeforces.com/contest/2275/problem/E)
> 有两排建筑，每排 $n$ 栋，第 $i$ 栋所属公司的编号分别为 $a_i,b_i$。第一排第 $i$ 栋与第二排第 $j$ 栋之间有双向道路，当且仅当 $|i-j|\le1$，没有其他道路。
> 道路两端属于同一家公司时长度为 $2$，否则长度为 $1$。
> 从第一排第 $1$ 栋出发，要求每栋建筑恰好经过一次，终点任意，求路线的最大长度。

解析：

TODO

## F 题

> [!note] 题目：[Tea Blend](https://codeforces.com/contest/2275/problem/F)
> 给定长度为 $n$ 的正整数数组 $a$。对每个有序下标对 $(i,j)$（$1\le i,j\le n$），定义：
>
> $$F(i,j)=a_i\prod_{k=1}^{j}a_k.$$
>
> 求有多少对 $(i,j)$ 使 $F(i,j)$ 的正因数个数为奇数。$i$ 与 $j$ 可以相等，也没有大小关系限制。

解析：

TODO

## G 题

> [!note] 题目：[Copper Squander](https://codeforces.com/contest/2275/problem/G)
> 给定一个有 $n$ 个点、$m$ 条边的无向简单图，初始不一定连通。第 $i$ 条边的回收价值为 $d_i$。
> 先选择任意一些原边删除，每删一条获得其回收价值；再在任意两个不同点之间添加新边，第 $1,2,3,\ldots$ 条新边的费用分别为 $x,2x,3x,\ldots$。
> 最终必须使整个图连通，收益为回收所得减去新边费用。
> 给定 $q$ 个相互独立的情形，每个情形指定一个 $x$，求各自的最大收益。

解析：

TODO

## H 题

> [!note] 题目：[A Problem to Warm Up the Eyebrows](https://codeforces.com/contest/2275/problem/H)
> 给定一个 $n\times m$ 的整数矩阵 $A$。对于每个非空的连续子矩阵，设它有 $a$ 行、$b$ 列，元素和为 $S$，其贡献为 $(-1)^{a+b}S^2$。
> 求所有子矩阵的贡献之和，包括整个矩阵本身，结果对 $10^9+7$ 取模。

解析：

TODO

[^sgn]: 对于整数 $x$，符号函数 $\operatorname{sgn}(x)$ 在 $x>0$ 时为 $1$，在 $x=0$ 时为 $0$，在 $x<0$ 时为 $-1$。
