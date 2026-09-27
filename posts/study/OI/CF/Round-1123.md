---
title: Codeforces Round 1123（Div. 2）题解草稿
pubDatetime: 2026-09-27T00:00:00+22:00
description: 赛时4题，简要分析了ABCD四题得思路
draft: false
excludeFromRss: true
tags:
  - OI日记
  - CodeFoces
---

赛时 4 题
![](assest/Pasted%20image%2020260927171239.png)


## A 题

> [!note] 题目：[Turn Into a Palindrome](https://codeforces.com/contest/2267/problem/A)
> 给定一个长度为 $n$ 的小写字母串 $s$ 和一个小写字母 $c$。一次操作可以选择一个下标 $i$，把 $s_i$ 改成 $c$。求把 $s$ 变成回文串（Palindrome）[^palindrome] 所需的最少操作次数。

解析：

回文串只要求每一对对称位置相同，所以从两端向中间检查即可：

- 两个字符本来相同，不用操作。
- 两个字符不同，但其中一个已经是 $c$，把另一个改成 $c$ 就行，只需一次操作。
- 如果两个字符都不是 $c$，就要各改一次，让它们都变成 $c$。

每一对位置互不影响，把需要的操作次数加起来就是答案。

```c++

int need = 0;
int l = 0, r = n - 1;
while (l < r) {
    if (s[l] != s[r]) {
        if (s[l] == c || s[r] == c) {
            need++;
        } else {
            need += 2;
        }
    }
    l++, r--;
}
cout << need << "\n";
```

**送的**
## B 题

> [!note] 题目：[Fashionable Array](https://codeforces.com/contest/2267/problem/B)
> 数组的众数是出现次数最多的数；若有多个数并列，则取最大的数。给定一个数组 $a$，可以任意重排其中的数。请输出一种重排，使所有前缀的众数之和最大。

解析：

题目要求最大化所有前缀众数之和，先从贪心入手：

让当前最大值尽可能早、尽可能久地成为众数。

我个解法是，每一轮，将最大值 M 出现 m 次。
具体做法是，若最大值 M 出现 `cnts[M]` 次，则所有比 M 小的都要出现至多 `cnt[M]` 次，这就是一轮。

```c++
void sub(vector<int> &res, vector<int> &a) {
    int n = a.size();
    if (n == 0) return;

    // 1. 最大值的出现次数
    int max_val = a.back();
    int max_cnt = 0;
    for (int i = n - 1; i >= 0 && a[i] == max_val; --i)
        ++max_cnt;

    // 2. 按值分组，从左到右处理（a 已升序）
    vector<int> new_a;
    int i = 0;
    while (i < n) {
        int j = i;
        while (j < n && a[j] == a[i]) ++j;

        int cnt  = j - i;                       // 当前值的出现次数
        int keep = max(0, cnt - max_cnt);       // 留在 a 中的数量（靠左）

        // 靠左的 keep 个保留在 a 中
        for (int k = i; k < i + keep; ++k)
            new_a.push_back(a[k]);

        // 靠右的 cnt - keep 个，按从右到左的顺序推入 res
        for (int k = j - 1; k >= i + keep; --k)
            res.push_back(a[k]);

        i = j;
    }

    a = move(new_a);
}
```

反复迭代若干轮，答案就构造出来了。

```c++

vector<int> res;
while (res.size() != n) {
    sub(res, a);
}

```

官解先统计每个数 $j$ 的频次 `cnt[j]`。外层的 $i$ 表示副本层数，内层按数值从大到小扫描；`cnt[j] >= i` 就表示第 $i$ 个 $j$ 存在：

```cpp
for (int i = 1; i <= n; ++i)
    for (int j = 100; j >= 1; --j)
        if (cnt[j] >= i) cout << j << ' ';
```

时间复杂度：我的写法 $O(n \sqrt{n})$ ^[2]，官解 $O(100n)$；
空间复杂度：我的写法 $O(n)$，官解 $O(n+100)$。

[^2]: 我的代码初看像是 $O(n^2)$，但实际是 $O(n\sqrt{n})$。证明如下
	
	设数组中有 $m$ 个不同的值。每次调用 `sub()`，最大值会被完全移入 `res`，因此至少有一个不同值消失；  
	同时其余每个值的出现次数都会减少，所以下一轮的不同值个数至多为 $m-1$。因此 `sub()` 最多被调用 $m$ 次。
	
	每次 `sub()` 处理当前数组，规模不超过 $n$，所以总复杂度为 $O(nm)$。
	
	而 $m$ 的最大值受 $n$ 约束：最坏情况下各值的出现次数为 $1,2,\dots,m$，此时
	
	$$
	n = 1+2+\cdots+m = \frac{m(m+1)}{2} = O(m^2)
	$$
	
	所以 $m = O(\sqrt{n})$。
	
	代入得总复杂度：
	
	$$
	O(nm) = O(n\sqrt{n})
	$$

## C 题

> [!note] 题目：[GCD Treasury](https://codeforces.com/contest/2267/problem/C)
> 有 $n$ 堆金币，第 $i$ 堆有 $a_i$ 枚，另给定一个整数 $x$。每次可以选择一堆当前还有金币、且金币数量与 $x$ 的最大公约数大于 $1$ 的金币堆。设最大公约数为 $g$，取走这堆中的 $g$ 枚金币，然后令 $x=g$。无法继续操作时游戏结束，求最多能取走多少枚金币。

解析：
先看选中一堆后会发生什么。

设这堆有 $a_i$ 枚，当前 $x$ 与它的最大公约数为 $g$。  
取走 $g$ 枚并令 $x=g$ 后，剩下的金币仍是 $g$ 的倍数，所以它与当前 $x$ 的最大公约数还是 $g$；
继续操作就能取空整堆。

> **推论 1：** 也就是说，处理一堆等价于取走 $a_i$ 枚，并把 $x$ 更新为 $\gcd(x,a_i)$。

处理完选中的堆后，$x_{final}$ 等于 $x_{初始}$ 与这些堆金币数的**最大公约数**。

因此，任何可行选择的收益都不超过某个 $p$ 组的金币总数。

反过来，固定初始 $x$ 的质因子 $p$，所有 $p\mid a_i$ 的堆都能取空，而且操作后 $x$ 仍能被 $p$ 整除，所以这一组可以全部取完。

因此最终答案是枚举 $x$ 的不同质因子，取对应分组金币总数的最大值：

$$\max_{p\mid x,\ p\text{ 为质数}}\sum_{i:p\mid a_i}a_i$$

我的写法先用线性筛预处理最小质因子，再分解 $x$。对每个质因子 $p$，扫描数组并累加能被 $p$ 整除的 $a_i$：

```cpp
for (int p : get_p(x)) {
    long long sum = 0;
    for (int value : a) {
        if (value % p == 0) sum += value;
    }
    answer = max(answer, sum);
}
```

官解求的是同样的分组和，只是换了累加顺序：对每堆先算 $d_i=\gcd(a_i,x)$，再把 $a_i$ 加到 $d_i$ 的各个质因数组中。因为 $d_i$ 的质因子正是 $a_i$ 和 $x$ 共有的质因子。例如 $x=12,a_i=18$ 时，$d_i=6$，所以这堆的 $18$ 枚金币会加到 `cnt[2]` 和 `cnt[3]`。处理完所有堆后，取最大的 `cnt[p]`。

我的写法按质因子重复扫描数组，推导直接；官解每堆只求一次 gcd，再更新对应的质因数组。设 $M$ 为筛法上界，$\omega(y)$ 为不同质因子数：我的做法预处理 $O(M)$，单组 $O(n\omega(x)+\log x)$；官解预处理 $O(M\log\log M)$，单组 $O(n\log x+\sum_i\omega(\gcd(a_i,x)))$。

## D 题

> [!note] 题目：[Backrooms Hill](https://codeforces.com/contest/2267/problem/D)
> 给定一个 $1$ 到 $n$ 的排列，每次可以交换相距 $2$ 的两个位置。判断能否将它变成先严格递增、再严格递减的山形数组。

解析：

交换相距 $2$ 的位置不会改变元素所在位置的奇偶性；即同奇偶位置的元素则可以任意重排，因此：

> **推论 1**：每个数最终只能放在与原位置奇偶性相同的位置。

在山形数组中，对任意 $x$，所有不小于 $x$ 的数（即 $[x,n]$）必定占据一段连续区间。

而连续区间里的奇数位和偶数位数量最多相差 $1$，所以：

> **推论 2：** 原数组中属于 $[x,n]$ 的数也必须满足：
> 
> $$|O_x-E_x|\le1$$
> 
> 其中 $O_x$、$E_x$ 分别是这些数原本位于奇数位、偶数位的数量。这是**必要条件**。

它也是**充分条件**，证明如下：

从大到小构造，先放置 $n$，再依次把 $x$ 接到当前区间的左端或右端。
- 若区间长度为偶数，两端外侧分别是奇数位和偶数位，总能选到与 $x$ 原位置匹配的一端；
- 若长度为奇数，两端外侧都属于区间中较少的奇偶类，而条件 $|O_x-E_x|\le1$ 保证 $x$ 正属于这一类。
因此每个数都能放入，且较小的数接在外侧后仍保持山形。

实现时按数值从大到小累计奇偶位置数量差。这里 `pos[x] == 0` 表示 $x$ 原来在偶数位，`pos[x] == 1` 表示在奇数位：

```cpp
int balance = 0;
for (int x = n; x >= 1; --x) {
    balance += (pos[x] == 0 ? 1 : -1);
    if (abs(balance) > 1) {
        cout << "NO\n";
        return;
    }
}
cout << "YES\n";
```

我的构造解法按位置奇偶分组、排序后从两端扩展，需要额外维护端点状态，过于复杂，在此不表，时间复杂度 $O(n\log n)$；  
官解只需检查每个高值后缀的奇偶数量差。，后者为 $O(n)$；空间复杂度均为 $O(n)$。
## E 题

> [!note] 题目：[Clean Substrings](https://codeforces.com/contest/2267/problem/E)
> 如果一个二进制串的所有字符都相同，就称它是干净的。
> 一次操作可以选择一个干净子串（substring）[^substring]，并将其中所有字符取反。
> 
> 一个字符串的 beauty 是把它变成干净串所需的最少操作次数；power 则是它所有子串的 beauty 之和。
>
> 给定一个二进制串 $s$，接下来进行 $q$ 次修改。每次选择一个位置 $i$，将 $s_i$ 取反。输出初始状态以及每次修改后的能量值。

TODO：有时间再补，当时没写出来
## F1 题

> [!note] 题目：[XOR Transformations (Easy Version)](https://codeforces.com/contest/2267/problem/F1)
> 对一个长度为 $m$ 的数组 $b$ 做一次变换：计算所有 $i<j$ 的 $b_i\oplus b_j$，取最小的 $m$ 个数作为新数组。给定一个非负整数数组 $a$ 和 $q$ 个询问，每个询问给出 $x$，求从原数组开始进行 $x$ 次变换后，最大值与最小值的差。各询问互不影响。

TODO：有时间再补，当时没写出来
## F2 题

> [!note] 题目：[XOR Transformations (Hard Version)](https://codeforces.com/contest/2267/problem/F2)
> 本题与 F1 的变换和询问相同，只是数据范围更大。

TODO：有时间再补，当时没写出来

## G 题

> [!note] 题目：[New LRT](https://codeforces.com/contest/2267/problem/G)
> 一条轻轨沿直线运行。给定目的地 $n$、整数 $m$ 和数组 $c$。位于位置 $i$ 时，可以选择一个正整数 $x$，要求 $(m\mathbin{\&}x)=x$，花费 $c_x$ 枚硬币前往位置 $i+x$。不同的移动顺序或移动方式算作不同的行程。求从位置 $0$ 到位置 $n$ 的所有行程花费之和，对 $10^9+7$ 取模。

TODO：有时间再补，当时没写出来

[^palindrome]: 对于长度为 $m$ 的字符串 $t$，若对所有 $1\le i\le m$ 都有 $t_i=t_{m-i+1}$，则称 $t$ 是回文串（Palindrome）。换句话说，将字符串反转后，它与原串完全相同。

[^substring]: 若字符串 $a$ 能通过分别删除字符串 $b$ 开头和末尾的若干字符得到，则 $a$ 是 $b$ 的子串；两端都可以不删，也可以删到只剩空串。因此，子串在原串中必须连续。例如，`bcd` 是 `abcde` 的子串，`bce` 则不是。
