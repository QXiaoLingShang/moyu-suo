---
title: WorldQuant Round 1（Codeforces Round 1128，Div. 1 + Div. 2）复盘
pubDatetime: 2026-10-18T00:00:00+08:00
description: 赛时4题，先整理A—H题意，解析待补。
draft: true
excludeFromRss: true
tags:
  - OI日记
  - CodeFoces
status: 草稿
---

赛时 4 题：A、B、C、D1。

## A 题

> [!note] 题目：[Hey, It's Me, Souvlakity](https://codeforces.com/contest/2261/problem/A)
> 将整数 $1\sim n$ 分给 Souvlakity 和 Kalamakity，二进制串 $s$ 表示初始归属：$s_i=1$ 时，整数 $i$ 属于 Souvlakity，否则属于 Kalamakity。保证 Souvlakity 初始至少有一个数。
> 两人交替操作，Souvlakity 先手，共进行 $10^{100}$ 回合。每回合必须将自己持有的恰好一个数交给对方。
> 最后 Souvlakity 的得分为所持整数的最大值减最小值。他希望得分最大，Kalamakity 希望这个得分最小，求双方最优时的最终得分。题目保证每回合都能操作，且结束时 Souvlakity 至少持有一个数。

解析：

TODO

## B 题

> [!note] 题目：[What's the Capital of France?](https://codeforces.com/contest/2261/problem/B)
> 给定长度为 $n$ 的非负整数数组 $a$。一次操作选择相邻两个元素：若它们不同，将较小的元素加 $1$；若相同，则不变。
> 可以操作任意次，也可以不操作，求最终所有元素的按位或 $a_1\mathbin{|}a_2\mathbin{|}\cdots\mathbin{|}a_n$ 的最大值。

解析：

TODO

## C 题

> [!note] 题目：[I Know About a Million Things](https://codeforces.com/contest/2261/problem/C)
> 给定一个正整数数组，Moggity 和 Larpity 交替操作，Moggity 先手。
> 每回合选择一个非空的位置集合，删除其中的所有元素，要求至少满足以下一个条件：只删除一个元素，或被删除元素的总和为偶数。所选位置不要求连续。
> 面对空数组、无法操作的人输，求双方最优时谁获胜。

解析：

TODO

## D1 题

> [!note] 题目：[Come Be My Friend, Don't Be So Scared (Easy Version)](https://codeforces.com/contest/2261/problem/D1)
> 有 $n$ 个排成一行的藏身位置，编号为 $1\sim n$，其中恰好一个位置藏着人。每台探测器覆盖一个连续区间，只报告人是否位于该区间内。
> 所有探测器同时启动，必须在得知任何报告之前确定全部区间。要求无论人藏在哪里，都能根据所有报告唯一确定其位置。
> 本版本初始没有探测器，即 $m=0$。求最少需要安装多少台，并输出每台覆盖的区间。

解析：

TODO

## D2 题

> [!note] 题目：[Come Be My Friend, Don't Be So Scared (Hard Version)](https://codeforces.com/contest/2261/problem/D2)
> 题意与 D1 相同，但初始已有 $m$ 台探测器，覆盖区间分别为 $[l_i,r_i]$，其中 $0\le m\le2\cdot10^5$，给定区间两两不同。
> 保留已有探测器，求最少还需添加多少台，并输出新增区间，使全部探测器的报告能唯一确定任意藏身位置。所有区间仍须提前确定。

解析：

TODO

## E 题

> [!note] 题目：[What Does the Cow Say?](https://codeforces.com/contest/2261/problem/E)
> 给定长度为 $n$ 的合法括号序列（RBS，Regular Bracket Sequence）[^rbs] 和整数 $k$。
> 一次操作选择相邻的 `()`，将这两个字符删除，记剩余字符串为 $s'$，再将整个序列改成 `(` $+s'+$ `)`，即在剩余字符串外包一层括号。
> 至多操作 $k$ 次，也可以不操作。得分为字符串中连续左括号 `(` 的最大数量，求能达到的最高得分。题目保证每次操作后仍是合法括号序列。

解析：

TODO：赛后已补代码，解析待整理。

## F1 题

> [!note] 题目：[Plegma II: Ask Me Any Cell (Easy Version)](https://codeforces.com/contest/2261/problem/F1)
> 对 $n\times n$ 网格中的每个目标 $(r,c)$，分别构造一个至多含 $k$ 个 $0$ 的二进制矩阵，并为所有矩阵构造共用的决策表 $a_0,a_1,\ldots,a_{n^2}$。
> 解码时，机器人从整个网格开始，每步只根据当前矩形中 $1$ 的数量 $S$，执行 $a_S$ 指定的动作：`U`、`D`、`L`、`R` 分别删去上、下、左、右侧的一行或一列。
> 决策不能依赖坐标、步数或历史。必须恰好操作 $2n-2$ 次，过程中不能删空矩形，最终只剩目标格子。
> 输出全部 $n^2$ 个编码矩阵及共用决策表。本版本正式测试为 $n=20,k=24$；样例为 $n=3,k=9$。

解析：

TODO

## F2 题

> [!note] 题目：[Plegma II: Ask Me Any Cell (Hard Version)](https://codeforces.com/contest/2261/problem/F2)
> 编码、解码规则与 F1 相同，仍需为每个目标输出编码矩阵，并给出所有矩阵共用、只依赖当前 $1$ 数量的决策表。
> 本版本 $n=3$ 或 $10\le n\le40$，要求达到最优的 $0$ 数量上界 $k=f(n)$：在所有能正确解码任意目标的方案中，使各编码矩阵中 $0$ 数量的最大值最小。

解析：

TODO

## G 题

> [!note] 题目：[1 2 3 and XOR, Where Did Everybody Go?](https://codeforces.com/contest/2261/problem/G)
> 给定长度为 $n$ 的非负整数数组 $a$。对于一个非空数组 $b$，一次操作选择其中恰好一个元素，给它加上任意非负整数，允许加 $0$。
> 定义 $f(b)$ 为恰好操作一次后，所有元素按位异或的最小值。求所有非空连续子数组的 $f$ 值之和：
>
> $$\sum_{1\le l\le r\le n}f([a_l,a_{l+1},\ldots,a_r]).$$

解析：

TODO

## H 题

> [!note] 题目：[Oh Tree Tree Tree, No Need to Leave](https://codeforces.com/contest/2261/problem/H)
> 这是一道通信题（Communication Problem）[^communication]。Isabel 要将长度为 $n$ 的二进制串 $b$ 传给 Tara，只能在一棵高度为 $h$、共 $2^h-1$ 个点的满二叉树上，为每个点写下一个二进制值。根编号为 $1$，点 $v$ 的左右孩子分别为 $2v,2v+1$。
> 编码完成后，对手选择一个点 $u$，将其值取反；若 $u$ 不是叶子，还会交换它的左右子树，然后按原规则重新编号。对手可以根据编码结果选择 $u$。
> Tara 只得到修改、重新编号后的节点值，不知道 $u$，必须还原原串 $b$。程序分两次独立运行，分别完成编码和解码，两阶段可以事先约定方案。
> 正式测试固定 $n=2030,h=11$；样例为 $n=1,h=2$。

解析：

TODO

[^rbs]: 合法括号序列中，左右括号总数相等，且任意前缀的左括号数都不少于右括号数。例如 `()()`、`(())` 合法，`)(` 不合法。

[^communication]: 通信题将程序分成编码、解码两个阶段运行。两阶段只能通过题目允许的编码载体传递信息，不能直接共享第一次运行中的变量或内存；这里的载体是经过对手修改的树。
